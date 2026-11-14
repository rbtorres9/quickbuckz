# Backend Changelog: Mod Removal Notifications

**Date:** 2026-11-13
**Feature:** Notify users when a moderator removes their post, comment, or profile content, with a custom message from the moderator.

---

## Summary

- When a moderator removes someone else's **post** or **comment**, the content owner receives a `content_removed` notification containing the moderator's message and a preview of the removed content.
- New endpoint lets moderators remove **profile content** (profile picture, banner, left/right side pictures, bio). The owner is notified the same way, and the profile's open reports are closed.
- Removal notifications are anonymous. They show as "Moderators" with no actor.
- Mod removals through the API **require a message** (max 500 chars). Admin-site removals fall back to a default message.
- Moderators can no longer remove posts/comments by admins or other moderators (same rank rule as bans and profile removal).

---

## Changes by File

### `moderation/models.py`
- **Added** `ModerationLog.Action.REMOVE_IN_PROFILE = "remove_in_profile", "Removed profile content"`.

### `notifications/models.py`
- **Added** `Notification.Type.CONTENT_REMOVED = "content_removed"`.
- **Changed** `actor` to `null=True, blank=True`. Mod notices have no actor, which keeps moderators anonymous.
- **Added fields:**
  - `mod_action` (`CharField(20)`): `remove_post` / `remove_comment` / `remove_in_profile`
  - `message` (`TextField`): the moderator's message to the user
  - `content_preview` (`CharField(100)`): a snapshot of what was removed
- The `post` FK is intentionally **not** used for removal notices: it is `on_delete=CASCADE`, so the notice would be deleted together with the post.

### `moderation/services.py`
- **Added** `DEFAULT_REMOVAL_MESSAGE = "We have removed your content."`, used when no message is supplied (admin site, system paths).
- **Added** `PROFILE_FIELDS`, which maps removable profile fields to user-facing labels:
  `profile_picture`, `banner`, `left_picture`, `right_picture`, `bio`.
- **Added** `notify_content_removed(user, *, action, message="", preview="")`, which creates an anonymous `content_removed` notification.
- **Changed** `delete_content(target, user, source=..., message="")`:
  - New optional `message` parameter (existing callers are unaffected).
  - After deleting, if it was a mod action (`is_mod_action`), notifies the owner with the message and a preview (`"(photo)"` for image-only posts).
  - Runs inside the existing `transaction.atomic()`, so a failed delete doesn't leave a stray notification.
- **Added** `remove_profile_content(target, moderator, *, items, message, source=...)`:
  - Clears the selected fields (`bio` → `""`, images → `None`). Already-empty fields are skipped.
  - Raises `ValueError` if nothing was removed or an unknown field is passed.
  - Saves only the changed columns (`update_fields`).
  - Closes the user's open **profile** reports and always writes a `REMOVE_IN_PROFILE` log entry (`always_log=True`).
  - Notifies the owner (preview lists the removed items, e.g. `Profile picture, Banner`).
  - Deletes image files via `transaction.on_commit`, so files are only removed once the DB change is committed.
  - Returns the list of removed field names.

### `posts/views.py`
- **Added** `mod_removal_message(request, author)`:
  - Returns `""` for non-mod actions (authors deleting their own content).
  - Raises `PermissionDenied` (403) if `can_moderate_user` fails: nobody removes an admin's content, and only admins remove moderators' content.
  - Raises `ValidationError` (400) if the message is missing or over 500 characters.
- **Changed** `PostViewSet.perform_destroy` and the comment `DELETE` branch of `PostViewSet.comment` to validate the message first, then pass it to `delete_content(..., message=message)`.
- **New imports:** `PermissionDenied`, `ValidationError`, `is_mod_action`, `can_moderate_user`.

### `moderation/serializers.py`
- **Added** `RemoveProfileContentSerializer`:
  - `items`: `MultipleChoiceField` limited to `PROFILE_FIELDS`, non-empty. Returned as an ordered list.
  - `message`: required, max 500 characters.
  - The field is named `items` (not `fields`) because `Serializer.fields` is reserved.

### `moderation/views.py`
- **Added** `ProfileContentRemoveView` (`IsAuthenticated`, `IsModerator`). It uses `get_moderatable_user`, so the existing rank rules apply.

### `moderation/urls.py`
- **Added** route `profile/<str:username>/remove-content/` → `ProfileContentRemoveView` (name `profile-remove-content`).

### `notifications/serializers.py`
- **Added** `mod_action`, `message`, `content_preview` to `NotificationSerializer.fields`.
- **Changed** `get_actor_name` to return `"Moderators"` when `actor` is `None` (previously this would crash on null actors).

---

## API Reference

### Remove a post (mod)
```
DELETE /api/posts/<id>/
Content-Type: application/json

{ "message": "We have removed your content. Reason: spam" }
```

### Remove a comment (mod)
```
DELETE /api/posts/<post_id>/comment/?comment_id=<id>
Content-Type: application/json

{ "message": "..." }
```

Authors deleting their own content send no body (unchanged).

| Status | When |
|---|---|
| 204 | Removed |
| 400 | `{"message": [...]}`: message missing or over 500 chars |
| 403 | `{"detail": "You can't remove content from this account."}`: rank rule |

### Remove profile content (mod)
```
POST /api/profile/<username>/remove-content/
Content-Type: application/json

{ "items": ["profile_picture", "bio"], "message": "..." }
```

| Status | Body |
|---|---|
| 200 | `{"removed": ["profile_picture", "bio"]}` |
| 400 | Invalid/empty `items`, missing `message`, or `{"detail": "Nothing to remove: those items are already empty."}` |
| 403 | Not a moderator, or can't moderate this account |

### Notification payload (`GET /api/notifications/`)
```json
{
  "id": 24,
  "type": "content_removed",
  "actor_name": "Moderators",
  "mod_action": "remove_comment",
  "message": "We have removed your content. Reason: spam",
  "content_preview": "the removed comment text",
  "read": false,
  "created_at": "2026-11-14T06:37:12Z"
}
```
`actor_username` and `actor_avatar` are omitted when there is no actor.

---

## Behavior Matrix

| Who / where | Message required | Owner notified | Reports closed | Log action |
|---|---|---|---|---|
| Mod removes post (app) | Yes | Yes | Post's reports | `remove_post` |
| Mod removes comment (app) | Yes | Yes | Comment's reports | `remove_comment` |
| Mod removes profile content (app) | Yes | Yes | User's profile reports | `remove_in_profile` |
| Admin site: report outcome remove post/comment | No (default used) | Yes | Yes | `remove_post` / `remove_comment` |
| Author deletes own content | No | No | Yes | `content_deleted` |

---

## Known Limitations

- **Admin site:** profile content removal is not offered as a report outcome (`OUTCOMES_BY_TYPE` in `moderation/forms.py` lists only Dismiss/Deactivate for profiles).
- **Rank rule edge case:** a moderator who owns a post can't remove an admin's or another moderator's comment on that post. Post owners who aren't moderators still can, because for them it isn't a mod action.
- **Reporter notifications** (telling the reporter their report was acted on) are not implemented. The nullable `actor` change supports adding them later.
