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
| Follow lists | Did not exist (frontend used hard-coded `sampleFollowing` / `sampleFollowers`) | `GET /api/profile/<username>/following/` and `/followers/`. `me` works as the username for the logged-in user |
| Profile counts | Sample values in the frontend | `followers_count` and `following_count` on public profiles (`/api/profiles/`, `/api/profile/<username>/`) |
| Usernames | No reserved words | `me`, `follow`, `following`, `followers`, `posts` and `admin` are rejected at signup |
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

The reverse names are each named after the *other* end of the row, which is easy to mix up:

| Relation | Holds | `.count()` means |
|---|---|---|
| `user.follower_set` | `Follow` rows where this user is being followed | number of **followers** |
| `user.following_set` | `Follow` rows where this user is the follower | number of people they're **following** |

### Reserved usernames (`accounts/validators.py`)

`validate_username_rules` now rejects `me`, `follow`, `following`, `followers`, `posts` and `admin`, with the error `Usernames cannot use reserved words.` This prevents usernames from colliding with routes. For example, a user named `me` would clash with `/api/profile/me/`, and with `me` as the username in the follow-list URLs. Existing accounts that already have one of these names aren't changed.

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

The follow toggle and the notification endpoints require a JWT (`Authorization: Bearer <access token>`). Without one they return `401`. The follow lists and profile counts can also be read without logging in (see each endpoint).

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

### `GET /api/profile/<username>/following/` and `GET /api/profile/<username>/followers/`
`/following/` lists who `<username>` follows. `/followers/` lists who follows `<username>`. Both are sorted by most recent follow first and aren't paginated. Use `me` as the username for the logged-in user's own lists (`/api/profile/me/following/`).

A login token is optional, except with `me`.

```json
[
  {
    "username": "samp",
    "first_name": "Sam",
    "last_name": "Patel",
    "bio": "Weekend road trips around Southcentral Alaska.",
    "profile_picture": null,
    "followed_at": "2026-10-17T18:04:11.532Z",
    "is_following": true
  }
]
```

| Field | Notes |
|---|---|
| `followed_at` | When that follow happened |
| `is_following` | Whether the **logged-in viewer** follows this person. Lets the frontend show a Follow or Following button on each row. Always `false` without a token |

| Case | Response |
|---|---|
| `me` without a token | `401` |
| `<username>` doesn't exist, or has a private profile (unless it's you) | `404` |
| A person in the list has a private profile | Left out of the list, unless it's you. This matches `GET /api/profiles/` |

Implementation: `FollowListView` in `accounts/views.py` serves both URLs. `as_view(direction="following")` or `as_view(direction="followers")` in `urls.py` picks the list. It takes profiles from `visible_profiles()`, selects the users on the other side of the target's `Follow` rows, and adds `followed_at` (a subquery) and `is_following` (an `Exists`) to each row. The subquery approach avoids the duplicate rows that ordering through the `Follow` join can cause.

**Status:** Not yet tested over HTTP.

### Follower and following counts on profiles
`followers_count` and `following_count` are now included in `PublicProfileSerializer`. That means they appear in `GET /api/profiles/` and `GET /api/profile/<username>/`:

```json
{ "username": "samp", "followers_count": 87, "following_count": 142 }
```

They use `source='user.follower_set.count'` and `source='user.following_set.count'`, the same pattern as `likes_count` on posts. The counts are calculated on every request, so follows and unfollows show up immediately.

