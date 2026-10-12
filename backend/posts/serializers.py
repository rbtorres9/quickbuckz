from rest_framework import serializers
from .models import Post, Comment


class PostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.username")
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)

    class Meta:
        model = Post
        fields = ["id", "author", "content", "created_at", "likes_count"]
        read_only_fields = ["id", "author", "created_at"]

class CommentSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.username")

    class Meta:
        model = Comment
        fields = ["id", "post", "author", "content", "created_at"]
        read_only_fields = ["id", "post", "author", "created_at"]
