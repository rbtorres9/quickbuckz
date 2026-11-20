from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from .validators import *

import uuid
from pathlib import Path

# Saves a profile picture
def profile_picture_path(instance, filename):
    ext = Path(filename).suffix.lower()
    return f"profiles/profile_pictures/{instance.user_id}/{uuid.uuid4().hex}{ext}"

# saves profile banner
def banner_path(instance, filename):
    ext = Path(filename).suffix.lower()
    return f"profiles/banner/{instance.user_id}/{uuid.uuid4().hex}{ext}"

# saves left picture
def left_picture_path(instance, filename):
    ext = Path(filename).suffix.lower()
    return f"profiles/left_pictures/{instance.user_id}/{uuid.uuid4().hex}{ext}"

# saves right picture
def right_picture_path(instance, filename):
    ext = Path(filename).suffix.lower()
    return f"profiles/right_pictures/{instance.user_id}/{uuid.uuid4().hex}{ext}"

#the following class makes different user values like usernames and emails unique from other users
class User(AbstractUser):
    #following defines a username field
    username = models.CharField(
        max_length=20,
        unique=True,
        validators=[validate_username_rules],
        error_messages={"unique": "A user with that username already exists."},
    )
    email = models.EmailField(unique=True)


    # RBAC
    # adds a role field to a user like a mod admin or user 
    class Role(models.TextChoices):
        USER = "user", "User"
        MODERATOR = "mod", "Moderator"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER, db_index=True)

    deactivated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    class DeactivationType(models.TextChoices):
        BAN = "ban", "Banned by moderator"
        SELF = "self", "Deactivated by user"

    deactivation_type = models.CharField(
        max_length=10, choices=DeactivationType.choices, blank=True, default="", db_index=True,
    )


    #checks if user is admin
    @property
    def is_admin(self):
        return self.is_superuser or self.role == self.Role.ADMIN

    #checks if user is mod
    @property
    def is_mod(self):
        return self.is_admin or self.role == self.Role.MODERATOR


    @property
    def is_deactivated(self):
        return not self.is_active

    @property
    def is_self_deactivated(self):
        return not self.is_active and self.deactivation_type == self.DeactivationType.SELF

    # Anything inactive that isn't self-deactivated counts as a ban (incl. old rows with no type)
    @property
    def is_banned(self):
        return not self.is_active and self.deactivation_type != self.DeactivationType.SELF


    #enforces case insensitive uniqueness to usernames and emails
    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="unique_email_ci"),
            models.UniqueConstraint(Lower("username"), name="unique_username_ci"),
        ]

    #forces a username and email to be lower case, save does this while also seting a superuser's role to admin upon creation
    def clean(self):
        super().clean()
        self.username = self.username.strip().lower()
        if self.email:
            self.email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        # RBAC: Superusers are always admin
        if self.is_superuser:
            self.role = self.Role.ADMIN
        if self.email:
            self.email = self.email.strip().lower()
        # Keep deactivated_at in step with is_active when it changes through save()
        # (e.g. the admin "Active" checkbox). deactivate_user()/reactivate_user() use
        # .update() and set the field themselves.
        update_fields = kwargs.get("update_fields")
        if self.pk and (update_fields is None or "is_active" in update_fields):
            was_active = (User.objects.filter(pk=self.pk)
                          .values_list("is_active", flat=True).first())
            if was_active is not None and was_active != self.is_active:
                # >>> SELF-DEACTIVATE >>>
                if self.is_active:
                    self.deactivated_at = None
                    self.deactivation_type = ""
                else:
                    self.deactivated_at = timezone.now()
                    # the admin "Active" checkbox is a mod action, so it counts as a ban
                    self.deactivation_type = self.deactivation_type or self.DeactivationType.BAN
                if update_fields is not None:
                    kwargs["update_fields"] = {*update_fields, "deactivated_at", "deactivation_type"}
                # <<< SELF-DEACTIVATE <<<
        
        super().save(*args, **kwargs)



#one to one extension of the user that stores bio, profile picture, banner, and other user information
class Profile(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to=profile_picture_path, blank=True, null=True)
    banner = models.ImageField(upload_to=banner_path, blank=True, null=True)
    visibility = models.CharField(
        max_length=10, choices=Visibility.choices, default=Visibility.PUBLIC
    )
    created_at = models.DateTimeField(auto_now_add=True)

    birthday = models.DateField(blank=True, null=True, validators=[validate_minimum_age])

    theme = models.CharField(default="classic", max_length=256)
    site_theme = models.CharField(default="classic", max_length=256)

    right_picture = models.ImageField(upload_to=right_picture_path, blank=True, null=True)
    right_picture_flip = models.BooleanField(default=False)
    right_picture_tile = models.BooleanField(default=False)

    left_picture = models.ImageField(upload_to=left_picture_path, blank=True, null=True)
    left_picture_flip = models.BooleanField(default=False)
    left_picture_tile = models.BooleanField(default=False)
    

    def __str__(self):
        return self.user.username

#stores user account data that is secure and only accessible to account owners and admins
class AccountSecurity(models.Model):
    self_deactivated_at = models.DateTimeField(null=True, blank=True)
    self_reactivated_at = models.DateTimeField(null=True, blank=True)
    self_deactivation_count = models.PositiveIntegerField(default=0)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="security"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Security for {self.user.username}"


#tracks which accounts follow who
class Follow(models.Model):
    follower = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following_set")
    following = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="follower_set")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "following"], name="unique_follow"),
            models.CheckConstraint(condition=~models.Q(follower=models.F("following")), name="no_self_follow"),
        ]
        #CheckConstraint line means a check to ensure a user cannot follow themselves


# A pending request to follow a private profile. It becomes a Follow when the target accepts.
class FollowRequest(models.Model):
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_follow_requests")
    target = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_follow_requests")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["requester", "target"], name="unique_follow_request"),
            models.CheckConstraint(condition=~models.Q(requester=models.F("target")), name="no_self_follow_request"),
        ]



# Hides both users from each other.
class Block(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="unique_block"),
            models.CheckConstraint(condition=~models.Q(blocker=models.F("blocked")), name="no_self_block"),
        ]

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"

