# Backend API Reference: For the Frontend Team

_Last updated: 2026-11-07. Covers every change in `update docs/` through private profiles and follow requests._

## Base URL
- **Live (deployed)**: `https://quickbuckz.onrender.com/api/`
- Local development: `http://127.0.0.1:8000/api/`
- `GET /api/` returns links to the main endpoints (posts, profiles, signup, token, notifications, reports).

**Every URL ends with a trailing slash** (`/api/token/refresh/`, not `/api/token/refresh`). If you add query strings, add them after the slash: `/api/reports/?type=post`.

---

## Authentication
The API uses JWT. Every authenticated request needs this header:
```
Authorization: Bearer <access_token>
```

| Token | Lifetime |
|---|---|
| Access | 15 minutes |
| Refresh | 7 days (not rotated, and not revoked on logout) |

### Login
```
POST /api/token/
Content-Type: application/json

{ "username": "...", "password": "..." }
```
- `username` can be the account's **username or email**, in any capitalization.
- `200` → `{ "access": "<jwt>", "refresh": "<jwt>" }`
- `401` → `{ "detail": "No active account found with the given credentials" }`

### Refresh the access token
```
POST /api/token/refresh/
Content-Type: application/json

{ "refresh": "<refresh_token>" }
```
- `200` → `{ "access": "<new_jwt>" }`
- An expired access token returns `401` with `"code": "token_not_valid"`. Refresh it and retry once. If the refresh also fails, log the user out.

### Signup
```
POST /api/signup/
Content-Type: application/json

{ "username": "...", "email": "...", "password": "...", "first_name": "...", "last_name": "..." }
```
- `first_name` and `last_name` are optional (up to 150 characters each, capitalization kept).
- `201` → `{ "username", "email", "first_name", "last_name" }`. The password is never returned, and missing names come back as `""`.
- A Profile is created automatically.
- Signup does **not** return tokens. Call `/api/token/` afterwards with the same username and password.

**Username rules**
- 4–20 characters: letters, numbers, `_` and `.` only
- No dot at the start or end, no `..`, and no more than two `_` in a row
- At least two letters or numbers, and at least one letter
- Reserved and rejected: `me`, `follow`, `following`, `followers`, `posts`, `admin`
- Case-insensitive and unique. Usernames are stored and returned in **lowercase**, so don't compare them against what the user typed.

**Email:** unique (case-insensitive), stored lowercase.

**Password:** at least 8 characters, not a common password, not all digits, and not too similar to the username or email.

**Errors** (`400`) are keyed by field, and every failing rule is listed:
```json
{
  "username": ["A user with that username already exists."],
  "email": ["user with this email already exists."],
  "password": ["This password is too common.", "This password is entirely numeric."]
}
```
Other username messages: `Usernames must be 4-20 characters: letters, numbers, underscores, and dots only.`, `Usernames cannot start or end with a dot.`, `Usernames cannot contain consecutive dots.`, `Usernames cannot contain more than two underscores in a row.`, `Usernames need at least two letters or numbers.`, `Usernames need at least one letter.`, `Usernames cannot use reserved words.`

### Sending tokens to public endpoints
Public endpoints work without a token, and sending a **valid** token gives you viewer-specific fields (`is_liked`, `is_followed`, and so on). But a request with an **expired or invalid** `Authorization` header gets `401` **even on a public endpoint**. Refresh first, or leave the header off.

---

