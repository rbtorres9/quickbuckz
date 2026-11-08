# Update: Profile Reports, Account Restrictions, and Admin Report Review

Users can now report **profiles**, not just posts and comments. Moderators can **restrict** an account in two ways:
- turn off specific features (posting, commenting, liking/following, reporting)
- **deactivate** the account completely

Either kind can be permanent or end at a set time. Open reports can now be reviewed and closed from the Django admin with an outcome, and every restriction action is written to the moderation log.

This builds on `reports_and_moderation_log_changes.md`. All of this code now lives in the new `moderation` app (see `moderation_app_migration.md`), so the file paths below are the new ones.

**Status labels used below**
- **Verified**: tested with Django's test client against a scratch copy of the backend (SQLite) with every change applied: `manage.py check`, migrations, and the API and admin requests in the test checklist.
- **Not tested on Postgres/Render yet**: works locally, but hasn't been deployed.

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| What can be reported | Posts, comments | Posts, comments, **profiles** (`POST /api/profile/<username>/report/`) |
| Mod queue filter | `?type=post` / `comment` | Also `?type=profile` |
| Restricting a user | Not possible | Per feature (posting, commenting, liking and following, reporting) or the whole account, with an optional end date |
| Deactivated account | n/a | Can't log in or refresh tokens; existing tokens stop working; profile and posts hidden (`404`); can't be followed |
| Lifting a restriction | n/a | `POST /api/profile/<username>/restrictions/lift/`. The restriction is kept as history |
| Who can restrict whom | n/a | Mods → regular users. Admins → users and mods. Nobody → admins or themselves |
| Moderation log actions | `remove_post`, `remove_comment`, `dismiss`, `content_deleted` | Also `deactivate`, `restrict`, `lift_restriction` |
| Admin: adding a report | Post or Comment | Post, Comment, or **Profile** (pick the reported user) |
| Admin: open reports | Could edit target fields; closing was only possible by deleting the content or with "Dismiss selected" | Edit **Status, Outcome, Reviewed by** to close the report with an outcome. Everything else is read-only |
| Database | n/a | New `AccountRestriction` model, plus new `Report` and `ModerationLog` choices |

---

## 2. Data model (`moderation/models.py`)

### `Report` changes
- `TargetType.PROFILE = "profile"`. A profile report has no `post` or `comment`. The reported user is stored in `target_author`.
- New constraint `one_open_profile_report_per_user`: one **open** report per reporter per profile, the same rule as for posts and comments.
- `clean()`:
  - Profile reports need `target_author`, and users can't report their own profile.
  - Post and comment reports still need a post or a comment.
- `save()`: if a profile report has no snapshot yet (for example, one added in the admin), `target_content` is built as `@username (First Last)` plus the bio.

### `ModerationLog.Action` additions
| Action | Logged when |
|---|---|
| `deactivate` | An `account` restriction is created |
| `restrict` | Any other restriction is created |
| `lift_restriction` | Active restrictions are lifted |

When a restriction is created, it closes every open **profile** report on that user and links them to the log entry. If nobody reported the user, the action is still logged (`reports_closed = 0`).

### `AccountRestriction` (new)
| Field | Purpose |
|---|---|
| `user` | Who is restricted. `CASCADE`. `related_name="restrictions"` |
| `kind` | `account`, `posting`, `commenting`, `interacting` (liking and following), `reporting`. Indexed |
| `reason` | Required, up to 200 characters |
| `expires_at` | End date. **Empty = permanent** |
| `created_by`, `created_at` | Which mod added it, and when |
| `lifted_at`, `lifted_by` | Set when a mod lifts it early. The row is kept as history |

- `AccountRestriction.objects.active()`: rows that aren't lifted, and that have either no end date or an end date in the future. Timed restrictions **end on their own** because of this rule, so no scheduled job is needed.
- `is_active` (property): the same rule for one row. `summary()`: readable text, e.g. `Posting until 2026-11-20 18:00 UTC: spam`, stored in the log.

### `User` helpers (`accounts/models.py`)
- `active_restriction(kind)`: the active restriction of that kind, or `None`. Permanent ones are returned first, then the latest end date.
- `is_deactivated`: `True` while an `account` restriction is active.

### Migrations
- `accounts/0010_accountrestriction`
- `posts/0010_alter_moderationlog_action_alter_report_target_type_and_more`

The move to the `moderation` app replaced both (`moderation/0001_initial`). See the migration doc.

---

## 3. Where restrictions are enforced

