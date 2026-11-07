# Update: Reports, Mod Tools, and Moderation Log

Users can now report posts and comments. Moderators review reports on the mod page (`/mod`): they can remove the content or dismiss the reports. Every moderator decision, and every reported item that disappears, is recorded in a moderation log. Before this update, reports were sample data stored in the browser (`store.jsx`), and nothing was saved on the backend.

In this design:

- **Report** is the complaint: who reported what, why, and whether it's still waiting (`open` / `closed`).
- **ModerationLog** is what happened: who acted, what they did, where it came from, and a copy of the content.
- Each closed report links to the log entry that closed it (`Report.resolution`).

## Rules

| Who | Can do |
|---|---|
| Any logged-in user | Report a post or comment they can see, except their own |
| Moderator / admin | See the report queue, remove reported content, dismiss reports |
| Moderator / admin | **Not** review reports on their own content. Another mod has to. |
| Author | Delete their own post or comment at any time. If it was reported, this is logged as "Content deleted". |

One user can have only one **open** report on the same post or comment. Reporting it again returns `200 "You already reported this."`.

## Backend (Django)

### `posts/models.py`

#### `Comment`

- New `__str__`: `"<username>: <first 20 chars>..."`. The admin dropdowns used to show `Comment object (1)`.

#### `Report` (new)

| Field | Purpose |
|---|---|
| `post` | The reported post. For a comment report, it's the comment's own post. `SET_NULL`, so the report survives when the post is deleted. |
| `comment` | The reported comment, empty for a post report. `SET_NULL`. |
| `reporter` | Who reported it. `CASCADE`: deleting the account deletes their reports. |
| `reason` | Free text, up to 200 characters. |
| `status` | `open` or `closed`. Indexed. |
| `resolution` | Link to the `ModerationLog` entry that closed it. `SET_NULL`. |
| `target_type` | `post` or `comment`, stored so it survives deletion. |
| `target_author`, `target_content` | A copy of the reported author and text. |
| `created_at` | When it was reported. |

- **Constraints**: two partial unique constraints, one open report per user per post (`comment IS NULL`) and one per user per comment.
- **`clean()`** (runs in admin forms):
  - A new report needs a post or a comment.
  - Users can't report their own content.
  - A comment must belong to the selected post.
- **`save()`**:
  - For a comment report, `post` is always copied from the comment, so a report can't point at the wrong post.
  - While the content still exists, the snapshot (`target_type`, `target_author`, `target_content`) is refreshed. After deletion, the saved copy is kept.
- "Reviewed by" and "reviewed at" are no longer stored on the report. They're read from `resolution.moderator` and `resolution.created_at`.

#### `ModerationLog` (new)

| Field | Purpose |
|---|---|
| `moderator` | The mod who acted. Empty for `content_deleted`. `SET_NULL`. |
| `action` | `remove_post`, `remove_comment`, `dismiss`, `content_deleted` |
| `source` | `app` (any API request), `admin` (Django admin), `system` (cascades such as account deletion) |
| `target_author`, `target_content` | A copy of the content acted on |
| `post_ref`, `comment_ref` | Plain ids, not links, so they're kept after deletion |
| `reports_closed` | How many open reports this action closed |
| `created_at` | When it happened |

- `via_reports` (property) is `reports_closed > 0`, meaning the action responded to reports. It's worked out on the server, so nothing from the frontend can fake it.
- `__str__`: `"<who>: <action label>"`.
  - `who` is the moderator's username for mod actions.
  - It's `system` for `content_deleted` entries, which never have a moderator.
  - It's `deleted user` when a mod action's moderator account was later deleted (`SET_NULL`).
  - Before this, every entry without a moderator showed "deleted user".
- `content_deleted` entries are kept, not skipped: the report's Outcome is read from this row through `Report.resolution`. Without it, the report would close with no outcome. They're hidden from the admin's default view instead (see `posts/admin.py`).
- "Mod page" vs. "Delete (mod) on a post page" is **not** recorded. Both use the same API request, so the server can't tell them apart reliably.

#### What gets logged

| Event | Log entry | Reports |
|---|---|---|
| Mod removes someone else's post or comment (reported or not) | `remove_post` / `remove_comment`, moderator set | Open ones closed and linked |
| Mod dismisses reports | `dismiss`, moderator set | All open reports on that item closed |
| Author (or post owner) deletes **reported** content | `content_deleted`, no moderator, `app` | Closed and linked |
| Reported content deleted by a cascade (e.g. account deletion) | `content_deleted`, `system` | Closed and linked |
| A user deletes their own **unreported** content | none | none |
| A mod deletes their **own** content | Treated like an author delete, not as moderation | |

### `posts/moderation.py` (new)

The only code that closes reports, so every closed report has a log entry.

- `is_mod_action(user, content_author)`: a logged-in mod acting on someone else's content.
- `resolve_reports(reports, *, action, source, ...)`: locks the open reports (`select_for_update`), creates the log entry, then closes and links them, all in one transaction. It returns `None` and logs nothing when there's nothing to close, unless `always_log=True`.
- `delete_content(target, user, source="app")`: closes reports, logs the outcome, then deletes the post or comment, in one transaction. Mod removals always log.
- `dismiss_reports(report, user, source="app")`: closes every open report on the same item and returns how many it closed.

