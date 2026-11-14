from django.db import models
from django.conf import settings

class Notification(models.Model):
    class Type(models.TextChoices):
        FOLLOW = "follow"
        LIKE = "like"
        COMMENT = "comment"
        FOLLOW_REQUEST = "follow_request"
        CONTENT_REMOVED = "content_removed"

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    type = models.CharField(max_length=20, choices=Type.choices)
    post = models.ForeignKey("posts.Post", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    comment = models.ForeignKey("posts.Comment", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    mod_action = models.CharField(max_length=20, blank=True)
    message = models.TextField(blank=True)
    content_preview = models.CharField(max_length=100, blank=True)


    class Meta:
        ordering = ["-created_at"] # '-' triggers descending order, so created_at will show the newest first
        indexes = [models.Index(fields=["recipient", "read"])]
