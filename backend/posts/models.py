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

    def __str__(self):
        text = self.content if len(self.content) <= 20 else f"{self.content[:20]}..."
        return f"{self.author.username}: {text}"


class Report(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    class TargetType(models.TextChoices):
        POST = "post", "Post"
        COMMENT = "comment", "Comment"

    post = models.ForeignKey(
        Post,
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="reports"
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="reports"
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="reports_made"
    )
    
    reason = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    #
    resolution = models.ForeignKey(
        "ModerationLog", on_delete=models.SET_NULL,
        null=True, 
        blank=True, 
        related_name="resolved_reports",
    )

    # logging: snapshot of what was reported 
    target_type = models.CharField(
        max_length=7, choices=TargetType.choices, default=TargetType.POST
    )
    target_author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reports_against",
    )
    target_content = models.TextField(blank=True)

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



    def clean(self):
        super().clean()
        errors = {}

        if self._state.adding and not self.post_id and not self.comment_id:
            errors["post"] = "A report needs a post or a comment."

        target = self.comment if self.comment_id else (self.post if self.post_id else None)
        if self._state.adding and target is not None and target.author_id == self.reporter_id:
            errors["reporter"] = "Users can't report their own content."

        if self.comment_id and self.post_id and self.comment.post_id != self.post_id:
            errors["comment"] = "This comment belongs to a different post."




        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.comment_id:
            self.post_id = self.comment.post_id

        target = self.comment if self.comment_id else (self.post if self.post_id else None)
        if target is not None:
            self.target_type = self.TargetType.COMMENT if self.comment_id else self.TargetType.POST
            self.target_author_id = target.author_id
            self.target_content = target.content

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Report #{self.pk} on {self.target_type} ({self.get_status_display()})"  # REPORT LOG



# store mod actions both on and off the moderation page
class ModerationLog(models.Model):
    class Action(models.TextChoices):
        REMOVE_POST = "remove_post", "Removed post"
        REMOVE_COMMENT = "remove_comment", "Removed comment"
        DISMISS = "dismiss", "Dismissed reports"
        CONTENT_DELETED = "content_deleted", "Content deleted (not by a mod)" 
    
    class Source(models.TextChoices):
        APP = "app", "App"
        ADMIN = "admin", "Admin site"
        SYSTEM = "system", "System"


    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="moderation_actions",  
    )

    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.APP, db_index=True)

    target_author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="moderation_received",
    )

    target_content = models.TextField(blank=True)
    post_ref = models.PositiveIntegerField(null=True, blank=True)
    comment_ref = models.PositiveIntegerField(null=True, blank=True)
    reports_closed = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


    @property
    def via_reports(self):
        return self.reports_closed > 0
    
    def __str__(self):
        who = self.moderator.username if self.moderator else "deleted user"
        return f"{who}: {self.get_action_display()}"
