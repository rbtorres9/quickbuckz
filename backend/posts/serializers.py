from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Post, Comment, Report

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "profile_picture"]

    def get_profile_picture(self, user):
        profile = getattr(user, "profile", None)
        if not profile or not profile.profile_picture:
            return None
        url = profile.profile_picture.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class CommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "post", "author", "content", "created_at"]
        read_only_fields = ["id", "post", "author", "created_at"]


class PostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.username")
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    comments = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True, default=False)
    
    COMMENT_PREVIEW_LIMIT = 3

    class Meta:
        model = Post
        fields = ["id", "author", "content", "image", "created_at",
                  "likes_count", "comments_count", "comments", "is_liked"]
        read_only_fields = ["id", "author", "created_at"]

    def get_comments(self, post):
        # Latest 3 comments, returned oldest -> newest so they read top to bottom
        latest = (
            post.comments.select_related("author__profile")
            .order_by("-created_at")[: self.COMMENT_PREVIEW_LIMIT]
        )
        return CommentSerializer(reversed(list(latest)), many=True, context=self.context).data


class PostDetailSerializer(PostSerializer):
    comments = CommentSerializer(many=True, read_only=True)  # all comments

    class Meta(PostSerializer.Meta):
        pass



# --- REPORT ---
class ReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "reason", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please give a reason.")
        return value


class ReportedPostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.username")

    class Meta:
        model = Post
        fields = ["id", "author", "content", "image", "created_at"]


class ReportedCommentSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.username")

    class Meta:
        model = Comment
        fields = ["id", "author", "content", "created_at"]


class ReportSerializer(serializers.ModelSerializer):
    type = serializers.ReadOnlyField(source="target_type")
    reporter = serializers.ReadOnlyField(source="reporter.username")
    reviewed_by = serializers.ReadOnlyField(source="resolution.moderator.username", default=None)
    reviewed_at = serializers.ReadOnlyField(source="resolution.created_at", default=None)
    outcome = serializers.ReadOnlyField(source="resolution.action", default=None)
    target_author = serializers.ReadOnlyField(source="target_author.username", default=None)

    # mod check -> get_can_review(...) 
    can_review = serializers.SerializerMethodField()

    post = ReportedPostSerializer(read_only=True)
    comment = ReportedCommentSerializer(read_only=True)

    class Meta:
        model = Report
        fields = ["id", "type", "reason", "status", "reporter", "created_at",
                  "reviewed_by", "reviewed_at", "outcome",
                  "target_author", "target_content",
                  "can_review", 
                  "post", "comment"]
        read_only_fields = fields

    # a mod cannot take action on their reported posts through the mod view 
    def get_can_review(self, report):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        return report.target_author_id != user.id
