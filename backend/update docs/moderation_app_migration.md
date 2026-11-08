# Update: Moderation Code Moved to the `moderation` App

All report, moderation-log and account-restriction code now lives in one Django app, `backend/moderation/`. Before, it was spread across `posts` (reports, the log, mod views, admin, signals) and `accounts` (restrictions, JWT checks, the user-page inline).

This was a **move only**: no features or behavior changed, and **every API URL stays the same**, so the frontend needs no changes. What did change:
- the Django import paths;
- the admin URLs;
- the database tables, which were recreated empty (see section 5).

Feature details are in `profile_reports_and_account_restrictions_changes.md` and `reports_and_moderation_log_changes.md`.

**Status:** Verified with Django's test client against a scratch copy of the backend (SQLite):
- `manage.py check`: no issues
- `makemigrations --check`: no changes
- `migrate` works both from the old schema and on an empty database
- 38 API and admin smoke tests pass

Not deployed to Render/Neon yet.

---

## 1. New layout

```
backend/moderation/
├── __init__.py
├── apps.py               ModerationConfig; ready() connects signals
├── models.py             Report, ModerationLog, AccountRestriction (+ queryset)
├── services.py           report/log/restriction logic (was posts/moderation.py + accounts/restrictions.py)
├── serializers.py        Report serializers + AccountRestrictionSerializer
├── views.py              PostReportView, ReportViewSet, ProfileReportView, restriction views
├── urls.py               same URLs as before
├── forms.py              ReportAdminForm, ReportReviewForm
├── admin.py              Report/ModerationLog admin, CloseReportsOnDeleteMixin, RestrictionInline
├── signals.py            close reports when a post/comment is deleted
├── authentication.py     JWT class + rule that block deactivated users
├── tests.py
├── migrations/0001_initial.py
└── static/moderation/report_admin.js
```

### What did **not** move
| Kept in | What | Why |
|---|---|---|
| `accounts` | `User.role`, `is_mod`, `is_admin`, `active_restriction()`, `is_deactivated` | They describe the user. `is_deactivated` imports `AccountRestriction` inside the method, so `accounts` doesn't depend on `moderation` while Django loads models |
| `accounts/permissions.py` | `IsModerator`, `IsAdminRole`, `IsAuthorOrModerator` | Role checks that other apps use too |
| `accounts/backends.py` | `user_can_authenticate()` deactivation check | It's part of the login backend class |
| `posts/views.py`, `accounts/views.py` | `ensure_not_restricted(...)` calls | Each check sits in the view it protects; only the import changed |
| `posts/admin.py` | `PostAdmin` / `CommentAdmin` | They still use `CloseReportsOnDeleteMixin`, now imported from `moderation.admin` |

---

## 2. File map (old → new)

| Old location | New location | Notes |
|---|---|---|
| `posts/models.py`: `Report`, `ModerationLog` | `moderation/models.py` | Unchanged. `ValidationError` import removed from posts |
| `accounts/models.py`: `AccountRestrictionQuerySet`, `AccountRestriction` | `moderation/models.py` | Unchanged. `timezone` import removed from accounts |
| `posts/moderation.py` | `moderation/services.py` | Renamed, so imports read `moderation.services` |
| `accounts/restrictions.py`: `ensure_not_restricted`, `can_moderate_user` | `moderation/services.py` | Merged in |
| `posts/serializers.py`: Report serializers | `moderation/serializers.py` | |
| `accounts/serializers.py`: `AccountRestrictionSerializer` | `moderation/serializers.py` | |
| `posts/views.py`: `PostViewSet.report` action | `moderation/views.py`: `PostReportView` | Now a standalone view at the **same URL** and with the same behavior and visibility rule |
| `posts/views.py`: `ReportViewSet`, `ProfileReportView`, `get_moderatable_user`, `UserRestrictionView`, `LiftRestrictionView` | `moderation/views.py` | |
| `posts/urls.py`: reports router + profile report/restriction paths | `moderation/urls.py` | |
| `posts/forms.py` | `moderation/forms.py` | Imports gathered at the top |
| `posts/admin.py`: `CloseReportsOnDeleteMixin`, `ReportAdmin`, `ResolvedReportInline`, `ModerationLogAdmin` | `moderation/admin.py` | `Media.js` → `moderation/report_admin.js` |
| `accounts/admin.py`: `RestrictionInline` | `moderation/admin.py` | Imported back into `CustomUserAdmin.inlines` |
| `posts/signals.py` + `PostsConfig.ready()` | `moderation/signals.py` + `ModerationConfig.ready()` | `posts/apps.py` no longer has `ready()` |
| `accounts/authentication.py` | `moderation/authentication.py` | |
| `posts/static/posts/report_admin.js` | `moderation/static/moderation/report_admin.js` | |

Deleted after the move: `accounts/restrictions.py`, `accounts/authentication.py`, `posts/moderation.py`, `posts/forms.py`, `posts/signals.py`, `posts/static/posts/report_admin.js`.

---

## 3. Import changes in the remaining files

| File | Now imports |
|---|---|
| `accounts/admin.py` | `from moderation.admin import RestrictionInline` |
| `accounts/views.py` | `from moderation.models import AccountRestriction`, `from moderation.services import ensure_not_restricted` |
| `accounts/models.py` | `from moderation.models import AccountRestriction`, inside `is_deactivated` only |
| `posts/admin.py` | `from moderation.admin import CloseReportsOnDeleteMixin` |
| `posts/views.py` | `from moderation.models import AccountRestriction`, `from moderation.services import delete_content, ensure_not_restricted`. `IsModerator`, `IntegrityError` and the Report serializers are no longer imported |

