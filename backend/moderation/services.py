from django.utils import timezone
from django.db import transaction
from django.db.models import BooleanField, ExpressionWrapper, Q

from accounts.models import User
from posts.models import Comment
from .models import ModerationLog, Report
from notifications.models import Notification

DEFAULT_REMOVAL_MESSAGE = "We have removed your content."

# Profile items a mod can remove: field name -> label shown to users
PROFILE_FIELDS = {
    "profile_picture": "Profile picture",
    "banner": "Banner",
    "left_picture": "Left picture",
    "right_picture": "Right picture",
    "bio": "Bio",
}

# Tell user the mods removed their content. Anonymous: no actor
def notify_content_removed(user, *, action, message="", preview=""):
    Notification.objects.create(
        recipient=user,
        actor=None,
        type=Notification.Type.CONTENT_REMOVED,
        mod_action=action,
        message=message.strip() or DEFAULT_REMOVAL_MESSAGE,
        content_preview=preview[:100],
    )


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

def delete_content(target, user, source=ModerationLog.Source.APP, message=""):
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

        # notify the owner when a mod removed it
        if by_mod:
            notify_content_removed(
                target.author,
                action=action,
                message=message,
                preview=target.content or "(photo)",
            )


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

# Deactivate the account, close all open reports on it, and log it.
def deactivate_user(target, moderator, *, reason, source=ModerationLog.Source.APP):
    with transaction.atomic():
        now = timezone.now()
        # only active accounts can be banned; self-deactivated ones must log back in first
        updated = (User.objects.filter(pk=target.pk, is_active=True)
                   .update(is_active=False, deactivated_at=now,
                           deactivation_type=User.DeactivationType.BAN))
        if not updated:
            raise ValueError("This account is already deactivated.")
        target.is_active = False
        target.deactivated_at = now
        target.deactivation_type = User.DeactivationType.BAN
        return resolve_reports(
            Report.objects.filter(target_author=target),
            action=ModerationLog.Action.DEACTIVATE,
            source=source,
            moderator=moderator,
            target_author=target,
            target_content=f"Reason: {reason}",
            always_log=True,
        )


# Reactivate the account and log it. Returns False if it was already active.
def reactivate_user(target, moderator, *, source=ModerationLog.Source.APP):
    with transaction.atomic():
        # mods only lift bans; self-deactivated users come back by logging in
        updated = (User.objects.filter(pk=target.pk, is_active=False)
                   .exclude(deactivation_type=User.DeactivationType.SELF)
                   .update(is_active=True, deactivated_at=None, deactivation_type=""))
        if updated:
            target.is_active = True
            target.deactivated_at = None
            target.deactivation_type = ""
            ModerationLog.objects.create(
                moderator=moderator,
                action=ModerationLog.Action.REACTIVATE,
                source=source,
                target_author=target,
                target_content="Reactivated account",
            )
    return bool(updated)

# IDs of deactivated users, as a subquery for `__in` filters
def deactivated_users():
    return User.objects.filter(is_active=False).values("pk")

# Annotate each comment with `author_deactivated` (True while its author is deactivated)
def with_author_status(comments):
    return comments.annotate(author_deactivated=ExpressionWrapper(
        Q(author__is_active=False), output_field=BooleanField(),
    ))


# Close report with the chosen outcome using the existing helpers
def review_report(report, reviewer, *, outcome, source=ModerationLog.Source.APP):
    Action = ModerationLog.Action
    if outcome == Action.DISMISS:
        dismiss_reports(report, reviewer, source=source)
    elif outcome == Action.REMOVE_POST:
        delete_content(report.post, reviewer, source=source)
    elif outcome == Action.REMOVE_COMMENT:
        delete_content(report.comment, reviewer, source=source)
    elif outcome == Action.DEACTIVATE:
        deactivate_user(report.target_author, reviewer, reason=report.reason, source=source)


# cannot moderate yourself or an admin if you are only a mod
def can_moderate_user(actor, target):
    if actor == target or target.is_admin:
        return False
    if target.is_mod:
        return actor.is_admin
    return actor.is_mod

# log it -> notify the user
def remove_profile_content(target, moderator, *, items, message, source=ModerationLog.Source.APP):
    profile = target.profile
    removed, old_files = [], []

    # clear the chosen profile items
    for name in items:
        if name not in PROFILE_FIELDS:
            raise ValueError(f"Unknown profile item: {name}")
        value = getattr(profile, name)
        if not value:
            continue  # already empty
        if name == "bio":
            profile.bio = ""
        else:
            old_files.append((value.storage, value.name))
            setattr(profile, name, None)
        removed.append(name)

    if not removed:
        raise ValueError("Nothing to remove: those items are already empty.")

    labels = ", ".join(PROFILE_FIELDS[name] for name in removed)
    with transaction.atomic():
        profile.save(update_fields=removed)
        #  close the profile's open reports
        resolve_reports(
            Report.objects.filter(target_type=Report.TargetType.PROFILE, target_author=target),
            action=ModerationLog.Action.REMOVE_IN_PROFILE,
            source=source,
            moderator=moderator,
            target_author=target,
            target_content=f"Removed: {labels}\nMessage: {message}",
            always_log=True,
        )
        notify_content_removed(target, action=ModerationLog.Action.REMOVE_IN_PROFILE,
                               message=message, preview=labels)
        # delete the image files only once the database change is saved
        for storage, file_name in old_files:
            transaction.on_commit(lambda s=storage, n=file_name: s.delete(n))
    return removed