`ensure_not_restricted(user, kind)` in `moderation/services.py` returns **`403`** with a message like `"Commenting is restricted on your account until 2026-11-20 18:00 UTC."`, or `"... until a moderator lifts it."` when there's no end date.

| Kind | Blocked | Still allowed |
|---|---|---|
| `posting` | Create a post (`perform_create`), edit a post (`perform_update`) | Deleting your own posts |
| `commenting` | `POST /api/posts/<id>/comment/` | Reading comments, deleting your own comments |
| `interacting` | Liking (`POST .../like/`), following or sending a follow request (`POST /api/profile/<username>/follow/`) | Unliking, unfollowing |
| `reporting` | Reporting posts, comments and profiles | |
| `account` | Everything (see below) | |

### Deactivation (`account`)
| Path | How it's blocked |
|---|---|
| Login (`/api/token/`) and Django admin / browsable API login | `EmailOrUsernameBackend.user_can_authenticate()` also checks `not user.is_deactivated`. This also signs out existing admin sessions on their next request |
| Token refresh (`/api/token/refresh/`) | `SIMPLE_JWT["USER_AUTHENTICATION_RULE"] = "moderation.authentication.user_authentication_rule"` |
| Access tokens already issued (up to 15 min left) | `RestrictionAwareJWTAuthentication` rejects them on the next request with `401` |
| Profile, posts, follow lists, feed, profile list | `active_profiles()` / `visible_profiles()` in `accounts/views.py` exclude deactivated users |
| `GET /api/profile/<username>/` | `404` for everyone. Active private profiles still get the locked card |
| `POST /api/profile/<username>/follow/` | `404` |

`active_profiles()` (new, `accounts/views.py`) means "every profile except deactivated accounts". `visible_profiles()` starts from it, and `ProfileByUsernameView` and `FollowView.post` use it directly.

---

## 4. API

### User endpoints
| Method | URL | Body | Responses |
|---|---|---|---|
| `POST` | `/api/profile/<username>/report/` **(new)** | `{"reason": "..."}` | `201` created · `200` "You already reported this profile." · `400` own profile or empty reason · `403` reporting restricted · `404` profile not visible |
| `POST` | `/api/posts/<id>/report/` | `{"reason": "...", "comment_id"?: n}` | Unchanged, plus `403` when reporting is restricted |

Only profiles the user can see can be reported. A private profile the user doesn't follow returns `404`.

### Moderator endpoints (`IsAuthenticated` + `IsModerator`)
| Method | URL | Body | Responses |
|---|---|---|---|
| `GET` | `/api/reports/?type=profile` | | Profile reports. `post` and `comment` are `null`; use `target_author` and `target_content` |
| `POST` | `/api/reports/<id>/dismiss/` | | For profile reports, closes every open report on that **user** |
| `GET` | `/api/profile/<username>/restrictions/` **(new)** | | The user's restriction history, newest first |
| `POST` | `/api/profile/<username>/restrictions/` **(new)** | `{"kind": "commenting", "reason": "spam", "expires_at"?: "2026-11-20T18:00:00Z"}` | `201` created · `400` invalid, past date, or that kind already active ("Lift it first") · `403` not allowed for this account |
| `POST` | `/api/profile/<username>/restrictions/lift/` **(new)** | `{"kind": "account"}` | `200 {"lifted": n}` · `400` unknown kind · `404` nothing active of that kind |

The restriction endpoints look the user up directly, not through `visible_profiles`, so mods can still find deactivated accounts to re-enable them.

Restriction JSON:
```json
{
  "id": 3, "kind": "commenting", "reason": "spam",
  "expires_at": "2026-11-20T18:00:00Z", "is_active": true,
  "created_by": "modguy", "created_at": "...",
  "lifted_at": null, "lifted_by": null
}
```

### Role rule: `can_moderate_user(actor, target)`
| Target | Mod | Admin |
|---|---|---|
| Regular user | ✓ | ✓ |
| Mod | ✗ | ✓ |
| Admin, or yourself | ✗ | ✗ |

---

## 5. Django admin

### Reports → Add report
- "Reporting a" now has **Post / Comment / Profile**. `report_admin.js` shows only the matching field.
- **Reported user** (`target_author`) can only be picked on the Add page. It's read-only on existing reports.

### Reports → open report (edit page)
- The target, reporter, reason and snapshot are **read-only**.
- Editable: **Status**, **Outcome**, **Reviewed by**. Profile reports also get **Feature to restrict** and **Until**.
- Outcomes by report type:

| Report | Outcomes |
|---|---|
| Post | Dismiss, Remove post |
| Comment | Dismiss, Remove comment |
| Profile | Dismiss, Deactivate account, Restrict feature |

