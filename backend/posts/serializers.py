from rest_framework import serializers

from moderation.services import with_author_status
from .models import Post, Comment

from django.contrib.auth import get_user_model
User = get_user_model()

UNAVAILABLE_COMMENT_NOTE = "This comment is from an account that is no longer available."  # DEACTIVATED CONTENT


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

    def to_representation(self, comment):
        data = super().to_representation(comment)
        unavailable = getattr(comment, "author_deactivated", None)
        if unavailable is None:  # comment not loaded through with_author_status()
            unavailable = comment.author.is_deactivated
        data["author_unavailable"] = unavailable
        if unavailable:
            data["author"] = None
            data["content"] = UNAVAILABLE_COMMENT_NOTE
        return data


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
            with_author_status(post.comments.select_related("author__profile"))
            .order_by("-created_at")[: self.COMMENT_PREVIEW_LIMIT]
        )
        return CommentSerializer(reversed(list(latest)), many=True, context=self.context).data


class PostDetailSerializer(PostSerializer):
    comments = CommentSerializer(many=True, read_only=True)  # all comments

    class Meta(PostSerializer.Meta):
        pass
