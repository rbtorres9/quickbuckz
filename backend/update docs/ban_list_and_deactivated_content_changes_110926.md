# Update: Ban List, Logged Restriction Changes, and Deactivated Users' Content

This update follows `profile_reports_and_account_restrictions_changes.md` and `moderation_app_migration.md`. Everything here lives in the `moderation` app unless a path says otherwise. It adds:
- a per-user **Ban list** in the admin;
- logging for every lift and every end-date change;
- a rule that an active **deactivation blocks every other restriction**;
- a "no longer available" note shown in place of **deactivated users' comments**, plus fixes for the ways deactivated accounts could still report or be reported.

**Status**
- **Verified:** the final code was copied from the project folder and tested against a scratch SQLite database:
  - `manage.py check`: no issues
  - `makemigrations --check`: no changes
  - migrations `0002` and `0003` apply on top of the previous state
  - 20 deactivated-content checks, 42 ban-list checks and 38 earlier API/admin checks all pass
- **Not tested on Postgres/Render yet.**

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| Admin view of restrictions | Only a section on each user's page; editable there and **not logged** | **Moderation → Ban list**: one row per user who has ever been restricted. Their page shows full history, editing and an "Add restriction" section |
| Adding restrictions in the admin | One kind per row, from the user page | Checkboxes for several kinds at once, with one shared reason and end date. Ticking **Account** turns the others off |
| Lifting a restriction in the admin | Setting "Lifted at" by hand: no log entry, **Lifted by** stayed empty | **Lift** box or bulk action: sets Lifted by and writes a `lift_restriction` log entry |
| Changing an end date | Not possible | Edit **Until** in the admin or `PATCH` through the API (extend, shorten, or make permanent), logged as `extend_restriction` |
| Feature restriction while deactivated | Allowed | Refused everywhere: Ban list, API, report review |
| Restrictions on the Users page | Editable, not logged | Read-only history with an "Open in ban list" link |
| Restrictions column | n/a | **Active restrictions** count only (lifted and expired ones aren't counted) |
| Deactivated user's comments | Shown in full, and reportable | Shown in place as *"This comment is from an account that is no longer available."* with no author. Can't be reported. Back to normal when the deactivation is lifted |
| Admin → Add report | Any user could be picked as reporter or target | Deactivated users, and their posts and comments, are hidden from the dropdowns and rejected by validation |

---

## 2. Ban list (admin)

**Moderation → Ban list** (`/admin/moderation/banlistuser/`)

### Model: `BanListUser`
- A proxy of `accounts.User` (`proxy = True`). It has **no table of its own**; it's another admin view of the user table.
- It replaces the short-lived `BanListEntry` proxy (one row per restriction).
- `BanListUser.objects.all()` returns **every** user. Only the admin's status filter limits the list to users with history. To query subsets in code:

```python
from moderation.models import AccountRestriction, BanListUser
active = AccountRestriction.objects.active()

BanListUser.objects.filter(restrictions__isnull=False).distinct()          # ever restricted
BanListUser.objects.filter(pk__in=active.values("user"))                   # anything active now
BanListUser.objects.filter(pk__in=active.filter(kind="account").values("user"))  # deactivated now
```

- **Never call `.delete()` on `BanListUser`.** A row is the user account, so deleting it deletes the account. The admin turns delete off for everyone, superusers included.

### List page
| Column | Shows |
|---|---|
| Username, Email | The account |
| Status | `Deactivated` · `Restricted: Commenting, Posting` · `No active restrictions` |
| Until | The deactivation's end date, or the latest end among active feature restrictions. `Permanent` if any of those has no end. `-` if nothing is active |
| Active restrictions | Number of active restrictions (sortable) |
| Last restricted | Date of the newest restriction (sortable; the default sort is newest first) |

- **Status filter:** **All** (the default, meaning anyone with any history), Deactivated, Restricted features, No active restrictions.
- **Search:** username or email.
- **Bulk action:** "Lift all active restrictions of selected users". Each lift is logged. Users you can't moderate are skipped.

### A user's Ban list page
- **Summary:** username, email, role, status, until.
- **Add restriction:**
  - checkboxes for each kind (Account, Posting, Commenting, Liking and following, Reporting);
  - one **Reason** and one optional **Until** shared by every ticked box;
  - each ticked kind becomes its own history row and its own log entry (`restrict_user_many`).
- **Restriction history:** every restriction, newest first.
  - **Active rows:** **Until** can be edited and **Lift** can be ticked.
  - **Lifted and expired rows:** greyed out (disabled), and any values posted for them are ignored.
- **Add page** (Ban list → Add): pick any user, including one who has never been restricted, then the same checkbox section. After saving, you land on that user's page.

### Checkbox and validation rules
| Rule | Where it's enforced |
|---|---|
| Ticking **Account** unticks and greys out the other boxes | `static/moderation/ban_list_admin.js` |
| Account can't be ticked together with other kinds | `BanUserForm.clean()`, so it holds even without the JavaScript |
| A deactivated user's page shows no boxes, just a note to lift the deactivation first | `BanUserForm.__init__` |
| Kinds that are already active aren't offered | `BanUserForm.__init__` |
| A reason is required; Until must be in the future | `BanUserForm.clean()` / `BanHistoryRowForm` |
| Lift and change Until in the same save → refused | `BanHistoryRowForm.clean()` |
| Mods can't act on mods or admins (those pages are read-only for them) | `can_moderate_user` in the form and the admin permissions |

### Users page (Users → user)
- The **Account restrictions** section is now **read-only history**. No adding, editing or deleting there.
- Each row has an **Open in ban list** link to that user's Ban list page. This closes the gap where restrictions could be changed without being logged.

### Styling
- `static/moderation/restriction_inline.css` hides Django's bold per-row title (the restriction's `__str__`) in both restriction tables and removes the extra space it left. It's loaded by `RestrictionInline.Media` and `BanHistoryInline.Media`.

