from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotAuthenticated, ValidationError 
from rest_framework import status

from django.utils.html import strip_tags
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.core.mail import send_mail, EmailMultiAlternatives
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import get_user_model
User = get_user_model()
from .models import Profile, Follow, FollowRequest
from .permissions import IsModerator

from django.db import transaction
from django.db.models import (
    Q, 
    Exists, 
    OuterRef, 
    Subquery, 
    Value, 
    BooleanField, 
    ExpressionWrapper
    )

from .serializers import (
    PublicProfileSerializer, 
    OwnerProfileSerializer, 
    RegisterSerializer, 
    FollowListSerializer, 
    ProfileDetailSerializer, 
    LockedProfileSerializer, 
    FollowRequestSerializer, 
    SentFollowRequestSerializer,
    ForgotSerializer,
    ForgotPasswordVerifyTokenSerializer,
    ForgotPasswordConfirmSerializer,
    ChangeEmailSerializer,
    ChangePasswordSerializer
    )


from django.shortcuts import get_object_or_404

# every profile except deactivated accounts
def active_profiles():
    return Profile.objects.select_related("user").filter(user__is_active=True)

# PRIVATE PROFILES: followers can see 
def visible_profiles(user):
    profiles = active_profiles()

    if user.is_authenticated:
        followed_ids = Follow.objects.filter(follower=user).values("following")
        return profiles.filter(
            Q(visibility=Profile.Visibility.PUBLIC)
            | Q(user=user)
            | Q(user__in=followed_ids)
        )
    return profiles.filter(visibility=Profile.Visibility.PUBLIC)

# Annotate each profile with how the viewer relates to its user
def with_follow_flags(qs, viewer):
    # logged out/missing auth branch
    if not viewer.is_authenticated:
        return qs.annotate(
            is_self=Value(False, output_field=BooleanField()),
            is_followed=Value(False, output_field=BooleanField()),
            follows_you=Value(False, output_field=BooleanField()),
            is_requested=Value(False, output_field=BooleanField()),
        )

    # logged in branch
    return qs.annotate(
        is_self=ExpressionWrapper(Q(user=viewer), output_field=BooleanField()),
        # viewer -> profile user
        is_followed=Exists(Follow.objects.filter(follower=viewer, following=OuterRef("user"))),
        # profile user -> viewer
        follows_you=Exists(Follow.objects.filter(follower=OuterRef("user"), following=viewer)),
        # viewer has a pending request to the profile user
        is_requested=Exists(FollowRequest.objects.filter(requester=viewer, target=OuterRef("user"))),

    )

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

class ProfileListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return active_profiles()


class MyProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = OwnerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile



class ProfileByUsernameView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]

    def get_object(self):
        viewer = self.request.user
        username = self.kwargs["username"].strip().lower()
        qs = with_follow_flags(active_profiles(), viewer)
        profile = get_object_or_404(qs, user__username=username)
        self.can_view = visible_profiles(viewer).filter(pk=profile.pk).exists()
        return profile

    def get_serializer_class(self):
        # if profile is private and current user can_view == False
        if not getattr(self, "can_view", True):
            return LockedProfileSerializer
        if self.request.user.is_authenticated:
            return ProfileDetailSerializer
        return PublicProfileSerializer

# --- Follow Block ---

class FollowView(APIView):
    permission_classes = [IsAuthenticated]

    def _state(self, viewer, target, status=200):
        return Response({
            "is_followed": Follow.objects.filter(follower=viewer, following=target).exists(),
            "is_requested": FollowRequest.objects.filter(requester=viewer, target=target).exists(),  # FOLLOW REQUESTS
            "followers_count": target.follower_set.count(),
        }, status=status)

    def post(self, request, username):
        profile = get_object_or_404(active_profiles(), user__username=username.strip().lower())
        target = profile.user
        if target == request.user:
            return Response({"detail": "You can't follow yourself."}, status=400)
        if Follow.objects.filter(follower=request.user, following=target).exists():
            return self._state(request.user, target)
        if profile.visibility == Profile.Visibility.PRIVATE:
            _, created = FollowRequest.objects.get_or_create(requester=request.user, target=target)
            return self._state(request.user, target, status=202 if created else 200)
        _, created = Follow.objects.get_or_create(follower=request.user, following=target)
        return self._state(request.user, target, status=201 if created else 200)

    def delete(self, request, username):
        # Look up the user directly so you can unfollow someone who went private
        target = get_object_or_404(User, username=username.strip().lower())
        Follow.objects.filter(follower=request.user, following=target).delete()
        FollowRequest.objects.filter(requester=request.user, target=target).delete()  # FOLLOW REQUESTS: also cancels a pending request
        return self._state(request.user, target)

    
