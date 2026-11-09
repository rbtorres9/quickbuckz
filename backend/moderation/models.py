from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from accounts.models import User
from posts.models import Post, Comment

class Report(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    class TargetType(models.TextChoices):
        POST = "post", "Post"
        COMMENT = "comment", "Comment"
        PROFILE = "profile", "Profile"

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
            # POST
            models.UniqueConstraint(
                fields=["post", "reporter"],
                condition=models.Q(status="open", comment__isnull=True),
                name="one_open_post_report_per_user",
            ),
            # COMMENT
            models.UniqueConstraint(
                fields=["comment", "reporter"],
                condition=models.Q(status="open", comment__isnull=False),
                name="one_open_comment_report_per_user",
            ),
            # PROFILE
            models.UniqueConstraint(
                fields=["target_author", "reporter"],
                condition=models.Q(status="open", target_type="profile"),
                name="one_open_profile_report_per_user",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}

        if self.target_type == self.TargetType.PROFILE:
            if self._state.adding and not self.target_author_id:
                errors["target_author"] = "A profile report needs the reported user."
            if self._state.adding and self.target_author_id == self.reporter_id:
                errors["reporter"] = "Users can't report their own profile."
        elif self._state.adding and not self.post_id and not self.comment_id:
            errors["post"] = "A report needs a post or a comment."

        target = self.comment if self.comment_id else (self.post if self.post_id else None)
        if self._state.adding and target is not None and target.author_id == self.reporter_id:
            errors["reporter"] = "Users can't report their own content."

        if self.comment_id and self.post_id and self.comment.post_id != self.post_id:
            errors["comment"] = "This comment belongs to a different post."

        if self._state.adding:
            if self.reporter_id and self.reporter.is_deactivated:
                errors["reporter"] = "This account is deactivated and can't file reports."
            if target is not None:
                author = target.author
            elif self.target_type == self.TargetType.PROFILE and self.target_author_id:
                author = self.target_author
            else:
                author = None
            if author is not None and author.is_deactivated:
                field = "comment" if self.comment_id else ("post" if self.post_id else "target_author")
                errors[field] = "This account is deactivated, so it and its content can't be reported."

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

        elif (self.target_type == self.TargetType.PROFILE
              and self.target_author_id and not self.target_content):
            user = self.target_author
            name = user.get_full_name()
            self.target_content = f"@{user.username}" + (f" ({name})" if name else "")
            profile = getattr(user, "profile", None)
            if profile and profile.bio:
                self.target_content += f"\n{profile.bio}"

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
        DEACTIVATE = "deactivate", "Deactivated account"
        RESTRICT = "restrict", "Restricted feature"
        LIFT_RESTRICTION = "lift_restriction", "Lifted restriction"
        EXTEND_RESTRICTION = "extend_restriction", "Changed restriction end date"


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


# Account restrictions
class AccountRestrictionQuerySet(models.QuerySet):
    def active(self):
        return self.filter(lifted_at__isnull=True).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
        )


class AccountRestriction(models.Model):
    class Kind(models.TextChoices):
        ACCOUNT = "account", "Account"
        POSTING = "posting", "Posting"
        COMMENTING = "commenting", "Commenting"
        INTERACTING = "interacting", "Liking and following"
        REPORTING = "reporting", "Reporting"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="restrictions"
    )
    kind = models.CharField(max_length=12, choices=Kind.choices, db_index=True)
    reason = models.CharField(max_length=200)
    expires_at = models.DateTimeField(null=True, blank=True)  # empty = permanent

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="restrictions_given",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    lifted_at = models.DateTimeField(null=True, blank=True)
    lifted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="restrictions_lifted",
    )

    objects = AccountRestrictionQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self):
        if self.lifted_at is not None:
            return False
        return self.expires_at is None or self.expires_at > timezone.now()

    def summary(self):
        until = f" until {self.expires_at:%Y-%m-%d %H:%M} UTC" if self.expires_at else " (permanent)"
        return f"{self.get_kind_display()}{until}: {self.reason}"

    def __str__(self):
        return f"{self.user.username} - {self.summary()}"


class BanListUser(User):
    class Meta:
        proxy = True
        verbose_name = "ban list entry"
        verbose_name_plural = "ban list"
