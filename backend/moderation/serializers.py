from rest_framework import serializers

from posts.models import Post, Comment
from .models import Report, ModerationLog
from .services import PROFILE_FIELDS


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
    reviewed_by = serializers.SerializerMethodField()
    reviewed_source = serializers.ReadOnlyField(source="resolution.source", default=None)
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
                  "reviewed_by", "reviewed_at", "reviewed_source", "outcome",
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

    # RBAC: Admin actions through admin panel hides their username
    def get_reviewed_by(self, report):
        resolution = report.resolution
        if resolution is None:
            return None
        if resolution.source == ModerationLog.Source.ADMIN:
            return "Admin"
        return resolution.moderator.username if resolution.moderator else None



class DeactivateSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=200,
        error_messages={"blank": "Please give a reason.", "required": "Please give a reason."},
    )


class DeactivationLogSerializer(serializers.ModelSerializer):
    details = serializers.CharField(source="target_content", read_only=True)
    moderator = serializers.SerializerMethodField()

    class Meta:
        model = ModerationLog
        fields = ["id", "action", "details", "moderator", "source", "created_at"]

    def get_moderator(self, obj):
        if obj.source == ModerationLog.Source.ADMIN:
            return "Admin"
        return obj.moderator.username if obj.moderator else None


class DeactivatedUserSerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)
    deactivation_count = serializers.IntegerField(read_only=True)
    last_deactivated = serializers.DateTimeField(read_only=True, allow_null=True)



class RemoveProfileContentSerializer(serializers.Serializer):
    items = serializers.MultipleChoiceField(
        choices=list(PROFILE_FIELDS.items()),
        allow_empty=False,
        error_messages={"empty": "Pick at least one item to remove."},
    )
    message = serializers.CharField(
        max_length=500,
        error_messages={"blank": "Write a message to the user.", "required": "Write a message to the user."},
    )

    def validate_items(self, value):
        return [name for name in PROFILE_FIELDS if name in value]  # set -> list in a fixed order