## Endpoints at a glance

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/signup/` | No | Create an account |
| POST | `/api/token/` | No | Log in |
| POST | `/api/token/refresh/` | No | New access token |
| **Profiles** | | | |
| GET | `/api/profiles/` | Optional | List public profiles (+ your own) |
| GET | `/api/profile/me/` | **Yes** | Your own editable profile |
| PATCH / PUT | `/api/profile/me/` | **Yes** | Edit your profile |
| GET | `/api/profile/<username>/` | Optional | One profile (full, or a locked card) |
| GET | `/api/profile/<username>/posts/` | Optional | That user's posts |
| **Follows** | | | |
| POST | `/api/profile/<username>/follow/` | **Yes** | Follow (or request to follow a private account) |
| DELETE | `/api/profile/<username>/follow/` | **Yes** | Unfollow / cancel a request |
| GET | `/api/profile/<username>/followers/` | Optional* | Who follows them |
| GET | `/api/profile/<username>/following/` | Optional* | Who they follow |
| GET | `/api/profile/<username>/mutuals/` | **Yes** | People you follow who follow them |
| GET | `/api/follow-requests/` | **Yes** | Your pending incoming requests |
| POST | `/api/follow-requests/<username>/` | **Yes** | Accept a request |
| DELETE | `/api/follow-requests/<username>/` | **Yes** | Decline a request |
| **Posts** | | | |
| GET | `/api/posts/` | Optional | Feed, newest first |
| POST | `/api/posts/` | **Yes** | Create a post |
| GET | `/api/posts/<id>/` | Optional | One post with all comments |
| PATCH / PUT | `/api/posts/<id>/` | **Yes** (author) | Edit a post |
| DELETE | `/api/posts/<id>/` | **Yes** (author or mod) | Delete a post |
| POST | `/api/posts/<id>/like/` | **Yes** | Like |
| DELETE | `/api/posts/<id>/like/` | **Yes** | Unlike |
| GET | `/api/posts/<id>/comment/` | Optional | All comments, oldest first |
| POST | `/api/posts/<id>/comment/` | **Yes** | Add a comment |
| DELETE | `/api/posts/<id>/comment/?comment_id=<id>` | **Yes** | Delete a comment |
| POST | `/api/posts/<id>/report/` | **Yes** | Report a post or one of its comments |
| **Notifications** | | | |
| GET | `/api/notifications/` | **Yes** | Your notifications |
| POST | `/api/notifications/mark-all-read/` | **Yes** | Mark as read |
| GET | `/api/notifications/unread-count/` | **Yes** | Bell badge count |
| **Moderation** | | | |
| GET | `/api/users/me/role/` | **Yes** | Can I open the mod page? (`204` yes / `403` no) |
| GET | `/api/reports/` | **Yes** (mod) | Report queue |
| GET | `/api/reports/<id>/` | **Yes** (mod) | One report |
| POST | `/api/reports/<id>/dismiss/` | **Yes** (mod) | Dismiss all open reports on that item |

\* Using `me` as the username requires a token.

---

## Profiles

### Who can see a profile's content
| Viewer | Can see |
|---|---|
| Logged out | Public profiles |
| Logged in | Public profiles, your own, **and private profiles you follow** |

This rule applies to the feed, profile detail, a user's posts, follower/following/mutuals lists, likes and comments. **Exception:** `GET /api/profiles/` shows only public profiles and your own. Private profiles you follow are left out.

### `GET /api/profiles/`
A list of public profile objects (shape below). Not paginated.

### Public profile shape
Used by `/api/profiles/` and by `/api/profile/<username>/` for **logged-out** viewers.
```json
{
  "id": 1,
  "user": 1,
  "username": "ada_l",
  "first_name": "Ada",
  "last_name": "Lovelace",
  "bio": "text",
  "profile_picture": "https://…/profile_pictures/….jpg",
  "banner": null,
  "birthday": "2000-05-14",
  "followers_count": 87,
  "following_count": 142,
  "created_at": "2026-09-20T21:37:22.376608Z",
  "theme": "classic",
  "right_picture": null,
  "right_picture_flip": false,
  "right_picture_tile": false,
  "left_picture": null,
  "left_picture_flip": false,
  "left_picture_tile": false
}
```
- `user` is the numeric user ID. `username` is lowercase. Names are `""` when not set.
- Image fields are full URLs, or `null`.
- Everything is read-only.

### `GET /api/profile/<username>/`
| Viewer | Status | Shape |
|---|---|---|
| Can see the profile, logged in | `200` | **Detail** = public shape + `is_followed`, `follows_you`, `is_self`, `is_requested`, `visibility` |
| Can see the profile, logged out | `200` | Public shape (no viewer fields) |
| Private and you don't follow them (logged in or out) | `200` | **Locked card** |
| Username doesn't exist | `404` | |

Extra detail fields:
| Field | Meaning |
|---|---|
| `is_self` | This is you. Show "Edit profile" instead of Follow |
| `is_followed` | You follow them. Show Follow / Unfollow |
| `follows_you` | They follow you. Show a "Follows you" badge |
| `is_requested` | You have a pending follow request to them. Show "Requested" |
| `visibility` | `"public"` or `"private"`. If private, unfollowing locks the profile again |

Locked card:
```json
{
  "id": 12,
  "username": "alice",
  "first_name": "Alice",
  "last_name": "Ng",
  "profile_picture": "https://…",
  "visibility": "private",
  "followers_count": 40,
  "following_count": 31,
  "is_followed": false,
  "follows_you": false,
  "is_self": false,
  "is_requested": true,
  "is_locked": true
}
```
**Rule:** if `is_locked` is `true`, don't fetch their posts or follower/following lists, because those return `404`. Full profiles don't include `is_locked` at all.

### `GET /api/profile/me/` (owner shape)
```json
{
  "id": 1,
  "user": 1,
  "username": "ada_l",
  "first_name": "Ada",
  "last_name": "Lovelace",
  "bio": "text",
  "profile_picture": null,
  "banner": null,
  "birthday": "2000-05-14",
  "visibility": "public",
  "followers_count": 87,
  "following_count": 142,
  "created_at": "2026-09-20T21:37:22.376608Z",
  "theme": "classic",
  "right_picture": null,
  "right_picture_flip": false,
  "right_picture_tile": false,
  "left_picture": null,
  "left_picture_flip": false,
  "left_picture_tile": false
}
```

### `PATCH /api/profile/me/`
Use **PATCH** and send only the fields you're changing (PUT expects every writable field).

| Writable field | Rules |
|---|---|
| `first_name`, `last_name` | Up to 150 characters. Use `""` to clear (`null` returns `400`). Spaces at the ends are trimmed |
| `bio` | Text, can be blank |
| `visibility` | `"public"` or `"private"`. Anything else returns `400` |
| `birthday` | `YYYY-MM-DD` or `null`. Can't be in the future (`Birthday cannot be in the future.`), and the user must be at least 12 (`You must be at least 12 years old per TOS.`) |
| `theme` | Text, up to 256 characters (default `"classic"`) |
| `profile_picture`, `banner`, `left_picture`, `right_picture` | Image files, **under 5 MB** each (`Image must be under 5 MB.`) |
| `left_picture_flip`, `left_picture_tile`, `right_picture_flip`, `right_picture_tile` | Booleans |

- Read-only (ignored if sent): `id`, `user`, `username`, `followers_count`, `following_count`, `created_at`.
- For images, send `multipart/form-data` (`formData.append('banner', file)`). Text fields can go in the same request.
- `200` returns the full owner shape. Use it to update local state instead of fetching again.
- `400` errors are keyed by field, e.g. `{"first_name": ["Ensure this field has no more than 150 characters."]}`.
- `POST /api/profiles/` returns `405`, because profiles are created at signup.

---

## Follows

### `POST /api/profile/<username>/follow/`
No body.
| Situation | Status |
|---|---|
| Public target, new follow | `201` |
| Already following | `200` (no change) |
| Private target, new follow request | `202` |
| Private target, request already pending | `200` (no change) |
| Yourself | `400` `{"detail": "You can't follow yourself."}` |
| Username doesn't exist | `404` |

### `DELETE /api/profile/<username>/follow/`
Unfollows **and** cancels any pending request, so one call covers both "Unfollow" and "Cancel request". Repeating it is safe (`200`). It works even if the target has gone private. Returns `404` only if the username doesn't exist.

### Response (both methods)
```json
{ "is_followed": false, "is_requested": true, "followers_count": 40 }
```
`followers_count` doesn't change while a request is pending.

**Button logic:** `method = (is_followed || is_requested) ? 'DELETE' : 'POST'`, then copy the three fields from the response.

### Follow lists: `/followers/`, `/following/`, `/mutuals/`
Each returns an array, newest follow first. Not paginated.
```json
[
  {
    "username": "samp",
    "first_name": "Sam",
    "last_name": "Patel",
    "bio": "…",
    "profile_picture": null,
    "followed_at": "2026-10-17T18:04:11.532Z",
    "is_following": true
  }
]
```
- `is_following`: whether **you** follow that person (always `false` without a token, and always `true` in `/mutuals/`).
- `me` works as the username for your own lists (`/api/profile/me/followers/`). It needs a token, or you get `401`.
- `404` if the user doesn't exist or you can't see their profile (private and not followed).
- People with private profiles you can't see are left out of the list, so a list can be shorter than `followers_count`.
- `/mutuals/` lists the people you follow who also follow `<username>` ("Followed by alex, jordan and 3 others"). It needs a token (`401` otherwise) and returns `[]` for yourself.

### Follow requests (incoming, for private accounts)
**`GET /api/follow-requests/`** returns your pending requests, newest first:
```json
[
  {
    "id": 3,
    "username": "bob",
    "first_name": "Bob",
    "last_name": "",
    "profile_picture": "https://…",
    "created_at": "2026-11-07T08:30:12.123456Z"
  }
]
```
| Request | Result |
|---|---|
| `POST /api/follow-requests/<username>/` | Accept: `200` `{"detail": "Request accepted."}`. They now follow you, and you get a normal "followed you" notification |
| `DELETE /api/follow-requests/<username>/` | Decline: `200` `{"detail": "Request declined."}` |
| Either, with no pending request from that user to you | `404` |

---

## Posts

### Post shape
```json
{
  "id": 42,
  "author": "samp",
  "content": "text of the post",
  "image": null,
  "created_at": "2026-10-12T19:47:55.960327Z",
  "likes_count": 12,
  "comments_count": 5,
  "comments": [ /* up to 3 latest comments, oldest → newest */ ],
  "is_liked": true
}
```
- `author` is the author's **username** (a string).
- `comments` in lists is a **preview of the 3 latest**. Use `comments_count` to show "View all 5 comments".
- `is_liked` is whether you liked it (always `false` without a token).
- `GET /api/posts/<id>/` returns the same shape, but `comments` holds **every** comment, oldest first.

### Comment shape
```json
{
  "id": 1,
  "post": 42,
  "author": {
    "username": "ratdog",
    "first_name": "",
    "last_name": "",
    "profile_picture": null
  },
  "content": "first comment",
  "created_at": "2026-10-12T21:55:36.138331Z"
}
```
`comment.author` is an **object**, so use `comment.author.username` for the name.

### Feed and lists
- `GET /api/posts/`: posts from every profile you can see, newest first. Not paginated.
- `GET /api/profile/<username>/posts/`: one user's posts, same shape. Returns `404` if the user doesn't exist or their profile is locked to you. `me` does **not** work here, so use your own username.

### Create: `POST /api/posts/`
- Body: `content` (**required**) and optional `image` (send `multipart/form-data` when you include an image).
- Don't send `author`, because it's taken from your token.
- `201` returns the new post (`likes_count: 0`, `comments: []`, `is_liked: false`).

### Edit and delete
| Request | Author | Moderator / admin | Other user | No token |
|---|---|---|---|---|
| `PATCH` / `PUT /api/posts/<id>/` | `200` | `403` | `403` | `401` |
| `DELETE /api/posts/<id>/` | `204` | `204` | `403` | `401` |

- A post you can't see returns `404`. Moderators can still delete posts from private accounts.
- `DELETE` returns **`204` with no body**, so don't call `response.json()` on it.
- Show the Edit/Delete menu when `post.author` equals the logged-in username.

### Like: `POST` / `DELETE /api/posts/<id>/like/`
```json
{ "is_liked": true, "likes_count": 12 }
```
- `POST`: `201` for a new like, `200` if you'd already liked it. `DELETE`: always `200`.
- **Button logic:** `method = post.is_liked ? 'DELETE' : 'POST'`.
- `404` if the post doesn't exist or you can't see it.

### Comments
| Request | Result |
|---|---|
| `GET /api/posts/<id>/comment/` | All comments, oldest first |
| `POST /api/posts/<id>/comment/` with `{"content": "..."}` | `201` + the new comment. A missing `content` returns `400` |
| `DELETE /api/posts/<id>/comment/?comment_id=7` | `204` (no body). Allowed for the comment's author, the post's author, and moderators |

Delete errors: `400` `{"detail": "comment_id is required."}`, `403` `{"detail": "You can't delete this comment."}`, `404` if the comment isn't on that post.

### Report: `POST /api/posts/<id>/report/`
```json
{ "reason": "Spam" }                       // report the post
{ "reason": "Harassment", "comment_id": 7 } // report a comment on that post
```
| Case | Response |
|---|---|
| New report | `201` `{"id", "reason", "status": "open", "created_at"}` |
| You already have an open report on it | `200` `{"detail": "You already reported this."}` |
| Your own post or comment | `400` `{"detail": "You can't report your own content."}` |
| Blank or missing `reason` | `400` `{"reason": ["Please give a reason."]}` (max 200 characters) |
| Post or comment not found or not visible | `404` |

Show the backend's `detail` message to the user.

---

## Notifications
Created automatically by the backend when someone **follows you, likes your post, or comments on your post**. The frontend never creates them. Unlike, unfollow and comment deletion remove the matching notification. You never get notifications for your own actions.

### `GET /api/notifications/`
Newest first, not paginated.
```json
[
  {
    "id": 12,
    "type": "comment",
    "actor_username": "samp",
    "actor_name": "Sam Patel",
    "actor_avatar": "https://…",
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
| `type` | `"follow"`, `"like"` or `"comment"` |
| `actor_name` | Full name, or the username if no name is set |
| `actor_avatar` | Full URL or `null` |
| `post`, `post_preview` | `null` for follows. The preview is the first 60 characters, so add the `…` yourself |
| `comment_text` | Only for comments, otherwise `null` |
| `is_following_actor` | Use it to show or hide "Follow back" |

### `POST /api/notifications/mark-all-read/`
- Optional body `{"up_to_id": 12}` marks only IDs ≤ 12. Send the highest ID you **displayed**, so anything that arrived later stays unread.
- `200` → `{"marked_read": 3}`
- `400` → `{"up_to_id": "Must be a positive integer."}` for non-numbers, booleans, or values below 1.

**Page-load order:** fetch the list → highlight "New" items from `read: false` → call mark-all-read with the highest displayed `id`.

### `GET /api/notifications/unread-count/`
`{ "unread": 3 }`, for the bell badge.

---

## Moderation (mods and admins only)

Roles are `user`, `mod` and `admin` (admins count as mods). They're set only in the Django admin, and no API response says what role someone has.

### `GET /api/users/me/role/`
| Who | Status |
|---|---|
| Moderator / admin | `204` (no body) |
| Regular user | `403` |
| No token | `401` |

Treat anything other than `204` as "no access", and render nothing on `/mod` until the check finishes. This only controls the UI: the server checks permissions on every action anyway.

### `GET /api/reports/`
Query params: `status=open` (default) | `closed` | `all`, and `type=post` | `comment`.
```json
[
  {
    "id": 5,
    "type": "comment",
    "reason": "Harassment",
    "status": "open",
    "reporter": "bob",
    "created_at": "2026-11-01T10:00:00Z",
    "reviewed_by": null,
    "reviewed_at": null,
    "outcome": null,
    "target_author": "alice",
    "target_content": "the reported text",
    "can_review": true,
    "post": { "id": 42, "author": "samp", "content": "…", "image": null, "created_at": "…" },
    "comment": { "id": 7, "author": "alice", "content": "…", "created_at": "…" }
  }
]
```
- `reviewed_by`, `reviewed_at` and `outcome` are `null` while the report is open. `outcome` is one of `remove_post`, `remove_comment`, `dismiss`, `content_deleted`.
- `post` / `comment` become `null` once the content is deleted. Use `target_author` / `target_content` for the saved copy.
- `can_review: false` means the report is about **your own** content: hide the buttons and say another moderator has to review it.
- Multiple users can report the same item. Group the reports by `post.id` / `comment.id` into one card.
- `401` with no token, `403` for non-mods.

### Acting on reports
| Action | Request | Result |
|---|---|---|
| Remove | The normal delete: `DELETE /api/posts/<id>/` or `DELETE /api/posts/<id>/comment/?comment_id=<id>` | `204`. Closes the item's open reports and logs it |
| Dismiss | `POST /api/reports/<id>/dismiss/` | `200` `{"dismissed": n}`, which closes **every** open report on that item |
| Dismiss a report on your own content | | `403` |

Reload the queue after either action, because deleting a post also closes reports on its comments.

---

## Errors
| Status | Meaning | Body |
|---|---|---|
| `400` | Bad input | `{"field": ["message", ...]}` or `{"detail": "..."}` |
| `401` | Missing, expired or invalid token | `{"detail": "...", "code": "token_not_valid"}` |
| `403` | Logged in but not allowed | `{"detail": "..."}` |
| `404` | Doesn't exist, or you're not allowed to see it | `{"detail": "No … matches the given query."}` |
| `405` | Method not allowed | |
| `204` | Success with **no body** (post/comment delete, role check). Handle it before calling `response.json()` | |
| `500` | Server error (Django may return an HTML page, not JSON) | |

---

## CORS
Allowed origins: `http://localhost:5173` (Vite dev) and `https://quickbuckz-1.onrender.com` (deployed frontend). When the backend runs with `DEBUG=True`, all origins are allowed. If the frontend moves to a new URL, ask for it to be added to `CORS_ALLOWED_ORIGINS` in `config/settings.py`.

---

## Known gaps / not built yet

**Bugs (open)**
- `birthday` is sent to everyone on `/api/profiles/` and `/api/profile/<username>/`, including logged-out visitors. Don't rely on this. It's meant to be owner-only and will likely be removed from public responses.
- A non-numeric `comment_id` (`?comment_id=abc`, or `"comment_id": "abc"` in a report) causes a `500` instead of a `400`. Only send numeric IDs.
- You can't unlike a post after its author's profile goes private and you don't follow them: `DELETE /like/` returns `404` and the like stays.
- `POST /api/reports/<id>/dismiss/` on an already-closed report returns `404` instead of `400`, because the lookup only checks open reports. It returns the intended `400` only if you add `?status=all`.

**Behavior to know about**
- Nothing is paginated: posts, profiles, follow lists, notifications and reports all return every row.
- `GET /api/profiles/` hides private profiles even from their followers, so private accounts can't be found by search.
- Pending follow requests stay pending if the account switches to public.
- `followers_count` / `following_count` include private accounts, so they can be higher than the number of rows another viewer sees in a list.
- Image-only posts aren't possible, because `content` is required.
- Posts have no edit timestamp in responses (`updated_at` isn't returned).
- There's no change-password, password-reset or logout endpoint. Refresh tokens stay valid until they expire (7 days).
- There's no notification for a new follow request, and no API to mark notifications unread.
- There's no moderation-history endpoint yet (`?status=closed` on `/api/reports/` is the closest).