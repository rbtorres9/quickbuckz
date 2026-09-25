from django.shortcuts import render

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from .models import Profile, Post
from django.contrib.auth.models import User
from .serializers import ProfileSerializer, PostSerializer, RegisterSerializer


class ProfileListView(generics.ListCreateAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# ListAPIView is DRF's pre-built version of handle_request 
# — it already knows how to handle a GET request and return a list
# queryset = Profile.objects.all() 
# — this is the data your "function" operates on (all Profile rows)
# serializer_class = ProfileSerializer 
# — this tells the view to run each Profile object through the book_to_dict-style conversion 
# before returning it as JSON

class PostListView(generics.ListCreateAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

class MyProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile

    