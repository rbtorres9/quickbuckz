from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import Post, Comment, Report, ModerationLog
from .moderation import resolve_reports


@receiver(pre_delete, sender=Post)
def close_post_reports(sender, instance, **kwargs):
    resolve_reports(
        Report.objects.filter(post=instance),
        action=ModerationLog.Action.CONTENT_DELETED,
        source=ModerationLog.Source.SYSTEM,
        target_author=instance.author,
        target_content=instance.content,
        post_ref=instance.pk,
    )


@receiver(pre_delete, sender=Comment)
def close_comment_reports(sender, instance, **kwargs):
    resolve_reports(
        Report.objects.filter(comment=instance),
        action=ModerationLog.Action.CONTENT_DELETED,
        source=ModerationLog.Source.SYSTEM,
        target_author=instance.author,
        target_content=instance.content,
        post_ref=instance.post_id,
        comment_ref=instance.pk,
    )
