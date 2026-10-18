# Backend Change Log: Follows and Notifications

This document covers the backend work that adds a follow system and in-app notifications (follows, likes and comments). It is the backend support for the frontend's Notifications page (`frontend/src/pages/Notifications.jsx`), which still runs on sample data from `frontend/src/data/store.jsx`. It sits alongside `README.md`, `frontend_api_reference.md` and the other files in `update docs/`. Section 7 lists what `frontend_api_reference.md` is missing.

**Status labels used below**
- **Verified**: tested for real, in the Django admin or shell, or by sending requests to a local dev server.
- **Not yet tested over HTTP**: the logic is in place, but no request has been sent to the API endpoint to confirm it.
- **Pending**: not built yet.

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| Follows | Did not exist (frontend used a hard-coded `following` list) | New `accounts.Follow` model, plus a toggle endpoint `POST /api/profile/<username>/follow/` |
| Notifications | Did not exist (frontend used hard-coded `sampleNotifications`) | New `notifications` app with a `Notification` model |
| Notification creation | n/a | Automatic, through Django signals on `Like`, `Comment` and `Follow`. No view code calls it directly |
| Notification API | n/a | List, mark-all-read and unread-count endpoints under `/api/notifications/` |
| Admin | `Post`, `Like` registered | Also `Follow`, `Notification` and `Comment` |
| Database | n/a | Two new migrations: `accounts/0003_follow` and `notifications/0001_initial` |

Why: the Notifications page needs real data for "followed you", "liked your post" and "commented on your post". Follow notifications and the page's "Follow back" button can't work without a follow system, so that was built first.

---

## 2. Models

### `Follow` (`accounts/models.py`)

| Field | Type | Notes |
|---|---|---|
| `follower` | FK → `User`, `CASCADE` | The user doing the following. Reverse name: `user.following_set` |
| `following` | FK → `User`, `CASCADE` | The user being followed. Reverse name: `user.follower_set` |
| `created_at` | `DateTimeField(auto_now_add=True)` | |

Constraints:
- `unique_follow`: a user can follow another user only once.
- `no_self_follow` (`CheckConstraint`): `follower` and `following` can't be the same user. The database enforces this, so it also applies to the admin and the shell, not just the API.

### `Notification` (`notifications/models.py`)

| Field | Type | Notes |
|---|---|---|
| `recipient` | FK → `User`, `CASCADE` | Who sees the notification. Reverse name: `user.notifications` |
| `actor` | FK → `User`, `CASCADE` | Who did the action. No reverse name (`related_name="+"`) |
| `type` | `CharField`, choices `follow` / `like` / `comment` | `Notification.Type.FOLLOW`, `.LIKE`, `.COMMENT` |
| `post` | FK → `posts.Post`, nullable, `CASCADE` | Set for `like` and `comment`; `null` for `follow` |
| `comment` | FK → `posts.Comment`, nullable, `CASCADE` | Set for `comment` only |
| `read` | `BooleanField(default=False)` | |
| `created_at` | `DateTimeField(auto_now_add=True)` | |

- Default ordering is newest first (`-created_at`).
- Index on `(recipient, read)`, so the unread-count and mark-all-read queries stay fast.
- Because `post` and `comment` use `CASCADE`, deleting a post or comment also deletes its notifications. The frontend doesn't need to handle a notification that points to a deleted post. It still has a fallback message, which is harmless to keep.

---

## 3. How notifications are created

All creation and cleanup happens in `notifications/signals.py`, which `NotificationsConfig.ready()` in `notifications/apps.py` connects at startup.

| Event | Result |
|---|---|
| A `Like` is created | `like` notification to the post's author |
| A `Like` is deleted (unlike) | The matching `like` notification is deleted |
| A `Comment` is created | `comment` notification to the post's author, linked to the comment |
| A `Comment` is deleted | Its notification is deleted (through the `comment` FK cascade) |
| A `Follow` is created | `follow` notification to the followed user |
| A `Follow` is deleted (unfollow) | The matching `follow` notification is deleted |

Rules:
- **No self-notifications.** Liking or commenting on your own post creates nothing. Following yourself is blocked by the model constraint and by the view.
- **No duplicates from toggling.** Like → unlike → like leaves one `like` notification, not three. The same goes for follow → unfollow → follow.
- **Signals fire from every code path**: the API, the admin and the shell. They do **not** fire for `bulk_create()` or `QuerySet.update()`, so seed scripts that use those won't produce notifications.

**Status:** `Follow` → `follow` notification **verified** in the admin. A second account's actions on `omgg`'s posts and profile also created a notification (ID 4) during HTTP testing (section 9), but which action created it wasn't recorded. The like, comment and unfollow/unlike cleanup signals are **not yet tested** individually.

---

## 4. API endpoints

All of these require a JWT (`Authorization: Bearer <access token>`). Without one they return `401`.

### `POST /api/profile/<username>/follow/`
Toggles following `<username>`. No request body.

```json
{ "following": true }
```
`true` means you now follow them, and `false` means you just unfollowed them.

| Case | Response |
|---|---|
| Target doesn't exist, or has a private profile | `404` |
| Target is yourself | `400` `{"detail": "You can't follow yourself."}` |

