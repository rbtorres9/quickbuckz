from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotAuthenticated
from .models import Profile, Follow
from django.contrib.auth import get_user_model
User = get_user_model()
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
    ProfileDetailSerializer
    )

from django.shortcuts import get_object_or_404

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


def visible_profiles(user):
    profiles = Profile.objects.select_related("user")
    if user.is_authenticated:
        return profiles.filter(Q(visibility=Profile.Visibility.PUBLIC) | Q(user=user))
     
    return profiles.filter(visibility=Profile.Visibility.PUBLIC)

def with_follow_flags(qs, viewer):
    """Annotate each profile with how the viewer relates to its user."""
    if not viewer.is_authenticated:
        return qs.annotate(
            is_self=Value(False, output_field=BooleanField()),
            is_followed=Value(False, output_field=BooleanField()),
            follows_you=Value(False, output_field=BooleanField()),
        )
    return qs.annotate(
        is_self=ExpressionWrapper(Q(user=viewer), output_field=BooleanField()),
        # viewer -> profile user
        is_followed=Exists(Follow.objects.filter(follower=viewer, following=OuterRef("user"))),
        # profile user -> viewer
        follows_you=Exists(Follow.objects.filter(follower=OuterRef("user"), following=viewer)),
    )

class MyProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = OwnerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile



class ProfileByUsernameView(generics.RetrieveAPIView):
    serializer_class = ProfileDetailSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        viewer = self.request.user
        username = self.kwargs["username"].strip().lower()
        qs = with_follow_flags(visible_profiles(viewer), viewer)
        return get_object_or_404(qs, user__username=username)

# --- FOLLOW BLOCK ---- 

class FollowView(APIView):
    permission_classes = [IsAuthenticated]

    def _state(self, viewer, target, status=200):
        return Response({
            "is_followed": Follow.objects.filter(follower=viewer, following=target).exists(),
            "followers_count": target.follower_set.count(),
        }, status=status)

    def post(self, request, username):
        # Following still requires a visible profile
        profile = get_object_or_404(visible_profiles(request.user), user__username=username.strip().lower())
        target = profile.user
        if target == request.user:
            return Response({"detail": "You can't follow yourself."}, status=400)
        _, created = Follow.objects.get_or_create(follower=request.user, following=target)
        return self._state(request.user, target, status=201 if created else 200)

    def delete(self, request, username):
        # Look up the user directly so you can unfollow someone who went private
        target = get_object_or_404(User, username=username.strip().lower())
        Follow.objects.filter(follower=request.user, following=target).delete()
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