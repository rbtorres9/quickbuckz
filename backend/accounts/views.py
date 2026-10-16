from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from .models import Profile
from django.contrib.auth import get_user_model
User = get_user_model()
from django.db.models import Q
from .serializers import (
    PublicProfileSerializer, OwnerProfileSerializer, RegisterSerializer,
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

class MyProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = OwnerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile



class ProfileByUsernameView(generics.RetrieveUpdateAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny]

    def get_object(self):
            username = self.kwargs["username"].strip().lower()
            return get_object_or_404(visible_profiles(self.request.user), user__username=username)
    