- Saving with **Closed** runs the outcome through the same services the app uses (`dismiss_reports`, `delete_content`, `restrict_user`). Every other open report on the same target closes too, and one log entry with source `admin` is written.
- **Reviewed by** lists mods and admins and defaults to you. Picking someone else credits them in the log.
- The form refuses:
  - an outcome while Status is still Open, or Closed without an outcome or reviewer;
  - reviewing a report about yourself;
  - removing content that's already gone;
  - restricting someone the reviewer can't moderate;
  - a duplicate active restriction;
  - an end date in the past.

### Reports → closed report
- Read-only. Shows Status, Outcome, Reviewed by and the linked log entry.

### Users → user page
- New **Account restrictions** inline: add a restriction, set Lifted at, or delete one.
- See known issues: inline changes aren't logged.

---

## 6. Bugs fixed during this update

| Bug | Effect | Fix |
|---|---|---|
| `dismiss_reports()` called `resolve_reports(` without the `reports` argument | **Every** Dismiss (app and admin) failed with `TypeError` (500) | Pass `reports` |
| `dismiss_reports()` grouped reports by `post_id` / `comment_id` | Dismissing one profile report would have closed every open profile report for **all** users (both are `NULL`) | Profile reports are grouped by `target_author` |
| `Report.clean()` required a post or comment | Profile reports failed admin validation | Profile branch added |
| `ProfileListView` copied the filter logic instead of calling `visible_profiles()` | Deactivated users would still appear in `/api/profiles/` | Now returns `visible_profiles(request.user)` |
| `ReportAdminForm` choices were hard-coded to post/comment | Profile missing from "Reporting a" | Choices come from `Report.TargetType` |
| Changing a saved report's type in the admin | Crash (the form referenced a field that isn't on the change page) | Target fields are read-only on existing reports |
| `get_moderatable_user` indented inside `ProfileReportView` | Every restriction endpoint failed with `NameError` (500) | Made a top-level function |
| Commenting check placed in the comment **GET** branch | Restricted users couldn't read comments but could still post them. Logged-out visitors got a 500 | Moved to the comment-create branch |
| `ProfileByUsernameView` / `FollowView.post` used a bare `Profile.objects` | Deactivated profiles returned `200` (locked card) and could be followed | Both use `active_profiles()` → `404` |

---

## 7. Known issues / follow-ups

- **`is_active` is not synced with deactivation.** A deactivated user still shows Active ✓ in the admin, and unchecking Active by hand doesn't hide the profile. A planned follow-up syncs the two in `moderation/services.py` and `signals.py`, restores the account at login after a timed deactivation ends, logs deletions, and makes Active read-only.
- **The user-page inline isn't logged.** Adding, lifting or deleting a restriction there writes no `ModerationLog` entry, leaves `created_by` / `lifted_by` empty, and skips `can_moderate_user`. Use the API or the report review page for logged actions. The planned sync covers this too.
- Comments written by deactivated users still show under other people's posts.
- A deactivated user trying to log in gets simplejwt's generic `"No active account found with the given credentials"`, with no reason or end date.
- Private profiles can't be reported by people who don't follow them (`404`).
- **Frontend:** nothing built yet. Still needed:
  - a Report button on profiles;
  - a Profiles tab on `/mod`;
  - a restrict / lift UI for mods;
  - showing the `403` restriction messages.

---

## 8. Test checklist (Verified)

| Action | Expected |
|---|---|
| Report a profile | `201`. Again → `200 "You already reported this profile."`. Your own profile → `400` |
| `GET /api/reports/?type=profile` as a mod | Lists it. As a regular user → `403` |
| Dismiss a profile report | Only that user's profile reports close |
| Restrict `commenting` | `201`. That user's comment POST → `403`. Their comment GET → `200`. Logged-out comment GET → `200` |
| Lift `commenting` | `{"lifted": 1}`. Commenting works again |
| A mod restricts an admin | `403` |
| Deactivate | Login → `401`. `/api/profile/<name>/` → `404` (logged in or not). Their posts → `404`. Follow → `404`. Unfollow → `200` |
| Lift `account` | Login works. Profile `200`. Follow `201` |
| A mod deletes a reported post | `204`. No open reports left on it |
| Admin: Add report → Profile | Only "Reported user" shows. The snapshot is filled on save |
| Admin: open post report → Closed + Remove post | Post deleted, report closed, log `remove_post` / `admin` |
| Admin: closed report | Read-only, shows Outcome and Reviewed by |
| Admin: user page | Account restrictions inline shows |
