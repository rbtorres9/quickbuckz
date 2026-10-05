from django.shortcuts import render

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from .models import Profile, Post
from django.contrib.auth import get_user_model
User = get_user_model()
from django.db.models import Q
from .serializers import (
    PublicProfileSerializer, OwnerProfileSerializer, PostSerializer, RegisterSerializer,
)



class ProfileListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        profiles = Profile.objects.all()
        user = self.request.user
        if user.is_authenticated:
            return profiles.filter(
                Q(visibility=Profile.Visibility.PUBLIC) | Q(user=user)
            )
        return profiles.filter(visibility=Profile.Visibility.PUBLIC)

class PostListView(generics.ListCreateAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

class ProfileListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        profiles = Profile.objects.all()
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