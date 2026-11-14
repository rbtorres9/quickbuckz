# Backend Changelog: Moderation Log Endpoint

**Date:** 2026-11-14
**Feature:** Read-only API for the moderation log, so moderators can see the history of moderation actions on `/mod`.

---

## Summary

- New endpoint `GET /api/mod-log/` lists every `ModerationLog` entry, newest first, 50 per page.
- Moderators and admins only (`IsAuthenticated` + `IsModerator`). Regular users get `403`.
- Filters: action (one or more), moderator username, target username, source.
- Admin-site actions keep the existing RBAC rule: they show as `"Admin"` and never match a moderator username search.
- No model changes, no migration.

---

## Changes by File

### `moderation/serializers.py`
- **Added** `ModerationLogSerializer` (read-only):
  - `action_label`: from `get_action_display()` (e.g. "Removed post"), so the frontend doesn't keep its own copy of the labels.
  - `moderator`: a `SerializerMethodField`. Returns `"Admin"` when `source == "admin"`, the moderator's username for app actions, or `null` for `content_deleted` / `system` entries (no moderator by design).
  - `target_author`: username of the user acted on, `null` if that account was deleted (`SET_NULL`).
  - `via_reports`: the model's existing property (`reports_closed > 0`), worked out on the server.
  - Fields: `id`, `action`, `action_label`, `source`, `moderator`, `target_author`, `target_content`, `post_ref`, `comment_ref`, `reports_closed`, `via_reports`, `created_at`.

### `moderation/views.py`
- **New imports:** `ListAPIView` (`rest_framework.generics`), `PageNumberPagination` (`rest_framework.pagination`), `ModerationLogSerializer`.
- **Added** `ModerationLogPagination` (`page_size = 50`). Set per view, because `settings.py` has no global `DEFAULT_PAGINATION_CLASS`, so other endpoints stay unpaginated.
- **Added** `ModerationLogView(ListAPIView)`:
  - `select_related("moderator", "target_author")`, so a page loads both users in one query.
  - `order_by("-created_at", "-id")`. The `-id` tie-breaker keeps page order stable when two entries share a timestamp. Without it, an entry could repeat or be skipped between pages.
  - `?action=`: comma-separated, only real `ModerationLog.Action` values are kept, unknown values are ignored.
  - `?moderator=`: trimmed, lowercased, leading `@` removed. Matches `moderator__username` and **excludes** `source=admin`, so searching an admin's username can't reveal their admin-site actions.
  - `?target=`: same clean-up, matches `target_author__username`.
  - `?source=`: `app`, `admin` or `system`. Any other value is ignored.

### `moderation/urls.py`
- **Added** route `mod-log/` → `ModerationLogView` (name `mod-log`). `config/urls.py` already includes `moderation.urls` under `api/`, so the full path is `/api/mod-log/`.

---

## API Reference

### List moderation log
```
GET /api/mod-log/
GET /api/mod-log/?page=2
GET /api/mod-log/?action=deactivate,reactivate
GET /api/mod-log/?moderator=<username>&target=<username>
GET /api/mod-log/?source=admin
```

| Param | Values | Notes |
|---|---|---|
| `page` | `1`, `2`, ... | 50 per page. A page past the end returns `404 Invalid page`. |
| `action` | `remove_post`, `remove_comment`, `remove_in_profile`, `dismiss`, `content_deleted`, `deactivate`, `reactivate` | Comma-separated. Unknown values are ignored. |
| `moderator` | username | App actions by that moderator only. `@` and capitals are allowed. |
| `target` | username | Actions about that user. |
| `source` | `app`, `admin`, `system` | Where the action came from. |

Response:
```json
{
  "count": 123,
  "next": "http://.../api/mod-log/?page=2",
  "previous": null,
  "results": [
    {
      "id": 57,
      "action": "remove_post",
      "action_label": "Removed post",
      "source": "app",
      "moderator": "modname",
      "target_author": "dummy",
      "target_content": "the removed post text",
      "post_ref": 41,
      "comment_ref": null,
      "reports_closed": 2,
      "via_reports": true,
      "created_at": "2026-11-14T19:20:31Z"
    }
  ]
}
```

| Status | When |
|---|---|
| 200 | Listed |
| 403 | `{"detail": "Moderator access required."}`: not a moderator or admin |
| 404 | `{"detail": "Invalid page."}`: page past the end |

### `moderator` value by entry type

| Entry | `source` | `moderator` |
|---|---|---|
| Mod action in the app | `app` | mod's username |
| Action in the Django admin site | `admin` | `"Admin"` |
| Author / post owner deleted reported content | `app` | `null` |
| Cascade (e.g. account deletion) | `system` | `null` |

---

## Test Checklist

| Action | Expected |
|---|---|
| `GET /api/mod-log/` as a mod | `200`, `{count, next, previous, results}`, newest first |
| `GET /api/mod-log/` as a regular user | `403 "Moderator access required."` |
| `?action=deactivate,reactivate` | Only ban / unban entries |
| `?moderator=<mod>` | That mod's app actions, no admin-site rows |
| `?target=<user>` | Every action about that user |
| `?source=admin` | Admin-site actions, `"moderator": "Admin"` |
| `content_deleted` entry | `"moderator": null` |
| `?page=999` | `404 Invalid page` |

---

## Known Limitations

- **Deleted accounts:** if a target account was deleted, its rows show `"target_author": null`. They still appear in the unfiltered list but can't be found with `?target=`.
- **Admin Active box:** banning / unbanning by toggling the user's Active box in the admin site writes no log entry (decided earlier), so those changes only appear in the ban list.
- **Invalid action only:** `?action=foo` (no valid value) is ignored and returns the full log, not an empty list.
