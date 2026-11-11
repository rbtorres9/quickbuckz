from django.db import transaction
from django.db.models import Exists, OuterRef  # DEACTIVATED CONTENT
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from posts.models import Comment
from .models import AccountRestriction, ModerationLog, Report

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
    if report.target_type == Report.TargetType.PROFILE:
        reports = Report.objects.filter(
            target_type=Report.TargetType.PROFILE, target_author_id=report.target_author_id
        )
    else:
        reports = Report.objects.filter(post_id=report.post_id, comment_id=report.comment_id)

    entry = resolve_reports(
        reports,
        action=ModerationLog.Action.DISMISS,
        source=source,
        moderator=user,
        target_author=report.target_author,
        target_content=report.target_content,
        post_ref=report.post_id,
        comment_ref=report.comment_id,
    )
    return entry.reports_closed if entry else 0

def restrict_user(target, moderator, *, kind, reason, expires_at=None,
                  source=ModerationLog.Source.APP):
    """Create a restriction, close open profile reports on the user, and log it."""
    problem = check_new_restriction(target, kind)
    if problem:
        raise ValueError(problem)
    with transaction.atomic():
        restriction = AccountRestriction.objects.create(
            user=target, kind=kind, reason=reason,
            expires_at=expires_at, created_by=moderator, source=source,
        )
        is_account = kind == AccountRestriction.Kind.ACCOUNT
        resolve_reports(
            Report.objects.filter(target_type=Report.TargetType.PROFILE, target_author=target),
            action=ModerationLog.Action.DEACTIVATE if is_account else ModerationLog.Action.RESTRICT,
            source=source,
            moderator=moderator,
            target_author=target,
            target_content=restriction.summary(),
            always_log=True,
        )
    return restriction

def lift_restrictions(target, moderator, *, kind, source=ModerationLog.Source.APP):
    """Lift every active restriction of `kind` on the user. Returns how many were lifted."""
    with transaction.atomic():
        lifted = (AccountRestriction.objects.active()
                  .filter(user=target, kind=kind)
                  .update(lifted_at=timezone.now(), lifted_by=moderator, lifted_source=source))
        if lifted:
            ModerationLog.objects.create(
                moderator=moderator,
                action=ModerationLog.Action.LIFT_RESTRICTION,
                source=source,
                target_author=target,
                target_content=f"Lifted {kind} restriction",
            )
    return lifted

def deactivated_users():
    """IDs of users with an active account restriction, as a subquery for `__in` filters."""
    return (AccountRestriction.objects.active()
            .filter(kind=AccountRestriction.Kind.ACCOUNT)
            .values("user"))


def with_author_status(comments):
    """Annotate each comment with `author_deactivated` (True while its author is deactivated)."""
    return comments.annotate(author_deactivated=Exists(
        AccountRestriction.objects.active().filter(
            kind=AccountRestriction.Kind.ACCOUNT, user=OuterRef("author"),
        )
    ))


def check_new_restriction(user, kind):
    """Why `kind` can't be added to `user` right now, or None if it can."""
    Kind = AccountRestriction.Kind
    if user.active_restriction(kind):
        return ("This user already has an active restriction of that type. "
                "Change its end date or lift it instead.")
    if kind != Kind.ACCOUNT and user.active_restriction(Kind.ACCOUNT):
        return "This account is deactivated. Lift the deactivation before adding feature restrictions."
    return None

def restrict_user_many(target, moderator, *, kinds, reason, expires_at=None,
                       source=ModerationLog.Source.APP):
    """Add several restrictions at once with a shared reason and end date (one row + log entry each)."""
    with transaction.atomic():
        return [
            restrict_user(target, moderator, kind=kind, reason=reason,
                          expires_at=expires_at, source=source)
            for kind in kinds
        ]
    
def _until_text(value):
    return f"{value:%Y-%m-%d %H:%M} UTC" if value else "permanent"


def lift_restriction(restriction, moderator, *, source=ModerationLog.Source.APP):
    """Lift one restriction and log it. Returns False if it was no longer active."""
    with transaction.atomic():
        lifted = (AccountRestriction.objects.active()
                  .filter(pk=restriction.pk)
                  .update(lifted_at=timezone.now(), lifted_by=moderator, lifted_source=source))
        if lifted:
            ModerationLog.objects.create(
                moderator=moderator,
                action=ModerationLog.Action.LIFT_RESTRICTION,
                source=source,
                target_author=restriction.user,
                target_content=f"Lifted: {restriction.summary()}",
            )
    return bool(lifted)


def change_restriction_end(restriction, moderator, *, expires_at, source=ModerationLog.Source.APP):
    """Move an active restriction's end date (None = permanent) and log old -> new."""
    with transaction.atomic():
        current = AccountRestriction.objects.select_for_update().get(pk=restriction.pk)
        old = current.expires_at
        if old == expires_at:
            return current
        current.expires_at = expires_at
        current.save(update_fields=["expires_at"])
        ModerationLog.objects.create(
            moderator=moderator,
            action=ModerationLog.Action.EXTEND_RESTRICTION,
            source=source,
            target_author=current.user,
            target_content=(f"{current.get_kind_display()}: {_until_text(old)} -> "
                            f"{_until_text(expires_at)} ({current.reason})"),
        )
    return current


def review_report(report, reviewer, *, outcome, kind=None, expires_at=None,
                  source=ModerationLog.Source.APP):
    """Close `report` with the chosen outcome using the existing helpers."""
    Action = ModerationLog.Action
    if outcome == Action.DISMISS:
        dismiss_reports(report, reviewer, source=source)
    elif outcome == Action.REMOVE_POST:
        delete_content(report.post, reviewer, source=source)
    elif outcome == Action.REMOVE_COMMENT:
        delete_content(report.comment, reviewer, source=source)
    elif outcome in (Action.DEACTIVATE, Action.RESTRICT):
        if outcome == Action.DEACTIVATE:
            kind = AccountRestriction.Kind.ACCOUNT
        restrict_user(report.target_author, reviewer, kind=kind, reason=report.reason,
                      expires_at=expires_at, source=source)


def ensure_not_restricted(user, kind):
    restriction = user.active_restriction(kind)
    if restriction is None:
        return
    if restriction.expires_at:
        until = f" until {restriction.expires_at:%Y-%m-%d %H:%M} UTC"
    else:
        until = " until a moderator lifts it"
    raise PermissionDenied(
        f"{restriction.get_kind_display()} is restricted on your account{until}."
    )


def can_moderate_user(actor, target):
    if actor == target or target.is_admin:
        return False
    if target.is_mod:
        return actor.is_admin
    return actor.is_mod