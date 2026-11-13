# Update: Account Deactivation Replaces Per-Feature Restrictions

This update follows `ban_list_and_deactivated_content_changes_110926.md`, `profile_reports_and_account_restrictions_changes.md` and `moderation_app_migration.md`, and **replaces the restriction system they describe**. Per-feature restrictions (posting, commenting, liking/following, reporting) and timed suspensions are gone. Moderation now has one action: **deactivate an account** (ban), or **reactivate** it (unban). Bans are permanent until reactivated.

The goal was a smaller codebase. The `AccountRestriction` model, its custom JWT authentication class, the per-feature checks in every view, the restriction serializers and endpoints, and most of the admin ban list are removed.

**Status**
- **Verified:**
  - all backend Python files compile, and no code still references `AccountRestriction` or the removed functions
  - the changed frontend files parse as valid JSX
  - `manage.py check` passes locally
  - migration `moderation/0005` was generated and applied locally (it only alters `ModerationLog.action` and deletes `AccountRestriction`)
- **Not tested yet:** over HTTP end to end, and on Postgres/Render (Neon). Render applies `0005` on the next deploy, because `build.sh` runs `migrate`.

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| What a ban is | An `AccountRestriction` row with `kind=account` | Django's own `User.is_active = False` |
| Partial restrictions | Posting, commenting, liking/following, reporting | **Removed**. Only the whole account can be banned |
| Timed suspensions | `expires_at`, editable end dates | **Removed**. Bans last until a moderator or admin reactivates the account |
| Lockout | Custom `RestrictionAwareJWTAuthentication`, a custom auth rule and a backend override | Built-in: simplejwt and `ModelBackend` already reject inactive users |
| Ban history | Restriction rows (who, why, until, lifted by) | `ModerationLog` entries with action `deactivate` / `reactivate` |
| API | `.../restrictions/`, `.../restrictions/lift/`, `.../restrictions/<pk>/`, `/api/restrictions/` | `.../status/`, `.../ban/` (POST/DELETE), `/api/profiles/banlist/` |
| Admin Ban list | Full page: add, lift, change end dates, history, filters, bulk lift | Read-only list of banned accounts, each linking to the user's page |
| Banning in the admin | Ban list page (logged) | The **Active** checkbox on the user's page (**not logged**) |
| Frontend mod tools | Read-only restriction list and history | **Ban list** and an **account status** page with **Ban** / **Reactivate** buttons |
| Admin post/comment deletes | `CloseReportsOnDeleteMixin`, logged as "Removed post/comment" by the admin | Plain Django delete. `signals.py` closes reports and logs them as "Content deleted" (`system`) |

---

## 2. How deactivation works

A deactivated account is any user with `is_active = False`. `User.is_deactivated` still exists and now just returns `not self.is_active`, so every existing caller works.

| Effect | Where it comes from |
|---|---|
| Can't log in (username or email) | `ModelBackend.user_can_authenticate` (inherited by `EmailOrUsernameBackend`) |
| Existing access tokens stop working on the next request (401 "User is inactive") | simplejwt `JWTAuthentication.get_user` |
| Can't refresh a token | simplejwt's default `USER_AUTHENTICATION_RULE` |
| Can't log in to the Django admin | Django's `AdminSite.has_permission` (needs `is_active` and `is_staff`) |
| Profile and posts hidden from everyone | `active_profiles()` → `.filter(user__is_active=True)`. This is used by `visible_profiles()`, so it covers the feed, profiles, follow and report lookups |
| Comments shown as *"This comment is from an account that is no longer available."* | `with_author_status()` annotates `author_deactivated` from `author__is_active` |
| Can't report, can't be reported | `Report.clean` (unchanged; uses `is_deactivated`) and the admin report dropdowns (`deactivated_users()`) |

The frontend handles a banned user being logged out on its own. Their next request gets a 401, the refresh fails, and `AuthContext` logs them out.

### Who can ban whom
`can_moderate_user(actor, target)` is unchanged and applies to the API and report review:
- nobody can ban themselves;
- nobody can ban an admin;
- only admins can ban moderators;
- moderators and admins can ban regular users.

The admin **Active** checkbox does **not** apply this rule (see section 6).

---

## 3. Backend changes by file

### `accounts/models.py`
- `active_restriction()` is removed.
- `is_deactivated` is now `return not self.is_active`. It no longer runs a query or does a local import.

### `accounts/backends.py`
- The `user_can_authenticate` override is removed. `ModelBackend` already checks `is_active`.

### `config/settings.py`
- `DEFAULT_AUTHENTICATION_CLASSES` is back to `rest_framework_simplejwt.authentication.JWTAuthentication`.
- `SIMPLE_JWT["USER_AUTHENTICATION_RULE"]` is removed (the default rule is used).

