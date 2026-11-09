from django.utils import timezone
from rest_framework import serializers

from posts.models import Post, Comment
from .models import AccountRestriction, Report

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


# --- ACCOUNT RESTRICTIONS  ---
class AccountRestrictionSerializer(serializers.ModelSerializer):
    created_by = serializers.ReadOnlyField(source="created_by.username", default=None)
    lifted_by = serializers.ReadOnlyField(source="lifted_by.username", default=None)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = AccountRestriction
        fields = ["id", "kind", "reason", "expires_at", "is_active",
                  "created_by", "created_at", "lifted_at", "lifted_by"]
        read_only_fields = ["id", "is_active", "created_by", "created_at",
                            "lifted_at", "lifted_by"]

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please give a reason.")
        return value

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError("End date must be in the future.")
        return value


class RestrictionEndSerializer(serializers.Serializer):
    expires_at = serializers.DateTimeField(allow_null=True)  # null = permanent

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError("End date must be in the future.")
        return value