They are **not** in `OwnerProfileSerializer` yet, so `GET /api/profile/me/` doesn't return them (section 8).

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
| `accounts/views.py` | Added `FollowToggleView` and `FollowListView` |
| `accounts/serializers.py` | Added `FollowListSerializer`. Added `followers_count` and `following_count` to `PublicProfileSerializer` |
| `accounts/urls.py` | Added `profile/<str:username>/follow/`, `profile/<str:username>/following/` and `profile/<str:username>/followers/` |
| `accounts/validators.py` | Added the reserved-username check |
| `accounts/admin.py` | Registered `Follow` |
| `accounts/migrations/0003_follow.py` | New migration |
| `notifications/` | New app: `models.py`, `signals.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `apps.py` |
| `notifications/apps.py` | `ready()` imports `signals`. Without this, no notifications are created |
| `notifications/views.py` | `MarkAllReadView` validates `up_to_id` and returns `400` for bad values. Before this fix, a non-numeric value caused a `500` |
| `notifications/migrations/0001_initial.py` | New migration |
| `posts/admin.py` | Registered `Comment` |
| `config/settings.py` | Added `'notifications'` to `INSTALLED_APPS` |
| `config/urls.py` | Added `path('api/', include('notifications.urls'))` |

The only change to an existing response is that `GET /api/profiles/` and `GET /api/profile/<username>/` now also include `followers_count` and `following_count`. Nothing was removed or renamed. Signup now also rejects reserved usernames. `PostViewSet.like` and `PostViewSet.comment` are unchanged, because the signals handle notifications.

---

## 7. Team workflow

### What each teammate needs to do
1. Pull the changes.
2. Run `python manage.py migrate`. This applies `accounts/0003_follow` and `notifications/0001_initial`. On the shared database, only one person needs to do this. Running it again is harmless.
3. Restart `runserver`. Signals are connected at startup, so a server that was already running won't create notifications.

### Updates needed in `frontend_api_reference.md`
- Add the endpoints from section 4: the follow toggle, both follow lists, and the three notification endpoints.
- Add `followers_count` and `following_count` to the public profile response.
- Note that follow, like and comment notifications are created automatically, so the frontend never creates them.
- Note the reserved usernames.

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

### Frontend wiring (Following, Followers and profile pages)

| Frontend now (`store.jsx` sample data) | API |
|---|---|
| `sampleFollowing` / store's `following` list | `GET /api/profile/me/following/` |
| `sampleFollowers` | `GET /api/profile/me/followers/` |
| Another user's lists | `GET /api/profile/<handle>/following/` and `/followers/` |
| `following.includes(handle)` for a Follow button in a list | `is_following` on each row |
| `sampleUsers[handle].followers` / `.following` | `followers_count` / `following_count` |

The `_count` names keep the counts distinct from the list endpoints. The frontend's sample data calls them `followers` and `following`.

---

## 8. Pending work and known gaps

- **Known gap: `GET /api/profile/me/` has no counts.** `followers_count` and `following_count` were added to `PublicProfileSerializer` only. Add the same two fields, and their entries in `fields`, to `OwnerProfileSerializer`. Keep them `read_only=True`, because that serializer also handles PATCH.
- **Known gap: the reserved-username check misses capital letters.** The validator compares the name exactly as typed, before it's lowercased:
  - **Signup is safe**, because `RegisterSerializer` lowercases the username first.
  - **The admin and `createsuperuser` aren't:** `ME` or `Admin` passes the check, then `User.save()` stores it as `me` or `admin`.
  - **Fix:** compare `value.lower()` against the list.
- **Pending: tests.** `notifications/tests.py` and `accounts/tests.py` don't cover any of this yet. Cases worth covering:
  - like, unlike and self-like
  - comment and comment delete
  - follow and unfollow
  - post delete removes its notifications
  - mark-all-read only touches your own notifications, and respects `up_to_id`
  - mark-all-read rejects invalid `up_to_id` values (the cases in section 9, as automated tests)
  - every notification endpoint returns `401` without a token
  - follow lists:
    - correct people in each direction, newest first
    - `me` works with a token and returns `401` without one
    - private target returns `404`
    - private users are left out of other viewers' lists
    - `is_following` is correct for the viewer
  - counts go up and down with follow and unfollow
  - reserved usernames are rejected, in any capitalization
- **Pending: finish testing `up_to_id`.** See "Still to test" in section 9.
- **Pending: pagination.** `GET /api/notifications/` and the follow lists return every row. That's fine for now, but they should get pagination before real usage.
- **Known gap: counts cost two queries per profile.** On `GET /api/profiles/`, 50 profiles means 100 extra `COUNT` queries. If that gets slow, calculate the counts in the queryset with `annotate()`. `MyProfileView` would still need a `.count()` fallback, because it loads the profile directly instead of through a queryset.
- **Known gap: list counts and list lengths can differ.** Counts include private accounts, but the lists hide private accounts from other viewers. So `followers_count` can be higher than the number of rows another user sees in `/followers/`.
- **Pending: no way to mark notifications unread through the API.** Each mark-all-read test uses up its unread notifications. New ones have to be created for every run, or reset with the admin's "Mark selected as unread" action.
- **Known gap: private profiles can't be followed.** `FollowToggleView` uses `visible_profiles`, so following a private profile returns `404`. For the same reason, a private user's follow lists return `404` to everyone else. Follow requests for private accounts aren't designed yet.
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