The dependency only goes one way: `moderation` imports from `posts` and `accounts` at the top of its files. The only import in the other direction is the local one in `is_deactivated`, so there's no circular import.

---

## 4. Settings and URLs

`config/settings.py`
```python
INSTALLED_APPS = [
    ...
    'notifications',
    'moderation',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'moderation.authentication.RestrictionAwareJWTAuthentication',
        ...
    ),
}

SIMPLE_JWT = {
    ...
    "USER_AUTHENTICATION_RULE": "moderation.authentication.user_authentication_rule",
}
```

`config/urls.py`
```python
path('api/', include('moderation.urls')),
```

### URLs: unchanged
| URL | URL name |
|---|---|
| `POST /api/posts/<id>/report/` | `post-report` (same name the router used to generate) |
| `POST /api/profile/<username>/report/` | `profile-report` |
| `GET/POST /api/profile/<username>/restrictions/` | `profile-restrictions` |
| `POST /api/profile/<username>/restrictions/lift/` | `profile-restrictions-lift` |
| `GET /api/reports/`, `/api/reports/<id>/`, `POST /api/reports/<id>/dismiss/` | `report-list`, `report-detail`, `report-dismiss` |

`api_root` in `posts/urls.py` still links `"reports"`. `reverse("report-list")` finds it in `moderation/urls.py`.

### Admin URLs: changed
| Before | Now |
|---|---|
| `/admin/posts/report/` | `/admin/moderation/report/` |
| `/admin/posts/moderationlog/` | `/admin/moderation/moderationlog/` |
| "Posts" section in the admin sidebar | New **Moderation** section |

---

## 5. Database migrations

Existing data was **started fresh**, not copied (Neon data is disposable except for admin accounts). The old tables are dropped and new, empty ones are created:

| Migration | Operations |
|---|---|
| `accounts/0011_delete_accountrestriction` | Drop `accounts_accountrestriction` |
| `posts/0011_remove_moderationlog_moderator_and_more` | Drop the Report constraints and FKs, then drop `posts_report` and `posts_moderationlog` |
| `moderation/0001_initial` | Create `moderation_accountrestriction`, `moderation_moderationlog`, `moderation_report` |

**`moderation/0001_initial` was edited by hand** to depend on both delete migrations:
```python
dependencies = [
    ('posts', '0011_remove_moderationlog_moderator_and_more'),
    migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ("accounts", "0011_delete_accountrestriction"),
]
```
Django only adds the `posts` dependency, because `Report` has a foreign key to `Post`. Without the `accounts` line, the new restriction table could be created while the old one still exists. Postgres needs index and constraint names (like `one_open_post_report_per_user`) to be unique across the whole database, so the run could fail. With the line, the old tables are always dropped first.

**What is lost:** every existing report, moderation log entry and account restriction. Users, profiles, posts, comments, likes, follows, notifications and admin accounts are not touched.

The old migrations (`posts/0003`–`0010`, `accounts/0010`) stay in the repo as history. Don't delete them.

---

## 6. What teammates need to do

1. Pull. The code and the three migrations arrive in one commit.
2. Run:
   ```
   python manage.py migrate
   python manage.py collectstatic --no-input
   ```
   **Don't run `makemigrations`.** The migrations are already committed, and running it should report "No changes detected". If it creates new files, something is out of date: don't commit them, and ask before going further.
3. Optional: `python manage.py remove_stale_contenttypes` removes the leftover "posts | report", "posts | moderation log" and "accounts | account restriction" permission entries.
4. Branches that still import `posts.models.Report`, `posts.moderation`, `accounts.restrictions`, `accounts.authentication` or `accounts.models.AccountRestriction` need to switch to the `moderation.*` paths when rebasing.
5. Bookmarks to `/admin/posts/report/` move to `/admin/moderation/report/`.

### Deployment (Render)
- `build.sh` already runs `collectstatic` and `migrate`, so the first deploy after this commit drops and recreates the moderation tables on Neon.
- The old `staticfiles/posts/report_admin.js` copy is harmless. `collectstatic --clear` removes it.

---

## 7. Where new moderation code goes

| Adding... | Put it in |
|---|---|
| A model, or a field on Report / ModerationLog / AccountRestriction | `moderation/models.py`, then `makemigrations moderation` |
| Logic that closes reports, writes the log, or creates or lifts restrictions | `moderation/services.py`. Views and the admin should call services, not edit those models directly |
| A mod-only endpoint | `moderation/views.py` + `moderation/urls.py` (`IsAuthenticated, IsModerator`) |
| A new feature check (e.g. "can't send messages") | A new `AccountRestriction.Kind` + `ensure_not_restricted(user, Kind.X)` in the view that does the action |
| Admin screens for moderation | `moderation/admin.py` / `forms.py` / `static/moderation/` |

The planned `is_active` sync (see the restrictions doc) goes into `moderation/services.py`, `signals.py` and `admin.py`.

---

## 8. Verification checklist (Verified)

| Check | Result |
|---|---|
| `python manage.py check` | No issues |
| `makemigrations --check --dry-run` | No changes detected |
| `migrate` on a database with the old tables | `accounts.0011` → `posts.0011` → `moderation.0001`, all OK |
| `migrate` on an empty database | OK |
| Report post / comment / profile, duplicate report, own content | `201` / `200` / `400` as before |
| `GET /api/reports/` as mod / user | `200` / `403` |
| Dismiss, restrict, lift, deactivate, token after deactivate / lift | As before |
| `GET /api/` (api root) | `200`, still lists `reports` |
| Admin: Moderation section, report add / change, log list, user page inline, post list | All `200` |
| Admin review "Closed + Remove post" | Redirects, post deleted |
| Static | `moderation/report_admin.js` found; the old `posts/` copy is gone |
