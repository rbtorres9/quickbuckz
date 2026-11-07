from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotAuthenticated
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
    )


from django.shortcuts import get_object_or_404

# PRIVATE PROFILES: followers can see (changed) 
def visible_profiles(user):
    profiles = Profile.objects.select_related("user")
    if user.is_authenticated:
        followed_ids = Follow.objects.filter(follower=user).values("following")
        return profiles.filter(
            Q(visibility=Profile.Visibility.PUBLIC)
            | Q(user=user)
            | Q(user__in=followed_ids)
        )
    return profiles.filter(visibility=Profile.Visibility.PUBLIC)


def with_follow_flags(qs, viewer):
    """Annotate each profile with how the viewer relates to its user."""
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
        profiles = Profile.objects.select_related("user")
        user = self.request.user
        if user.is_authenticated:
            return profiles.filter(
                Q(visibility=Profile.Visibility.PUBLIC) | Q(user=user)
            )
        return profiles.filter(visibility=Profile.Visibility.PUBLIC)



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
        qs = with_follow_flags(Profile.objects.select_related("user"), viewer)
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
        profile = get_object_or_404(Profile.objects.select_related("user"), user__username=username.strip().lower())
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

        qs = (visible_profiles(viewer)
              .filter(user__in=links.values(other_side))
              .annotate(followed_at=Subquery(
                  links.filter(**{other_side: OuterRef("user")}).values("created_at")[:1]))
              .order_by("-followed_at"))

        if viewer.is_authenticated:
            qs = qs.annotate(is_following=Exists(
                Follow.objects.filter(follower=viewer, following=OuterRef("user"))))
        else:
            qs = qs.annotate(is_following=Value(False))
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

# --- User Role Block ---

class UserRoleView(APIView):
    # RBAC: (For now) only serves the request for accessing the mod page
    permission_classes = [IsAuthenticated, IsModerator]

    def get(self, request):
        return Response(status=204)
