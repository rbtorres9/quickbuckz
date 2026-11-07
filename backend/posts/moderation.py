from django.db import transaction

from .models import Comment, ModerationLog, Report


def is_mod_action(user, content_author):
    """A mod acting on someone else's content (not their own)."""
    return (
        user is not None
        and user.is_authenticated
        and user.is_mod
        and user != content_author
    )


def resolve_reports(reports, *, action, source, moderator=None, target_author=None,
                    target_content="", post_ref=None, comment_ref=None, always_log=False):
    """Close the open reports in `reports` and record the outcome. Returns the log entry or None."""
    with transaction.atomic():
        ids = list(
            reports.filter(status=Report.Status.OPEN)
            .select_for_update()
            .values_list("pk", flat=True)
        )
        if not ids and not always_log:
            return None

        entry = ModerationLog.objects.create(
            moderator=moderator,
            action=action,
            source=source,
            target_author=target_author,
            target_content=target_content,
            post_ref=post_ref,
            comment_ref=comment_ref,
            reports_closed=len(ids),
        )
        Report.objects.filter(pk__in=ids).update(status=Report.Status.CLOSED, resolution=entry)
        return entry


def delete_content(target, user, source=ModerationLog.Source.APP):
    """Delete a post or comment: close its reports, log the outcome, then delete."""
    is_comment = isinstance(target, Comment)
    reports = Report.objects.filter(comment=target) if is_comment else Report.objects.filter(post=target)

    by_mod = is_mod_action(user, target.author)
    if by_mod:
        action = ModerationLog.Action.REMOVE_COMMENT if is_comment else ModerationLog.Action.REMOVE_POST
    else:
        action = ModerationLog.Action.CONTENT_DELETED

    with transaction.atomic():
        resolve_reports(
            reports,
            action=action,
            source=source,
            moderator=user if by_mod else None,
            target_author=target.author,
            target_content=target.content,
            post_ref=target.post_id if is_comment else target.pk,
            comment_ref=target.pk if is_comment else None,
            always_log=by_mod,
        )
        target.delete()


def dismiss_reports(report, user, source=ModerationLog.Source.APP):
    """Dismiss every open report on the same post/comment as `report`. Returns how many closed."""
    entry = resolve_reports(
        Report.objects.filter(post_id=report.post_id, comment_id=report.comment_id),
        action=ModerationLog.Action.DISMISS,
        source=source,
        moderator=user,
        target_author=report.target_author,
        target_content=report.target_content,
        post_ref=report.post_id,
        comment_ref=report.comment_id,
    )
    return entry.reports_closed if entry else 0
