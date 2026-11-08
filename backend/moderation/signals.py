from django.db.models.signals import pre_delete
from django.dispatch import receiver

from posts.models import Post, Comment
from .models import ModerationLog, Report
from .services import resolve_reports


# Close a post's/comment's open reports when it is deleted by anything other than delete_content()
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