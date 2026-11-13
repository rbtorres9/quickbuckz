from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    actor_username = serializers.ReadOnlyField(source="actor.username")
    actor_name = serializers.SerializerMethodField()
    actor_avatar = serializers.ImageField(source="actor.profile.profile_picture", read_only=True)
    post_preview = serializers.SerializerMethodField()
    comment_text = serializers.SerializerMethodField()
    is_following_actor = serializers.BooleanField(read_only=True)  # from the view's annotation
    is_requested_actor = serializers.BooleanField(read_only=True)  # from the view's annotation


    class Meta:
        model = Notification
        fields = ["id", "type", "actor_username", "actor_name", "actor_avatar", "post",
                  "post_preview", "comment_text", "read", "created_at", "is_following_actor",
                  "is_requested_actor"]

    def get_actor_name(self, obj):
        return obj.actor.get_full_name() or obj.actor.username

    def get_post_preview(self, obj):
        return obj.post.content[:60] if obj.post else None

    def get_comment_text(self, obj):
        return obj.comment.content if obj.comment else None