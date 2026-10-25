from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import AllowAny
from accounts.views import visible_profiles
from django.db.models import Prefetch


from .models import Post, Like, Comment
from .serializers import PostSerializer, CommentSerializer, PostDetailSerializer


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by("-created_at")
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PostDetailSerializer
        return PostSerializer

    def get_queryset(self):
      qs = Post.objects.all().order_by("-created_at")
      if self.action == "retrieve":
          qs = qs.prefetch_related(
              Prefetch("comments", queryset=Comment.objects.select_related("author__profile"))
          )
      return qs

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
        return Response({
            "liked": created,
            "likes_count": post.likes.count(),
        })

    @action(detail=True, methods=["get", "post"])
    def comment(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            comments = post.comments.all()
            serializer = CommentSerializer(comments, many=True)
            return Response(serializer.data)
        
        if request.method == 'POST':
            serializer = CommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(post=post, author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

            

class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        username = self.kwargs["username"].strip().lower()
        profile = get_object_or_404(
            visible_profiles(self.request.user), user__username=username
        )
        return (
            Post.objects.filter(author=profile.user)
            .select_related("author")
            .order_by("-created_at")
        )