---

## 3. Services (`moderation/services.py`)

| Function | Purpose |
|---|---|
| `check_new_restriction(user, kind)` **(new)** | Returns the reason a restriction can't be added, or `None`. Two rules: (1) that kind is already active; (2) the account is deactivated and the kind isn't `account`. Used by the Ban list forms, the API and report review |
| `restrict_user(...)` | Now calls `check_new_restriction` first and raises `ValueError` if it fails, as a safety net |
| `restrict_user_many(target, moderator, *, kinds, reason, expires_at, source)` **(new)** | Adds several kinds in one transaction (one row and one log entry each) |
| `lift_restriction(restriction, moderator, *, source)` **(new)** | Lifts **one** row and logs it. Does nothing if the row is already inactive |
| `change_restriction_end(restriction, moderator, *, expires_at, source)` **(new)** | Moves the end date of an active row (`None` = permanent) and logs old → new. Locks the row while it saves |
| `deactivated_users()` **(new)** | A subquery of currently deactivated user IDs, for `__in` / `.exclude()` |
| `with_author_status(comments)` **(new)** | Adds `author_deactivated` to each comment in the same query, so there's no extra query per comment |

### Rule: an active deactivation blocks every other restriction
- **Ban list:** the boxes are hidden, and a forged request is refused.
- **API `POST /api/profile/<username>/restrictions/`:** returns `400 {"detail": "This account is deactivated. Lift the deactivation before adding feature restrictions."}`.
- **Report review → Restrict feature:** the form shows the same message.
- **Deactivating while feature restrictions are active is still allowed.** They stay in force underneath, so if the deactivation is lifted early, they still apply until their own end dates.

---

## 4. API

| Method | URL | Body | Responses |
|---|---|---|---|
| `PATCH` **(new)** | `/api/profile/<username>/restrictions/<id>/` | `{"expires_at": "2026-12-01T00:00:00Z"}` or `{"expires_at": null}` (permanent) | `200` updated restriction · `400` past date or missing field · `403` you can't moderate this user, or you aren't a mod · `404` restriction isn't active or doesn't belong to this user |
| `POST` | `/api/profile/<username>/restrictions/` | unchanged | Now also returns `400` when the account is deactivated and the kind isn't `account` |
| `POST` | `/api/posts/<id>/report/` with `comment_id` | unchanged | **`404`** if the comment's author is deactivated |

### Comment JSON (every comment endpoint and the feed preview)
Every comment now includes `author_unavailable`:
```json
{ "id": 12, "post": 4, "author": {"username": "eve", "...": "..."}, "content": "hi",
  "author_unavailable": false, "created_at": "..." }
```
For a deactivated author:
```json
{ "id": 11, "post": 4, "author": null, "author_unavailable": true,
  "content": "This comment is from an account that is no longer available.", "created_at": "..." }
```
- This applies to `GET /api/posts/<id>/comment/`, `GET /api/posts/<id>/` (all comments) and the 3-comment preview in post lists.
- `comments_count` doesn't change, because the comment still exists.
- The note text is `UNAVAILABLE_COMMENT_NOTE` in `posts/serializers.py`. The wording ("no longer available") doesn't say whether the account was deactivated or deleted.
- The post author or a mod can still delete these comments.

---

## 5. Reporting and deactivated accounts

| Path | Result |
|---|---|
| A deactivated user reports anything (new login or an old token) | `401`. This was already blocked by the JWT checks |
| Reporting a deactivated user's profile or post (API) | `404`. Already blocked, because they're hidden |
| Reporting a deactivated user's **comment** (API) | **`404` (new)** |
| Admin → Add report with a deactivated **reporter** | **Refused (new):** not in the dropdown, and `Report.clean()` rejects it |
| Admin → Add report **on** a deactivated user, or their post or comment | **Refused (new):** not in the dropdowns, and `Report.clean()` rejects it |
| Reports filed **before** someone was deactivated | Still open and reviewable as normal. The new checks only apply to new reports |

The checks live in:
- `ReportAdmin.formfield_for_foreignkey`: the dropdowns for reporter, reported user, post and comment;
- `Report.clean()` (`moderation/models.py`): the validation fallback.

---

## 6. Moderation log