### `posts/signals.py` (new) and `posts/apps.py`

- `pre_delete` receivers on `Post` and `Comment` close any reports still open, as `content_deleted` / `system`. This catches deletes that don't go through `delete_content`, such as account deletion.
- `PostsConfig.ready()` imports `signals` so the receivers are registered.

### `posts/serializers.py`

- `ReportCreateSerializer`: accepts only `reason` (trimmed, must not be empty). The view sets `post`, `comment` and `reporter`.
- `ReportedPostSerializer` / `ReportedCommentSerializer`: small summaries for the mod page.
- `ReportSerializer` (mod list): `id`, `type`, `reason`, `status`, `reporter`, `created_at`, `reviewed_by`, `reviewed_at`, `outcome`, `target_author`, `target_content`, `can_review`, `post`, `comment`.
  - `reviewed_by`, `reviewed_at` and `outcome` are read from `resolution` and are `null` while the report is open.
  - `can_review` is `false` when the report is about the requesting mod's own content.
  - `post` / `comment` are `null` once the content is deleted. Use `target_*` for the saved copy.

### `posts/views.py`

- `PostViewSet.report`: `POST /api/posts/<id>/report/`
  - Body `{"reason": "..."}` for a post, or `{"reason": "...", "comment_id": 7}` for a comment on that post.
  - Only posts the user can see (normal visibility rules). Own content returns `400`. A duplicate returns `200`, and a new report returns `201`.
- `PostViewSet.perform_destroy` and the comment `DELETE` both call `delete_content()`.
- `get_queryset`: moderators skip the private-profile filter when **deleting** a post or comment, so they can remove content from private accounts. Feeds and post pages still follow normal visibility.
- `ReportViewSet` (`IsAuthenticated` + `IsModerator`):
  - `GET /api/reports/`: `?status=open` (default), `closed` or `all`, plus `?type=post` or `comment`.
  - `POST /api/reports/<id>/dismiss/`: `400` if already closed, `403` on your own content. Returns `{"dismissed": n}`.

### `posts/urls.py`

- `router.register("reports", ReportViewSet, basename="report")`
- `api_root` lists `reports`.

### `posts/admin.py`, `posts/forms.py`, `posts/static/posts/report_admin.js`

- **Post / Comment admin**: delete and "Delete selected" go through `delete_content(..., source="admin")`, so admin deletes are logged.
- **Report admin**:
  - A "Reporting a: Post / Comment" picker (`ReportAdminForm` in `forms.py`). `report_admin.js` shows only the matching dropdown, and the form copies `post` from the chosen comment.
  - `status` and `resolution` are read-only. Reports are closed only with the **"Dismiss selected reports"** action (logged as `admin`, and it skips your own content) or by deleting the content.
  - Closed reports can't be edited. Only mods can add or change reports.
  - Columns: Outcome and Reviewed by (from the log). You can filter by status and outcome.
  - The Post and Comment dropdowns load their authors in one query.
- **ModerationLog admin**: read-only. No adding or editing, and only superusers can delete.
  - Columns: action, moderator, source, via reports (✓/✗), reports closed, author.
  - Each entry lists the reports it closed (inline), with links through to them.
  - **Log type** filter (`LogTypeFilter`, first in `list_filter`):
    - The options are **Mod actions** (the default), **Author deletions (system)** and **All**. The URL parameter is `?log_type=mod|system|all`.
    - With no parameter, "Mod actions" is selected and `content_deleted` rows are excluded, so the default list shows only real moderator decisions. `choices()` is overridden so that default is highlighted instead of Django's "All".
    - Combine it with the **Action** filter carefully: picking Action = "Content deleted" while Log type is still "Mod actions" shows an empty list. Switch Log type to "Author deletions" or "All".

### Migrations

| Migration | Change |
|---|---|
| `0003_report` | `Report` table |
| `0004_alter_report_reviewed_by` | Reviewer dropdown limited to mods (field removed in 0008) |
| `0005_report_target_author_report_target_content_and_more` | `SET_NULL` on post/comment, snapshot fields, statuses |
| `0006_report_target_type` | `target_type` field (left out of 0005 because an old `@property` had the same name) |
| `0007_moderationlog` | `ModerationLog` table |
| `0008_remove_report_reviewed_at_remove_report_reviewed_by_and_more` | Removes `reviewed_by` / `reviewed_at`, adds `resolution` and `source`, status becomes `open` / `closed` |

The `ModerationLog.__str__` change and the admin Log type filter need no migration.

After `migrate`, reports closed under the old statuses were converted in the shell:

```python
Report.objects.exclude(status__in=["open", "closed"]).update(status="closed")
```

They keep the reporter and reason but have no linked outcome (the admin shows `-`).

## Frontend (React)

### `src/context/ApiContext.jsx`

- `fetchBaseUrl` adds the trailing `/` to the **path only**. Before, `?comment_id=7` became `?comment_id=7/`, which broke comment deletes everywhere and the `?type=` filter on the mod page.

