from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from accounts.models import Follow
from posts.models import Like, Comment
from .models import Notification

@receiver(post_save, sender=Like)
def on_like(sender, instance, created, **kwargs):
    if created and instance.user_id != instance.post.author_id:
        Notification.objects.create(recipient_id=instance.post.author_id, actor_id=instance.user_id,
                                    type=Notification.Type.LIKE, post_id=instance.post_id)

@receiver(post_delete, sender=Like)
def on_unlike(sender, instance, **kwargs):
    # Like/unlike/like shouldn't stack up duplicate notifications
    Notification.objects.filter(type=Notification.Type.LIKE, actor_id=instance.user_id,
                                post_id=instance.post_id).delete()

@receiver(post_save, sender=Comment)
def on_comment(sender, instance, created, **kwargs):
    if created and instance.author_id != instance.post.author_id:
        Notification.objects.create(recipient_id=instance.post.author_id, actor_id=instance.author_id,
                                    type=Notification.Type.COMMENT, post_id=instance.post_id, comment=instance)

@receiver(post_save, sender=Follow)
def on_follow(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(recipient_id=instance.following_id, actor_id=instance.follower_id,
                                    type=Notification.Type.FOLLOW)

@receiver(post_delete, sender=Follow)
def on_unfollow(sender, instance, **kwargs):
    Notification.objects.filter(type=Notification.Type.FOLLOW, actor_id=instance.follower_id,
                                recipient_id=instance.following_id).delete()