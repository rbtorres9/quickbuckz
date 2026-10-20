from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotAuthenticated
from .models import Profile, Follow
from django.contrib.auth import get_user_model
User = get_user_model()
from django.db.models import Q, Exists, OuterRef, Subquery, Value
from .serializers import PublicProfileSerializer, OwnerProfileSerializer, RegisterSerializer, FollowListSerializer
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

class MyProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = OwnerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile



class ProfileByUsernameView(generics.RetrieveAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny]

    def get_object(self):
            username = self.kwargs["username"].strip().lower()
            return get_object_or_404(visible_profiles(self.request.user), user__username=username)
    

# --- FOLLOW BLOCK ---- 

class FollowToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        profile = get_object_or_404(visible_profiles(request.user), user__username=username.strip().lower())
        target = profile.user
        if target == request.user:
            return Response({"detail": "You can't follow yourself."}, status=400)
        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if not created:
            follow.delete()
        return Response({"following": created})

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