class FollowListView(generics.ListAPIView):
    serializer_class = FollowListSerializer
    permission_classes = [AllowAny]
    direction = None  # set in urls.py: "following" or "followers"

    def get_target(self):
        username = self.kwargs["username"].strip().lower()
        if username == "me":
            if not self.request.user.is_authenticated:
                raise NotAuthenticated()  # 401
            return self.request.user
        profile = get_object_or_404(visible_profiles(self.request.user), user__username=username)
        return profile.user

    def get_queryset(self):
        target = self.get_target()
        viewer = self.request.user

        if self.direction == "following":
            links, other_side = Follow.objects.filter(follower=target), "following"
        else:
            links, other_side = Follow.objects.filter(following=target), "follower"

        qs = (active_profiles()
              .filter(user__in=links.values(other_side))
              .annotate(followed_at=Subquery(
                  links.filter(**{other_side: OuterRef("user")}).values("created_at")[:1]))
              .order_by("-followed_at"))

        if viewer.is_authenticated:
            qs = qs.annotate(is_following=Exists(
                Follow.objects.filter(follower=viewer, following=OuterRef("user"))),
                # viewer has a pending request to this person
                is_requested=Exists(
                FollowRequest.objects.filter(requester=viewer, target=OuterRef("user"))))
        else:
            # logged-out viewers have no requests either 
            qs = qs.annotate(is_following=Value(False), is_requested=Value(False))
        return qs

class MutualFollowersView(FollowListView):
    """Users the viewer follows who also follow <username> ("Followed by ...")."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        target = self.get_target()
        viewer = self.request.user
        if target == viewer:
            return Profile.objects.none()

        target_followers = Follow.objects.filter(following=target)
        viewer_following = Follow.objects.filter(follower=viewer)

        return (visible_profiles(viewer)
                .filter(user__in=target_followers.values("follower"))
                .filter(user__in=viewer_following.values("following"))
                .annotate(
                    followed_at=Subquery(
                        target_followers.filter(follower=OuterRef("user")).values("created_at")[:1]),
                    is_following=Value(True, output_field=BooleanField()),  # by definition
                    is_requested=Value(False, output_field=BooleanField()),  # already follow everyone in this list, so no pending requests

                )
                .order_by("-followed_at"))


# --- Follow Requests Block ---
class FollowRequestListView(generics.ListAPIView):
    """Pending requests other people sent to me."""
    serializer_class = FollowRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (FollowRequest.objects
                .filter(target=self.request.user)
                .select_related("requester__profile"))


class FollowRequestDecisionView(APIView):
    """POST accepts <username>'s request, DELETE declines it."""
    permission_classes = [IsAuthenticated]

    def _get_request(self, request, username):
        return get_object_or_404(FollowRequest, target=request.user,
                                 requester__username=username.strip().lower())

    def post(self, request, username):
        follow_request = self._get_request(request, username)
        with transaction.atomic():
            Follow.objects.get_or_create(follower=follow_request.requester, following=request.user)
            follow_request.delete()
        return Response({"detail": "Request accepted."}, status=200)

    def delete(self, request, username):
        self._get_request(request, username).delete()
        return Response({"detail": "Request declined."}, status=200)

# follow requests that the current user sent
class SentFollowRequestListView(generics.ListAPIView):
    """Pending requests I sent to private accounts."""
    serializer_class = SentFollowRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (FollowRequest.objects
                .filter(requester=self.request.user, target__is_active=True)
                .select_related("target__profile"))


