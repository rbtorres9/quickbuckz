from django.db.models import Prefetch, Exists, OuterRef, Value, BooleanField
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from django.utils import timezone

 
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import (
    AllowAny,
    BasePermission,
    IsAuthenticatedOrReadOnly,
    SAFE_METHODS,
    IsAuthenticated,
)
from accounts.permissions import IsModerator, IsAuthorOrModerator
 
from accounts.views import visible_profiles
from accounts.permissions import IsAuthorOrModerator
 
from .models import Post, Like, Comment, Report
from .serializers import (
    PostSerializer, 
    CommentSerializer, 
    PostDetailSerializer,
    ReportSerializer,
)

 
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

        is_mod = viewer.is_authenticated and viewer.is_mod
        mod_delete = is_mod and (
            self.action == "destroy"
            or (self.action == "comment" and self.request.method == "DELETE")
        )
        if not mod_delete:
            qs = qs.filter(author__in=visible_profiles(viewer).values("user"))

        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch("comments", queryset=Comment.objects.select_related("author__profile"))
            )
        
        return with_like_flag(qs, viewer)
 
    def get_permissions(self):
        # Anyone logged in can like or comment; only the author can edit or delete
        if self.action in ("like", "comment", "report"):  # REPORTS: added "report"
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

    @action(detail=True, methods=["post"])
    def report(self, request, pk=None):
        post = self.get_object()

        comment = None
        comment_id = request.data.get("comment_id")
        if comment_id:
            comment = get_object_or_404(post.comments.all(), pk=comment_id)

        target_author = comment.author if comment else post.author
        if target_author == request.user:
            return Response(
                {"detail": "You can't report your own content."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        already = Report.objects.filter(
            post=post, comment=comment, reporter=request.user, status=Report.Status.OPEN
        ).exists()
        if already:
            return Response({"detail": "You already reported this."}, status=status.HTTP_200_OK)

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(post=post, comment=comment, reporter=request.user)
        except IntegrityError:
            return Response({"detail": "You already reported this."}, status=status.HTTP_200_OK)
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


class ReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsModerator]

    def get_queryset(self):
        qs = Report.objects.select_related(
            "post__author", "comment__author", "reporter", "reviewed_by"
        )

        status_param = self.request.query_params.get("status", Report.Status.OPEN)
        if status_param != "all":
            qs = qs.filter(status=status_param)

        type_param = self.request.query_params.get("type")
        if type_param == "post":
            qs = qs.filter(comment__isnull=True)
        elif type_param == "comment":
            qs = qs.filter(comment__isnull=False)

        return qs

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        report = self.get_object()
        if report.status != Report.Status.OPEN:
            return Response(
                {"detail": "This report is already closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dismissed = Report.objects.filter(
            post_id=report.post_id,
            comment_id=report.comment_id,
            status=Report.Status.OPEN,
        ).update(
            status=Report.Status.DISMISSED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        return Response({"dismissed": dismissed}, status=status.HTTP_200_OK)
