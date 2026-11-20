# Changelog

## 2026-11-19 — Self-deactivation and deactivation tracking (backend)

### Added
- **Users can deactivate their own account.** It works like a ban for visibility: the profile returns 404, and the user's posts and comments are hidden everywhere. The difference is that the user brings the account back just by logging in again.
  - `backend/accounts/services.py` (new file):
    - `self_deactivate(user)`: one atomic `UPDATE` that sets `is_active=False`, `deactivated_at=now` and `deactivation_type="self"`. It also records the event in `AccountSecurity` (see below). Raises `ValueError` if the account is already inactive.
    - `self_reactivate(user)`: reactivates the account only if it's inactive **and** `deactivation_type="self"`. It never lifts a ban. Records `self_reactivated_at` and returns `True` if the account was reactivated.
  - Self-deactivation never writes a `ModerationLog` entry. It's kept separate from moderation.
- **New endpoint** (`backend/accounts/views.py` `SelfDeactivateView`, `backend/accounts/urls.py`, `SelfDeactivateSerializer` in `backend/accounts/serializers.py`):

  | Method | URL | Body | Result |
  |---|---|---|---|
  | POST | `/api/profile/me/deactivate/` | `{"password": "..."}` | `200` with `{"detail": "Your account has been deactivated. Log in again to reactivate it."}` |

  - A wrong password returns `400` with `{"password": ["Incorrect password."]}`. This is deliberately not `401`, so frontend token-refresh logic doesn't treat it as an expired session.
  - Not logged in returns `401`.
  - After a `200`, the old access token is rejected on the next request, because SimpleJWT refuses inactive users. The frontend should clear its tokens right away.
- **Reactivation on login** (`backend/accounts/backends.py`, `EmailOrUsernameBackend.authenticate`): after the password check passes, a self-deactivated account is reactivated before Django's `is_active` check. A wrong password never reactivates anything, and banned accounts still fail to log in.
  - This covers every login path that goes through `authenticate()`: `/api/token/`, the Django admin login and `/api-auth/login/`.
  - A token **refresh** does not reactivate the account. The user has to enter their password.
- **New `User` fields and properties** (`backend/accounts/models.py`):
  - `deactivated_at` (DateTime, nullable, indexed): when the account was last deactivated. `None` while active.
  - `deactivation_type` (`"ban"`, `"self"` or blank, indexed): why the account is inactive. Blank while active. Choices are in `User.DeactivationType` (`BAN`, `SELF`).
  - `is_self_deactivated`: inactive with type `"self"`.
  - `is_banned`: inactive with any type other than `"self"`. Older inactive rows with a blank type count as bans.
  - `is_deactivated` is unchanged (`not is_active`) and covers both kinds.
- **Self-deactivation history on `AccountSecurity`:** `self_deactivated_at`, `self_reactivated_at` and `self_deactivation_count`. These are owner/admin-only data and are shown read-only in the admin.
- **Admin** (`backend/accounts/admin.py`):
  - The user page has a new read-only **Deactivation** section (`deactivation_type`, `deactivated_at`), and the Security inline shows the self-deactivation history read-only.
  - The user list has a `deactivation_type` column and a filter. To find self-deactivated accounts, filter by *Deactivation type: Deactivated by user*.

### Changed
- **`User.save()` keeps the new fields in step with `is_active`.** When `is_active` changes through `save()`, for example with the admin **Active** checkbox:
  - Deactivating sets `deactivated_at=now` and `deactivation_type="ban"`, unless a type is already set. The admin checkbox counts as a mod action.
  - Reactivating clears both fields.
  - Partial saves that pass `update_fields` without `is_active`, such as `last_login`, skip the extra query.
- **Mod bans and unbans** (`backend/moderation/services.py`):
  - `deactivate_user` also sets `deactivated_at` and `deactivation_type="ban"` in the same `UPDATE`. It still only accepts **active** accounts, so a self-deactivated account can't be banned. Trying returns `400` *"This account is already deactivated."*
  - `reactivate_user` only lifts bans: `.exclude(deactivation_type="self")`. It clears both fields. A mod can't reactivate an account the user chose to leave.
- **Mod API** (`backend/moderation/views.py`):
  - `GET /api/profile/<username>/status/` returns a new `deactivation_type` key: `"ban"`, `"self"` or `null`. `is_deactivated` is still included.
  - `DELETE /api/profile/<username>/ban/` on a non-banned account (active or self-deactivated) now says *"This account isn't banned."*
  - `GET /api/profiles/banlist/` leaves out self-deactivated users. Its URL and response shape are unchanged.