class SentFollowRequestCancelView(APIView):
    """DELETE cancels my pending request to <username>."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, username):
        get_object_or_404(FollowRequest, requester=request.user,
                          target__username=username.strip().lower()).delete()
        return Response({"detail": "Request cancelled."}, status=200)


# --- User Role Block ---

class UserRoleView(APIView):
    # RBAC: (For now) only serves the request for accessing the mod page
    permission_classes = [IsAuthenticated, IsModerator]

    def get(self, request):
        return Response(status=204)


class ForgotUsernameView(generics.GenericAPIView):
    serializer_class = ForgotSerializer

    def post(self, request):
        serializer = ForgotSerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.data["email"]
            user = User.objects.filter(email=email).first()
            
            if user is None:
                return Response({"detail": "Sent email"}, status=status.HTTP_200_OK)

            context = {
                "username": user.username,
            }

            html_content = render_to_string("emails/forgot_username.html", context=context)
            text_content = strip_tags(html_content)

            mail = EmailMultiAlternatives(
                "Forgot Username",
                text_content,
                None,
                [email]
            )
            mail.attach_alternative(html_content, "text/html")
            mail.send()

            return Response({"detail": "Sent email"}, status=status.HTTP_200_OK)
        return Response({"detail": "Bad request"}, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(generics.GenericAPIView):
    serializer_class = ForgotSerializer

    def post(self, request):
        serializer = ForgotSerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.data["email"]
            user = User.objects.filter(email=email).first()

            if user is None:
                return Response({"detail": "Sent email"}, status=status.HTTP_200_OK)

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            context = {
                "username": user.username,
                "action_url": f"https://quickbuckz.onrender.com/reset-password?uid={uid}&token={token}"
            }

            html_content = render_to_string("emails/forgot_password.html", context=context)
            text_content = strip_tags(html_content)

            mail = EmailMultiAlternatives(
                "Forgot Password",
                text_content,
                None,
                [email]
            )
            mail.attach_alternative(html_content, "text/html")
            mail.send()

            return Response({"detail": "Sent email"}, status=status.HTTP_200_OK)
        return Response({"detail": "Bad request"}, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordTokenVerifyView(generics.GenericAPIView):
    serializer_class = ForgotPasswordVerifyTokenSerializer

    def post(self, request):
        serializer = ForgotPasswordVerifyTokenSerializer(data=request.data)
        
        if serializer.is_valid():
            uid = serializer.data["uid"]
            token = serializer.data["token"]

            try:
                decoded_uid = force_str(urlsafe_base64_decode(uid))
                user = get_object_or_404(User, pk=decoded_uid)
            except:
                return Response({"detail": "Invalid uid"}, status=status.HTTP_400_BAD_REQUEST)

            is_valid = default_token_generator.check_token(user, token)

            if is_valid:
                return Response(status=status.HTTP_200_OK)
            else:
                return Response({"detail": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"detail": "Bad request"}, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordConfirmView(generics.GenericAPIView):
    serializer_class = ForgotPasswordConfirmSerializer

    def post(self, request):
        serializer = ForgotPasswordConfirmSerializer(data=request.data)

        serializer.is_valid(raise_exception=True) # Shows errors from password validator

        uid = serializer.validated_data["uid"]

        try:
            decoded_uid = force_str(urlsafe_base64_decode(uid))
            user = get_object_or_404(User, pk=decoded_uid)
        except:
            return Response({"detail": "Invalid uid"}, status=status.HTTP_400_BAD_REQUEST)
        
        token = serializer.validated_data["token"]

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)

        new_password = serializer.validated_data["new_password"]

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK)


class ChangeEmailView(generics.UpdateAPIView):
    serializer_class = ChangeEmailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_queryset(self):
        return self.get_object()

    def perform_update(self, serializer):
        email = serializer.validated_data.get("email")
        if self.request.user.email == email:
            raise ValidationError({"detail": "Cannot change your email to the same one"})

        if User.objects.filter(email=email).exists():
            raise ValidationError({"detail": "Another user is already using this email"})

        if not self.request.user.check_password(serializer.validated_data.get("password")):
            raise NotAuthenticated({"detail": "Password does not match user's credentials"})
            
        serializer.save()


class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_queryset(self):
        return self.get_object()

    def perform_update(self, serializer):
        old_password = serializer.validated_data.get("old_password")
        new_password = serializer.validated_data.get("new_password")

        if not self.request.user.check_password(old_password):
            raise NotAuthenticated({"detail": "Password does not match user's credentials"})

        if old_password == new_password:
            raise ValidationError({"detail": "Cannot set new password to the same one"})
            
        serializer.save()