### `moderation/authentication.py`
- Deleted.

### `moderation/services.py`
| Function | Change |
|---|---|
| `deactivate_user(target, moderator, *, reason, source)` | **New.** `UPDATE ... WHERE is_active = true`, so two moderators acting at once can't double-ban. Raises `ValueError("This account is already deactivated.")` when nothing changed. Closes the user's open **profile** reports and writes a `deactivate` log entry with `target_content = "Reason: <reason>"`. Returns the log entry |
| `reactivate_user(target, moderator, *, source)` | **New.** `UPDATE ... WHERE is_active = false`, and writes a `reactivate` log entry. Returns `True`/`False` |
| `deactivated_users()` | Now `User.objects.filter(is_active=False).values("pk")` |
| `with_author_status(comments)` | Now `ExpressionWrapper(Q(author__is_active=False))`, a join on the author instead of a subquery per comment |
| `review_report(...)` | `kind` and `expires_at` are removed. The `DEACTIVATE` outcome calls `deactivate_user` with the report's reason |
| Removed | `restrict_user`, `restrict_user_many`, `lift_restrictions`, `lift_restriction`, `change_restriction_end`, `check_new_restriction`, `ensure_not_restricted`, `_until_text` |

### Per-feature checks removed
- `posts/views.py`:
  - the `ensure_not_restricted` calls in `perform_create`, `like` and `comment` are removed;
  - `perform_update` is removed (it only called `serializer.save()`).
- `accounts/views.py`: the follow check is removed, and `active_profiles()` is rewritten (above).
- `moderation/views.py`: the reporting checks in `PostReportView` and `ProfileReportView` are removed.

### `moderation/models.py`
- `AccountRestriction` and `AccountRestrictionQuerySet` are deleted. This also removes the reverse names `user.restrictions`, `restrictions_given` and `restrictions_lifted`.
- `ModerationLog.Action`:
  - **added:** `REACTIVATE = "reactivate"`
  - **removed:** `RESTRICT`, `LIFT_RESTRICTION`, `EXTEND_RESTRICTION`
- `ModerationLog.Source` (`app` / `admin` / `system`) is unchanged and still used.
- `BanListUser` (proxy of `User`) is kept for the admin list.

### `moderation/serializers.py`
- **Removed:** `AccountRestrictionSerializer`, `RestrictionEndSerializer`, `RestrictedUserSerializer`.
- **Added:**
  - `DeactivateSerializer`: `reason`, required, max 200 characters. A blank or missing reason gives "Please give a reason."
  - `DeactivationLogSerializer`: one history entry: `id`, `action`, `details`, `moderator`, `source`, `created_at`. `moderator` shows `"Admin"` for admin-site actions.
  - `DeactivatedUserSerializer`: one ban list row: `username`, `deactivation_count`, `last_deactivated`.

### Admin and forms
- `moderation/admin.py`:
  - the ban list is now read-only (section 6);
  - `CloseReportsOnDeleteMixin` is removed;
  - `ReportAdmin` no longer shows the restriction fields;
  - the `request.user.is_mod` checks are removed (only admins can reach the admin).
- `moderation/forms.py`:
  - `BanUserForm`, `BanAddForm` and `BanHistoryRowForm` are removed;
  - the "restricted from reporting" check is removed;
  - profile report outcomes are now **Dismiss** and **Deactivated account** only.
- `posts/admin.py`: `PostAdmin` and `CommentAdmin` no longer use the mixin.
- `accounts/admin.py`: `RestrictionInline` is removed. The **Active** box is editable (Django's default).
- **Static files removed:** `moderation/ban_list_admin.js`, `moderation/restriction_inline.css`. In `report_admin.js`, the restriction-field toggling is removed.

---

## 4. API

All endpoints below need a logged-in **moderator or admin** (`IsAuthenticated`, `IsModerator`). Per-user endpoints also go through `get_moderatable_user`:
- **404:** unknown username;
- **403:** "You can't moderate this account."

### `GET /api/profile/<username>/status/`
Returns the account's current state and its ban history, newest first.
```json
{
  "username": "jdoe",
  "is_deactivated": true,
  "history": [
    { "id": 41, "action": "deactivate", "details": "Reason: spam", "moderator": "modjane", "source": "app", "created_at": "2026-11-13T12:30:00Z" },
    { "id": 17, "action": "reactivate", "details": "Reactivated account", "moderator": "Admin", "source": "admin", "created_at": "2026-11-02T09:10:00Z" }
  ]
}
```

### `POST /api/profile/<username>/ban/`
- **Body:** `{ "reason": "..." }`
- **201:** the new history entry (same shape as a `history` item above).
- **400:** `{"reason": ["Please give a reason."]}`, or `{"detail": "This account is already deactivated."}`.

### `DELETE /api/profile/<username>/ban/`
- **204:** reactivated. No body.
- **400:** `{"detail": "This account isn't deactivated."}`.

### `GET /api/profiles/banlist/`
Lists accounts that are banned **right now**, newest ban first. Users banned through the admin checkbox have no log entry, so they show `0` / `null` and come last.
```json
[
  { "username": "jdoe", "deactivation_count": 2, "last_deactivated": "2026-11-13T12:30:00Z" },
  { "username": "olduser", "deactivation_count": 0, "last_deactivated": null }
]
```

### Removed endpoints
| Removed | Use instead |
|---|---|
| `GET/POST /api/profile/<username>/restrictions/` | `GET .../status/`, `POST .../ban/` |
| `POST /api/profile/<username>/restrictions/lift/` | `DELETE .../ban/` |
| `PATCH /api/profile/<username>/restrictions/<pk>/` | None (no end dates) |
| `GET /api/restrictions/?status=active\|all` | `GET /api/profiles/banlist/` (no `status` filter; past bans are on each user's `/status/`) |

`/api/profiles/` (the public profile list) is unchanged and does not expose ban data.

---

## 5. Frontend (mod tools)

| File | Change |
|---|---|
| `components/ModRestrictions.jsx` | Now the **Ban list**. Fetches `/api/profiles/banlist/` and shows each banned user with their ban count and when the latest ban started, or "Banned in the admin site" when there's no log entry. The Active/All filter is removed |
| `components/RestrictionHistory.jsx` | Now the **account status** page. Fetches `.../status/` and shows Active/Banned plus the ban history. An active account gets a **Ban account** form (reason required, max 200 characters). A banned account gets **Reactivate account**. Either action reloads the page. "View profile" is hidden while the account is banned, because the profile is hidden |
| `pages/ModTools.jsx` | Labels only: the sidebar section is "Ban list", the back button says "Ban list", and the report link says "View @x's account status". The section value is still `'restrictions'` |

Banning from the account status page also closes that user's open **profile** reports.

---

## 6. Django admin

- **Who uses it:** only accounts with `is_staff`. Moderators are created by setting `role` only, without ticking Staff status, so they can't open the admin. This is a team convention: nothing in code enforces it.
- **Moderation → Ban list** (`/admin/moderation/banlistuser/`):
  - lists users with `is_active = False`;
  - columns: username, email, role, times deactivated, deactivated at, and an **Open user page** link;
  - no add, edit, delete or actions;
  - opening a row's URL directly redirects to that user's page.
- **Banning and unbanning in the admin:** untick or tick **Active** on the user's page (Users → user → Permissions).
  - **Not logged:** no reason, and no history entry.
  - No `can_moderate_user` check: an admin can deactivate their own account or another admin's, and the lockout then also blocks their admin login. To recover:
    ```python
    # python manage.py shell
    from accounts.models import User
    User.objects.filter(username="...").update(is_active=True)
    ```
- **Reports → profile report → outcome "Deactivated account":** goes through `deactivate_user`, so it **is** logged, with source `admin` and the report's reason.

---

## 7. Migration and data notes

- **`moderation/0005_alter_moderationlog_action_delete_accountrestriction`:** updates the `action` choices and drops the `AccountRestriction` table.
- No migration reset was needed. `0004_accountrestriction_source` loads its models with `apps.get_model`, so it still runs on a fresh database.
- **Bans from the old system were not carried over.** They lived in the dropped table, not in `is_active`, so those accounts are active again. Re-ban any that should stay banned.
- **Old log rows** with `restrict`, `lift_restriction` or `extend_restriction` stay in the table and show their raw value in the admin. Old `deactivate` rows from the restriction era still count toward "Times deactivated". To clear them:
  ```python
  from moderation.models import ModerationLog
  ModerationLog.objects.filter(action__in=["restrict", "lift_restriction", "extend_restriction"]).delete()
  ```

---

## 8. Known limitations

- Bans made with the admin **Active** checkbox have no reason or history.
- No partial or timed bans. If they're needed again, the old design is in the earlier update docs.
- Content from a banned user stays hidden, not deleted. Reactivating restores it.
- Open **post/comment** reports against a banned user stay in the queue until dismissed or acted on. Banning only closes their **profile** reports.
- **Superseded docs:**
  - `profile_reports_and_account_restrictions_changes.md` and `ban_list_and_deactivated_content_changes_110926.md`: the restriction and ban-list parts no longer apply.
  - `moderation_app_migration.md`: its restriction-syncing follow-up is no longer needed.
