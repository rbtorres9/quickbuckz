from django.shortcuts import render

from rest_framework import generics
from .models import Profile, Post
from .serializers import ProfileSerializer, PostSerializer

class ProfileListView(generics.ListAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer

# ListAPIView is DRF's pre-built version of handle_request 
# — it already knows how to handle a GET request and return a list
# queryset = Profile.objects.all() 
# — this is the data your "function" operates on (all Profile rows)
# serializer_class = ProfileSerializer 
# — this tells the view to run each Profile object through the book_to_dict-style conversion 
# before returning it as JSON

class PostListView(generics.ListAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer