from django.db.models import Prefetch, Exists, OuterRef, Value, BooleanField
from django.shortcuts import get_object_or_404
 
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import (
    AllowAny,
    BasePermission,
    IsAuthenticatedOrReadOnly,
    SAFE_METHODS,
)
 
from accounts.views import visible_profiles
from accounts.permissions import IsAuthorOrModerator
 
from .models import Post, Like, Comment
from .serializers import PostSerializer, CommentSerializer, PostDetailSerializer

 
def with_like_flag(qs, viewer):
    """Annotate each post with whether the viewer has liked it."""
    if not viewer.is_authenticated:
        return qs.annotate(is_liked=Value(False, output_field=BooleanField()))
    return qs.annotate(
        is_liked=Exists(Like.objects.filter(user=viewer, post=OuterRef("pk")))
    )
 
 
class PostViewSet(viewsets.ModelViewSet):
    # No class-level queryset: get_queryset() builds it, and urls.py
    # registers this viewset with basename="post".
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrModerator]
 
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
 
    def get_serializer_class(self):
        if self.action == "retrieve":
            return PostDetailSerializer
        return PostSerializer
 
    def get_queryset(self):
        viewer = self.request.user
        qs = Post.objects.select_related("author").order_by("-created_at")

        mod_delete = (self.action == "destroy" and viewer.is_authenticated and viewer.is_mod)
        if not mod_delete:
            qs = qs.filter(author__in=visible_profiles(viewer).values("user"))

        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch("comments", queryset=Comment.objects.select_related("author__profile"))
            )
        
        return with_like_flag(qs, viewer)
 
    def get_permissions(self):
        # Anyone logged in can like or comment; only the author can edit or delete
        if self.action in ("like", "comment"):
            return [IsAuthenticatedOrReadOnly()]
        return super().get_permissions()
 
    @action(detail=True, methods=["post", "delete"])
    def like(self, request, pk=None):
        post = self.get_object()
        status_code = 200
        if request.method == "POST":
            _, created = Like.objects.get_or_create(user=request.user, post=post)
            if created:
                status_code = 201
        else:
            Like.objects.filter(user=request.user, post=post).delete()
        return Response({
            "is_liked": Like.objects.filter(user=request.user, post=post).exists(),
            "likes_count": post.likes.count(),
        }, status=status_code)
 
    @action(detail=True, methods=["get", "post", "delete"])
    def comment(self, request, pk=None):
        post = self.get_object()
        context = self.get_serializer_context()  # lets avatars become full URLs
 
        if request.method == "GET":
            comments = post.comments.select_related("author__profile")
            serializer = CommentSerializer(comments, many=True, context=context)
            return Response(serializer.data)

        if request.method == "DELETE":
            comment_id = request.query_params.get("comment_id")
            if not comment_id:
                return Response(
                    {"detail": "comment_id is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            comment = get_object_or_404(post.comments.all(), pk=comment_id)

            if request.user != comment.author and request.user != post.author and not request.user.is_mod:
                return Response(
                    {"detail": "You can't delete this comment."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
 
        serializer = CommentSerializer(data=request.data, context=context)
        serializer.is_valid(raise_exception=True)
        serializer.save(post=post, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
 
 
class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [AllowAny]
 
    def get_queryset(self):
        viewer = self.request.user
        username = self.kwargs["username"].strip().lower()
        profile = get_object_or_404(visible_profiles(viewer), user__username=username)
        qs = (Post.objects
              .filter(author=profile.user)
              .select_related("author")
              .order_by("-created_at"))
        return with_like_flag(qs, viewer)
 