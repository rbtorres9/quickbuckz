from django.db.models import Prefetch, Exists, OuterRef, Value, BooleanField
from django.shortcuts import get_object_or_404
 
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.permissions import (
    AllowAny,
    BasePermission,
    IsAuthenticatedOrReadOnly,
    SAFE_METHODS,
    IsAuthenticated,
)
from accounts.permissions import IsAuthorOrModerator
from accounts.views import visible_profiles

from moderation.services import delete_content, is_mod_action, with_author_status, can_moderate_user

from .models import Post, Like, Comment
from .serializers import PostSerializer, CommentSerializer, PostDetailSerializer



def with_like_flag(qs, viewer):
    """Annotate each post with whether the viewer has liked it."""
    if not viewer.is_authenticated:
        return qs.annotate(is_liked=Value(False, output_field=BooleanField()))
    return qs.annotate(
        is_liked=Exists(Like.objects.filter(user=viewer, post=OuterRef("pk")))
    )

def mod_removal_message(request, author):
    """A mod removing someone else's content must include a message (max 500 chars)."""
    if not is_mod_action(request.user, author):
        return ""

    if not can_moderate_user(request.user, author):
        raise PermissionDenied("You can't remove content from this account.")

    data = request.data if isinstance(request.data, dict) else {}
    message = str(data.get("message", "")).strip()
    if not message:
        raise ValidationError({"message": "Write a message to the user before removing their content."})
    if len(message) > 500:
        raise ValidationError({"message": "Keep the message under 500 characters."})
    return message

 
 
class PostViewSet(viewsets.ModelViewSet):
    # No class-level queryset: get_queryset() builds it, and urls.py
    # registers this viewset with basename="post".
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrModerator]
 
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    # REPORT LOG: close reports before deleting a post
    def perform_destroy(self, instance):
        message = mod_removal_message(self.request, instance.author)
        delete_content(instance, self.request.user, message=message)  # MOD LOG

 
    def get_serializer_class(self):
        if self.action == "retrieve":
            return PostDetailSerializer
        return PostSerializer
 
    def get_queryset(self):
        viewer = self.request.user
        qs = Post.objects.select_related("author").order_by("-created_at")

        is_mod = viewer.is_authenticated and viewer.is_mod
        mod_delete = is_mod and (
            self.action == "destroy"
            or (self.action == "comment" and self.request.method == "DELETE")
        )
        if not mod_delete:
            qs = qs.filter(author__in=visible_profiles(viewer).values("user"))

        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch("comments", queryset=with_author_status(
                    Comment.objects.select_related("author__profile")))
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
            comments = with_author_status(post.comments.select_related("author__profile"))  # DEACTIVATED CONTENT
                        
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


            # REPORT LOG: close reports before deleting a comment
            message = mod_removal_message(request, comment.author) # pass the mod's message
            delete_content(comment, request.user, message=message)  # MOD LOG
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