**Status:** Not yet tested over HTTP.

### `GET /api/notifications/`
Lists the logged-in user's notifications, newest first. The response is not paginated.

```json
[
  {
    "id": 12,
    "type": "comment",
    "actor_username": "samp",
    "actor_name": "Sam Patel",
    "actor_avatar": "http://127.0.0.1:8000/media/profiles/profile_pictures/3/ab12….jpg",
    "post": 7,
    "post_preview": "Finally saw the aurora from Fairbanks. Three nights of clou",
    "comment_text": "Unreal colors. What time did it show up?",
    "read": false,
    "created_at": "2026-10-17T18:04:11.532Z",
    "is_following_actor": true
  }
]
```

| Field | Notes |
|---|---|
| `actor_name` | The actor's first and last name, or their username if both are blank |
| `actor_avatar` | Absolute URL, or `null` if no profile picture |
| `post` | Post ID, or `null` for `follow` notifications |
| `post_preview` | First 60 characters of the post's content, or `null`. The frontend adds the `…` |
| `comment_text` | Full comment text for `comment` notifications, otherwise `null` |
| `is_following_actor` | Whether you already follow the actor. The frontend uses this to decide whether to show the "Follow back" button |

**Status:** **Verified over HTTP** that an authenticated request returns the user's notifications with `id` and `read` (section 9). The other fields haven't been checked one by one.

### `POST /api/notifications/mark-all-read/`
Marks the logged-in user's unread notifications as read.

Optional body: `{ "up_to_id": 12 }`. Only notifications with `id <= 12` are marked. The frontend should send the highest ID it actually displayed, so a notification that arrives between loading the list and calling this endpoint stays unread.

```json
{ "marked_read": 3 }
```

An invalid `up_to_id` returns `400`:

```json
{ "up_to_id": "Must be a positive integer." }
```

| `up_to_id` value | Result |
|---|---|
| Omitted | `200`, marks every unread notification |
| Integer ≥ 1, or a numeric string such as `"12"` | `200`, marks unread notifications with `id <=` that value |
| Non-numeric (`"abc"`), boolean (`true`/`false`), or less than 1 | `400` |
| Float (`12.7`) | Accepted, truncated to `12` |

Booleans are rejected explicitly because Python treats `True` as `1`. Without that check, `{"up_to_id": true}` would mean "mark ID 1 and below".

**Status:** **Verified over HTTP** (section 9):
- All three `400` cases.
- An `up_to_id` at or above an unread notification's ID marks it.
- An empty body returns `200`.

**Not yet verified:**
- That `up_to_id` leaves notifications with higher IDs unread.
- That an empty body marks notifications that are still unread. In the test run, nothing was left to mark.

### `GET /api/notifications/unread-count/`
For the badge on the nav bar's bell.

```json
{ "unread": 3 }
```

**Status:** Not yet tested over HTTP.

---

## 5. Admin dashboard

