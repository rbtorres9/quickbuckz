from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    content = models.TextField()
    image = models.ImageField(upload_to="posts/images/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.author.username}: {self.content[:30]}"


class Like(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "post"],
                name="unique_like_per_user_post",
            ),
        ]


class Comment(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    content = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class Report(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        DISMISSED = "dismissed", "Dismissed"

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reports")
    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, null=True, blank=True, related_name="reports"
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports_made"
    )
    reason = models.CharField(max_length=200)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reports_reviewed",
        limit_choices_to=models.Q(role__in=["mod", "admin"]) | models.Q(is_superuser=True),
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["post", "reporter"],
                condition=models.Q(status="open", comment__isnull=True),
                name="one_open_post_report_per_user",
            ),
            models.UniqueConstraint(
                fields=["comment", "reporter"],
                condition=models.Q(status="open", comment__isnull=False),
                name="one_open_comment_report_per_user",
            ),
        ]

    @property
    def target_type(self):
        return "comment" if self.comment_id else "post"

    def clean(self):
        super().clean()
        errors = {}

        if self.comment_id and self.post_id and self.comment.post_id != self.post_id:
            errors["comment"] = "This comment belongs to a different post."

        if self.reviewed_by_id and not self.reviewed_by.is_mod:
            errors["reviewed_by"] = "Only moderators or admins can review reports."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.comment_id:
            self.post_id = self.comment.post_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Report #{self.pk} on {self.target_type} {self.comment_id or self.post_id}"