### `src/pages/ModTools.jsx` (`/mod`)

- Loads `GET /api/reports/` (open reports) instead of the sample `store.jsx` data, with **All / Posts / Comments** tabs.
- Reports on the same item are grouped into one card that shows the type, the reasons, the reporters, and how long ago the latest report was made.
- Comment cards also show the post the comment was on.
- **Remove** calls the normal delete endpoint. **Dismiss** calls `/dismiss/`. Both reload the list afterwards, because deleting a post also closes reports on its comments.
- If `can_review` is false, the card shows "This is your post/comment. Another moderator has to review it." instead of the buttons.

### `src/components/PostCard.jsx`

- `handleReport()` sends `POST /api/posts/<id>/report/` and shows the backend's message, for example "You already reported this."

### `src/pages/PostPage.jsx` (comments)

- Each comment has a **⋯** menu, styled like `PostCard`'s. Only one menu is open at a time, and clicking elsewhere closes it.
  - **Report**: on anyone else's comment.
  - **Delete**: your own comments and comments on your post. **Delete (mod)**: moderators on other people's comments.
- `reportComment()` sends `comment_id` to the post's report endpoint. A status label next to the ⋯ shows Reporting... / Reported / Deleting... / Deleted.
- A failed comment delete now shows an alert. Before, it set the page-level error, which hid the post as "doesn't exist".

## Deployment notes

- `build.sh` already runs `collectstatic` and `migrate`. Commit all migrations through `0008`.
- **Local testing with `DEBUG=False`**: run `python manage.py collectstatic --no-input` first, and again after changing `report_admin.js`. `CompressedManifestStaticFilesStorage` returns a 500 on any page with a static file that isn't in the manifest. Add `backend/staticfiles/` to `.gitignore`.
- `/api/reports` returning 404 on Render means the deploy is older than the `urls.py` change.

## Bugs fixed during this update

- `class Report(models.Models)`: typo that stopped the server from starting.
- `views.py` didn't import `ReportCreateSerializer`, so every report request would have failed with a 500.
- `ModTools.jsx` was missing `useEffect` / `useMemo` imports, so `/mod` rendered as a blank page.
- `ReportSerializer` declared `can_review` without listing it in `fields` (`AssertionError` on `/api/reports/`).
- A `@property target_type` replaced the model field of the same name. The model couldn't save, and migration 0005 was missing the field (fixed in 0006).
- `ReportAdminForm.__init__` raised `KeyError: 'post'` on read-only report pages. It now checks that the field exists.
- In the admin, a comment report could point at a different post, and anyone could be set as the reviewer.
- Reports were cascade-deleted along with their content, so removals left no record.
- Mods could act on reports about their own content.
- `ModerationLog.__str__` labeled `content_deleted` entries "deleted user". They now show "system".
- Author self-deletes of reported content were mixed in with moderator actions in the ModerationLog admin. They're now hidden by default behind the Log type filter.

## Known issues / optional

- When a mod removes a post, its comments are deleted along with it. Any of those comments with open reports gets its own `content_deleted` / `system` entry from the `pre_delete` signal, labeled "not by a mod" even though a mod caused it. The Log type filter hides these. Crediting them to the mod is not built yet.
- `__str__` shows "system" for every `content_deleted` entry, including author deletes made through the API (source `app`). The `source` column has the exact origin.
- `views.py` still imports `BasePermission` and `SAFE_METHODS`, which are unused.
- Optional, not applied:
  - `errorMessage.js` could replace Django's HTML error page (shown on any 500) with "Server error. Please try again."
  - A `LOGGING` block in `settings.py` would print 500 errors to the terminal when `DEBUG=False`.
- Not built yet:
  - A History tab on `/mod`, reading `?status=closed` or a new log endpoint.
  - A read-only `/api/mod-log/` endpoint.

## Test checklist

| Action | Expected |
|---|---|
| Report someone's post / comment | `201`. The button shows "Reported" (comments) or an alert (posts). |
| Report the same thing again | `200 "You already reported this."` |
| Report your own content (API or admin) | Refused |
| `/mod` as a regular user | "Moderators only" |
| Remove a reported post on `/mod` | Report closed with outcome Removed post. Log: `remove_post` / `app` / via reports ✓ |
| Dismiss on `/mod` | All reports on that item closed. Log: `dismiss` |
| "Delete (mod)" on an unreported comment | Log: `remove_comment` / via reports ✗ / 0 |
| A report about your own content on `/mod` | No buttons, shows the note |
| "Dismiss selected reports" in the admin | Log source `admin` |
| Author deletes their own reported post | Log: `content_deleted`, no moderator |
| Delete a user who has reported posts | Log: `content_deleted` / `system` |
| Open the ModerationLog admin | "Mod actions" selected. No `content_deleted` rows. |
| Log type → Author deletions (system) | Only `content_deleted` rows, each labeled "system: Content deleted (not by a mod)" |
| Report outcome after an author deletes reported content | Still "Content deleted (not by a mod)" |