| Model | File | What you can do |
|---|---|---|
| `Follow` | `accounts/admin.py` | List with follower, following and date. Search by either username. Searchable user pickers in the add form |
| `Notification` | `notifications/admin.py` | Filter by type, read status and date. Search by recipient or actor. Tick `read` directly in the list. Bulk "Mark selected as read/unread" actions |
| `Comment` | `posts/admin.py` | List and search comments (wasn't registered before) |

Adding or deleting a Follow, Like or Comment in the admin runs the signals, so the admin is the quickest way to test notifications without the frontend. "Mark selected as unread" resets notifications for testing the frontend's "New" highlight.

---

## 6. Files changed

| File | Change |
|---|---|
| `accounts/models.py` | Added `Follow` model |
| `accounts/views.py` | Added `FollowToggleView` |
| `accounts/urls.py` | Added `profile/<str:username>/follow/` |
| `accounts/admin.py` | Registered `Follow` |
| `accounts/migrations/0003_follow.py` | New migration |
| `notifications/` | New app: `models.py`, `signals.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `apps.py` |
| `notifications/apps.py` | `ready()` imports `signals`. Without this, no notifications are created |
| `notifications/views.py` | `MarkAllReadView` validates `up_to_id` and returns `400` for bad values. Before this fix, a non-numeric value caused a `500` |
| `notifications/migrations/0001_initial.py` | New migration |
| `posts/admin.py` | Registered `Comment` |
| `config/settings.py` | Added `'notifications'` to `INSTALLED_APPS` |
| `config/urls.py` | Added `path('api/', include('notifications.urls'))` |

No existing endpoints or response shapes changed. `PostViewSet.like` and `PostViewSet.comment` are unchanged, because the signals handle notifications.

---

## 7. Team workflow

### What each teammate needs to do
1. Pull the changes.
2. Run `python manage.py migrate`. This applies `accounts/0003_follow` and `notifications/0001_initial`. On the shared database, only one person needs to do this. Running it again is harmless.
3. Restart `runserver`. Signals are connected at startup, so a server that was already running won't create notifications.

### Updates needed in `frontend_api_reference.md`
- Add the four endpoints from section 4.
- Note that follow, like and comment notifications are created automatically, so the frontend never creates them.

### Frontend wiring (for whoever does the Notifications page)

| Frontend now (`store.jsx` sample data) | API field |
|---|---|
| `n.handle` | `actor_username` |
| `sampleUsers[n.handle].name` | `actor_name` (`actor_avatar` is new, for `<Avatar src>`) |
| `n.postId` | `post` |
| `postPreview(n.postId)` | `post_preview` |
| `n.text` | `comment_text` |
| `n.time` | `created_at` (format with `utils/DateTimeUtils.js`) |
| `following.includes(n.handle)` | `is_following_actor` |
| `markAllRead()` | `POST /api/notifications/mark-all-read/` with `up_to_id` |
| `toggleFollowUser(handle)` | `POST /api/profile/<handle>/follow/` |
| Bell badge count | `GET /api/notifications/unread-count/` |

Order on page load: fetch the list → take the "New" highlights from the `read` flags in that response → call mark-all-read with the highest displayed `id`.

---

## 8. Pending work and known gaps

- **Pending: follower and following list endpoints.** Nothing returns who a user follows or who follows them yet. The frontend's `Following` and `Followers` pages and the store's `following` list still use sample data. Follower and following counts on profiles are also still sample values.
- **Pending: tests.** `notifications/tests.py` is empty. Cases worth covering:
  - like, unlike and self-like
  - comment and comment delete
  - follow and unfollow
  - post delete removes its notifications
  - mark-all-read only touches your own notifications, and respects `up_to_id`
  - mark-all-read rejects invalid `up_to_id` values (the cases in section 9, as automated tests)
  - every endpoint returns `401` without a token
- **Pending: finish testing `up_to_id`.** See "Still to test" in section 9.
- **Pending: pagination.** `GET /api/notifications/` returns every notification. That's fine for now, but it should get pagination before real usage.
- **Pending: no way to mark notifications unread through the API.** Each mark-all-read test uses up its unread notifications. New ones have to be created for every run, or reset with the admin's "Mark selected as unread" action.
- **Known gap: private profiles can't be followed.** `FollowToggleView` uses `visible_profiles`, so following a private profile returns `404`. Follow requests for private accounts aren't designed yet.
- **Known gap: image-only posts aren't possible.** `Post.content` is required, so the frontend's "your photo" preview never applies. Adding `blank=True` to `content` would allow image-only posts.

---

## 9. Testing log

### `POST /api/notifications/mark-all-read/` validation (2026-10-17)

**Setup**
- Local dev server at `http://127.0.0.1:8000`, test account `omgg`, JWT from `POST /api/token/`.
- Script: `test-mark-all-read.ps1`. It logs in as `omgg`, prints the unread count, then sends each test body and compares the HTTP status.
- Run it from a PowerShell prompt with `powershell -ExecutionPolicy Bypass -File .\test-mark-all-read.ps1 -Username omgg`.
- If login fails, the script uses `return` rather than `exit`, so a pasted copy doesn't close the PowerShell window.

**Run 1: no unread notifications.** `omgg` started with 0 unread notifications.

| Case | Expected | Result |
|---|---|---|
| `{"up_to_id": "abc"}` | `400` | ✅ `400` |
| `{"up_to_id": true}` | `400` | ✅ `400` |
| `{"up_to_id": 0}` | `400` | ✅ `400` |
| `{"up_to_id": 12}` | `200` + `marked_read` | ✅ `200` |
| `{}` | `200`, marks everything | ✅ `200` |

This confirmed the `400` validation. The `200` cases returned `marked_read = 0`, which would happen even if the filter were broken, so this run didn't prove marking works.

**Run 2: one unread notification.**
1. A second account interacted with `omgg`'s posts or profile. That created notification ID 4 (unread).
2. `GET /api/notifications/` as `omgg` returned `id 4, read False`.
3. The test script ran again, starting with 1 unread notification.

| Case | Expected | Result |
|---|---|---|
| `{"up_to_id": "abc"}` | `400` | ✅ `400` |
| `{"up_to_id": true}` | `400` | ✅ `400` |
| `{"up_to_id": 0}` | `400` | ✅ `400` |
| `{"up_to_id": 12}` | `200`, marks ID 4 (4 ≤ 12) | ✅ `200`, `marked_read = 1` |
| `{}` | `200`, marks the rest | ✅ `200`, `marked_read = 0`, unread now 0 |

This confirmed that a notification at or below `up_to_id` gets marked read, and that unread drops to 0 afterwards. It also confirmed `GET /api/notifications/` works with a JWT.

**Still to test**
- **`up_to_id` skips higher IDs.**
  1. Create a new unread notification for `omgg` (for example, a comment from the second account). It will get an ID above 4.
  2. Change the `12` case to an `up_to_id` below the new ID, such as `3`.
  3. Run the script again. Expected: `up_to_id = 3` → `marked_read = 0`, then `{}` → `marked_read = 1` and unread now 0.
- **Which actions create notifications.** Run 2 doesn't record which action created notification 4. Test like, comment and follow separately. Remember that likes and follows are toggles: doing one twice undoes it and deletes its notification.
