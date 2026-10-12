from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from .validators import validate_username_rules

class User(AbstractUser):
    username = models.CharField(
        max_length=20,
        unique=True,
        validators=[validate_username_rules],
        error_messages={"unique": "A user with that username already exists."},
    )
    email = models.EmailField(unique=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="unique_email_ci"),
            models.UniqueConstraint(Lower("username"), name="unique_username_ci"),
        ]

    def clean(self):
        super().clean()
        self.username = self.username.strip().lower()
        if self.email:
            self.email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class Profile(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to="profiles/", blank=True, null=True)
    visibility = models.CharField(
        max_length=10, choices=Visibility.choices, default=Visibility.PUBLIC
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.user.username


class AccountSecurity(models.Model):
    """Private, owner/admin-only data. Intentionally empty for now."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="security"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Security for {self.user.username}"