- **Admin ban list** (`backend/moderation/admin.py`, `BanListAdmin.get_queryset`): self-deactivated users are left out here too.
- **Content stays hidden for both kinds.** `deactivated_users()`, `with_author_status()`, `active_profiles()` and `is_deactivated` all filter on `is_active=False`, so none of them changed.
- **Report review form** (`backend/moderation/forms.py`): unchanged. Its `target.is_deactivated` check already blocks a *Deactivated account* outcome on a self-deactivated user.

### Migrations
- `accounts/migrations/0014_purgedemail_user_deactivated_at.py`: adds `User.deactivated_at`. It also creates `PurgedEmail`, which `0015` drops.
- `accounts/migrations/0015_delete_purgedemail_and_more.py`: drops `PurgedEmail`, and adds `User.deactivation_type` plus the three `AccountSecurity` history fields.
- `moderation/migrations/0008_alter_moderationlog_action.py` and `0009_alter_moderationlog_action.py`: choices-only changes (`purge` added, then removed). No schema change.
- Existing inactive accounts migrate with `deactivated_at=None` and a blank type. They're treated as bans.

### Removed (added and dropped during this work)
- The automatic purge of deactivated accounts after 30 days (`purge_deactivated_users` command, purge services, `DEACTIVATED_USER_RETENTION_DAYS`), the `PurgedEmail` re-signup blocklist and `ModerationLog.Action.PURGE` were removed before release. Accounts are now deleted manually (see Notes).

### Notes
- **Deleting accounts manually:** use the Delete button on the user's admin page, or the shell. `deactivated_at` lets you filter by age:
  ```python
  from datetime import timedelta
  from django.db import transaction
  from django.utils import timezone
  from accounts.models import User
  from posts.models import Comment, Post

  cutoff = timezone.now() - timedelta(days=30)
  for u in User.objects.filter(is_active=False, deactivated_at__lte=cutoff, is_superuser=False):
      with transaction.atomic():
          Comment.objects.filter(author=u).delete()
          Post.objects.filter(author=u).delete()
          u.delete()
  ```
  Delete comments and posts **before** the user. Deleting reported content creates a new `ModerationLog` row that points at the user. If the user is deleted in the same step, Postgres fails at commit with a foreign-key error. The admin Delete button can hit this for a self-deactivated user with reported posts. If it does, delete their posts first.
- Manual deletion doesn't remove the user's image files from S3, and a deleted banned user can sign up again with the same email.

### Known limitations
- **Ban dodging:** a reported user can self-deactivate before a mod acts. Self-deactivation doesn't close reports, so those reports stay open, but mods can't ban the account until the user logs back in.
- The login response doesn't say whether the account was just reactivated, so the frontend can't show a "welcome back" message yet.
- Unticking **Active** in the admin still doesn't write a `ModerationLog` entry, so those bans don't count toward *Times deactivated*. This predates this change.
- `ChangeEmailSerializer.email` is a `CharField`, so the address format isn't validated. Its duplicate check is also case-sensitive, so changing to `Foo@x.com` when `foo@x.com` already exists hits the `unique_email_ci` constraint and returns `500`. This predates this change.

### Testing checklist
1. `POST /api/profile/me/deactivate/` with the right password returns `200`. The profile returns `404`, their posts and comments are hidden, and the account isn't on the ban list (API or admin).
2. The same request with a wrong password returns `400` and nothing changes.
3. The old access token gets `401` on the next request.
4. `POST /api/token/` with the user's credentials returns tokens. The account is active again, `deactivation_type` and `deactivated_at` are cleared, and the admin Security inline shows `self_reactivated_at` with the count increased.
5. A mod's `POST /api/profile/<username>/ban/` on a self-deactivated account returns `400`, and `DELETE` returns `400` *"This account isn't banned."*
6. `GET /api/profile/<username>/status/` returns `"deactivation_type": "self"` for that account, `"ban"` for a banned one and `null` for an active one.
7. A banned user can't log in, and stays on the ban list with `deactivation_type="ban"`.
8. Unticking **Active** in the admin sets `deactivation_type="ban"` and `deactivated_at`, and ticking it again clears both.