| Action | New? | Written by |
|---|---|---|
| `extend_restriction` ("Changed restriction end date") | New | `change_restriction_end`, from the admin or the `PATCH` API. The text records old → new |
| `lift_restriction` | Existing | Now also written by the Ban list (the Lift box and the bulk action) |
| `deactivate` / `restrict` | Existing | Now also written by Ban list adds (source `admin`) |

---

## 7. Migrations and setup

| Migration | Operations | Database effect |
|---|---|---|
| `moderation/0002_banlistentry_alter_moderationlog_action` | Create proxy `BanListEntry`; add the `extend_restriction` choice | None (proxy, choices only) |
| `moderation/0003_delete_banlistentry_banlistuser` | Delete proxy `BanListEntry`; create proxy `BanListUser` | None |

Neither changes a table, so existing restrictions, reports and log entries are kept.

After pulling:
```
python manage.py migrate
python manage.py collectstatic --no-input
```
`collectstatic` picks up `ban_list_admin.js` and `restriction_inline.css`.

**Mod permissions:** a proxy model gets its own Django permissions, so mods who aren't superusers need **Can view / add / change ban list entry** (`view_banlistuser`, `add_banlistuser`, `change_banlistuser`). Permissions granted on the removed `BanListEntry` no longer apply. `python manage.py remove_stale_contenttypes` clears the old ones. "Can delete" is never needed.

---

## 8. Bugs fixed in this update

| Bug | Effect | Fix |
|---|---|---|
| Lifting from the Users page set `lifted_at` directly | No log entry, empty **Lifted by** | That section is read-only; lifts go through `lift_restriction` |
| Any feature restriction could be added on top of an active deactivation | Contradictory states, e.g. a deactivated account also "restricted from commenting" | `check_new_restriction` rule 2, in every entry point |
| Deactivated users' comments stayed visible and reportable | Banned content still shown; reports could be filed against a deactivated user | Shown as a note with no author; `404` when reported |
| Admin Add report accepted deactivated reporters and targets | Reports involving deactivated accounts | Filtered dropdowns plus `Report.clean()` |
| Ban list default ordering crashed the list page (found while building) | `FieldError` on `last_restricted` | The queryset is annotated **before** ordering |
| Saving history rows crashed Django's change-history message (found while building) | `AttributeError: new_objects` | `save_formset` fills in the formset's change lists itself |

---

## 9. Known issues / follow-ups

- **`is_active` is still not synced with deactivation.** A deactivated user still shows Active ✓ under Users. The sync is still planned.
- **Frontend:** comments can now have `"author": null`. Anything that reads `comment.author.username` must check `comment.author_unavailable` first and show the note, or it will crash on those comments.
- **Deleted accounts:** `Comment.author` uses `on_delete=CASCADE`, so deleting a user deletes their comments, and the note never appears for them. Keeping those comments as notes would need `SET_NULL` plus a migration.
- **Lifted and expired history rows** still show greyed-out date/time boxes and a Lift checkbox. They're disabled and ignored on save, but showing them as plain text would read better.
- The report review's **Reviewed by** dropdown can still list a deactivated moderator.
- From the previous doc, still open: login for a deactivated user gives simplejwt's generic error, and private profiles can't be reported by people who don't follow them.
- Resolved items from `profile_reports_and_account_restrictions_changes.md` §7: the user-page section not being logged, and deactivated users' comments still showing.

---

## 10. Test checklist (Verified)

| Action | Expected |
|---|---|
| Ban list → Add → user, tick Posting + Commenting | Lands on the user's page: "Restricted: Commenting, Posting", 2 history rows, 2 `restrict` log entries (admin) |
| Tick Account + Reporting together (JS off or a forged request) | "Account deactivation already blocks everything. Select it on its own." |
| Deactivate the user | Still one row for them in the list; Status Deactivated, Until Permanent; no checkboxes on their page |
| API: add `reporting` to a deactivated user | `400` "This account is deactivated…" |
| Report review → Restrict feature on a deactivated user | The form refuses with the same message |
| History: tick Lift on the Account row | Lifted by you, `lift_restriction` logged, the user can log in, the row greys out |
| History: change Until on an active row | `extend_restriction` logged (old → new) |
| `PATCH .../restrictions/<id>/` with `null` / a past date / a lifted row / another mod | `200` permanent / `400` / `404` / `403` |
| Filters: Deactivated / Restricted features / No active restrictions | Each narrows correctly; never-restricted users never appear |
| Active restrictions column | Counts only active rows (e.g. 3 history rows with 1 active → `1`) |
| Delete on the Ban list, as a superuser | `403` |
| Users page → Account restrictions | Read-only, no bold row titles, "Open in ban list" link |
| Comment by a deactivated user: list / post detail / feed preview | `author: null`, `author_unavailable: true`, note text; `comments_count` unchanged |
| Report that comment | `404`. Another user's comment on the same post → `201` |
| Admin → Add report | Deactivated users and their posts and comments aren't in the dropdowns; a forged reporter or target → form error |
| Lift the deactivation | The comment shows normally again, and can be reported |
| Comment list with 10 vs 20 comments | Same number of database queries |
