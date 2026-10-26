# Backend Change Log: Follow Status and Mutual Followers

This document covers three additions to the follow system:
- a "Follows you" flag on profiles
- a follow/unfollow state that profile pages can use directly
- a "Followed by …" list of mutual followers

It builds on `notifications_and_follows_changes.md`, which introduced the `Follow` model, the toggle endpoint and the follow lists. Section 6 lists what `frontend_api_reference.md` is missing.

**Status labels used below**
- **Verified**: tested for real, in the Django admin or shell, or by sending requests to a local dev server.
- **Not yet tested over HTTP**: the logic is in place, but no request has been sent to the API endpoint to confirm it.
- **Pending**: not built yet.

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| "Follows you" badge | No way to tell from the API | `follows_you` on `GET /api/profile/<username>/` |
| Follow/Unfollow button state | Frontend checked its own `following` list | `is_followed` on `GET /api/profile/<username>/` |
| Follow toggle response | `{ "following": true }` | Also returns `is_followed` and the updated `followers_count`. `following` is kept so existing callers don't break |
| Mutual followers ("Followed by …") | Did not exist | `GET /api/profile/<username>/mutuals/` |
| Serializers | `PublicProfileSerializer` used for both the list and the detail view | New `ProfileDetailSerializer` (subclass) for the detail view only |
| Database | n/a | **No migration.** Everything is calculated from existing `Follow` rows |

Why: a profile page needs to know how the logged-in viewer relates to the person being viewed. Before this, the frontend could only guess from sample data.

---

## 2. How the viewer is identified

There are no new auth settings. `ProfileByUsernameView` is still `AllowAny`. JWT authentication fills in `request.user` whenever the request includes `Authorization: Bearer <access token>`.

| Request | `is_followed` / `follows_you` |
|---|---|
| With a token | Real values for the logged-in viewer |
| Without a token | Always `false` |
| Viewing your own profile (`/api/profile/<your username>/`) | Always `false` (see section 5) |

**Frontend note:** `fetchBaseUrl` in `ApiContext.jsx` doesn't add the `Authorization` header yet. Profile fetches need it, or both flags will always be `false`.

---

## 3. API endpoints

### `GET /api/profile/<username>/` (changed)
Two new fields are added to the existing response:

```json
{
  "username": "samp",
  "followers_count": 87,
  "following_count": 142,
  "is_followed": true,
  "follows_you": false
}
```

| Field | Meaning |
|---|---|
| `is_followed` | The **viewer** follows this user. Use it to show "Follow" or "Unfollow" |
| `follows_you` | This user follows the **viewer**. Use it to show a "Follows you" badge |

These fields are **only** on the detail endpoint. `GET /api/profiles/` and `GET /api/profile/me/` don't include them.

**Status:** Verified that the fields appear when logged in (viewed as `brother`). The values haven't been checked against specific follow pairs yet.

### `POST /api/profile/<username>/follow/` (changed response)
The toggle works as before. The response now includes the new state, so the frontend can update the button and the count without fetching the profile again:

```json
{ "following": true, "is_followed": true, "followers_count": 88 }
```

| Field | Notes |
|---|---|
| `following` | Unchanged. Kept for existing callers |
| `is_followed` | Same value as `following`. Matches the field name on the profile |
| `followers_count` | The target's follower count after the toggle |

The error cases haven't changed (`404` for a missing or private target, `400` for yourself).

**Status:** Self-follow returning `400` is verified. The new response fields haven't been tested over HTTP.

### `GET /api/profile/<username>/mutuals/` (new)
Lists the people the **viewer follows** who also **follow `<username>`**. This is the data behind "Followed by alex, jordan and 3 others". The list is sorted by when each person followed `<username>`, newest first, and isn't paginated. A login token is required. `me` works as the username.

The response has the same row format as `/followers/`:

```json
[
  {
    "username": "alex",
    "first_name": "Alex",
    "last_name": "Kim",
    "bio": "",
    "profile_picture": null,
    "followed_at": "2026-10-20T14:02:51.118Z",
    "is_following": true
  }
]
```

`is_following` is always `true` here, because everyone in the list is someone the viewer follows.

| Case | Response |
|---|---|
| No token | `401` |
| `<username>` doesn't exist, or has a private profile (unless it's you) | `404` |
| `<username>` is yourself, or `me` | `[]` |
| A mutual follower has a private profile | Left out, the same as `/followers/` |

Frontend use: show the first two names, then "and N others" with `N = list.length - 2`. Hide the line when the list is empty.

**Status:** Not yet tested over HTTP.

---

## 4. Implementation

### `accounts/views.py`
- **`with_follow_flags(qs, viewer)`** (new helper, below `visible_profiles`):
  - For a logged-in viewer, it adds `is_followed` and `follows_you` to a profile queryset as two `Exists` subqueries.
  - For an anonymous viewer, both are `Value(False)`.
  - Everything is calculated in the same query, with no extra round trips.
- **`ProfileByUsernameView`**:
  - It now uses `ProfileDetailSerializer`.
  - It looks up the profile in `with_follow_flags(visible_profiles(viewer), viewer)`.
- **`FollowToggleView.post`**: returns the extended response described above.
- **`MutualFollowersView`** (new) subclasses `FollowListView`:
  - It reuses `get_target()` (including `me` and the `404` for private targets) and `FollowListSerializer`.
  - It overrides `permission_classes` to `IsAuthenticated`.
  - Its queryset keeps users who appear in both the target's followers and the viewer's following.
  - It adds `followed_at` from the target's `Follow` row and sets `is_following=True`.
- **Imports**: `BooleanField` was added to the `django.db.models` import, and `ProfileDetailSerializer` to the serializers import.

### `accounts/serializers.py`
- **`ProfileDetailSerializer(PublicProfileSerializer)`** (new):
  - It adds `is_followed` and `follows_you` as read-only `BooleanField`s.
  - It's a subclass, not a change to `PublicProfileSerializer`, because `ProfileListView` also uses that serializer. Its queryset doesn't have the annotations, so the extra fields would raise an `AttributeError` there.

### `accounts/urls.py`
- Added `path('profile/<str:username>/mutuals/', MutualFollowersView.as_view(), name='profile-mutuals')`.

---

## 5. Design decisions

- **The flags stay on your own profile instead of being hidden.**
  - On `/api/profile/<your username>/` both flags are `false`, which is accurate: the `no_self_follow` constraint means you never follow yourself.
  - Keeping the fields gives the detail endpoint one fixed shape. The frontend never has to treat a missing key as a separate case from `false`.
  - `/api/profile/me/` is a different view, the owner's editable settings (`OwnerProfileSerializer`), so it doesn't need to match.
- **The mutuals list is empty on your own profile.** "Followed by people you follow" doesn't mean anything there.
- **Mutuals reuse the follow-list format.** The frontend can use the same row component as the Followers and Following pages.

---

## 6. Team workflow

### Updates needed in `frontend_api_reference.md`
- Add `is_followed` and `follows_you` to the `GET /api/profile/<username>/` response.
- Update the `POST /api/profile/<username>/follow/` response.
- Add the new `GET /api/profile/<username>/mutuals/` endpoint.

### Frontend wiring (profile page)

| Frontend now | API |
|---|---|
| `following.includes(person.handle)` in `UserPage.jsx` | `is_followed` from the profile response |
| `person.followers + (followed ? 1 : 0)` | `followers_count` from the profile, then from the toggle response after each click |
| No "Follows you" badge | `follows_you` |
| No "Followed by …" line | `GET /api/profile/<handle>/mutuals/` |

All of these requests need the `Authorization` header (section 2).

---

## 7. Pending work and known gaps

- **Pending: an `is_self` flag.** The frontend has to compare `username` with the logged-in user to decide between "Edit profile" and Follow/Unfollow. Adding `is_self=ExpressionWrapper(Q(user=viewer), output_field=BooleanField())` in `with_follow_flags` (and `Value(False)` for anonymous viewers) would make that explicit.
- **Pending: tests.** `accounts/tests.py` doesn't cover these yet. Cases worth covering:
  - `is_followed` and `follows_you` for each combination: neither, one way each, and mutual
  - both flags are `false` without a token and on your own profile
  - the toggle response matches the new state and count
  - `/mutuals/`:
    - returns `401` without a token
    - returns `[]` for yourself
    - returns only the people in both sets, newest first
    - hides private profiles
- **Pending: pagination.** `/mutuals/` returns every row, like the other follow lists.
- **Known gap: `mutuals` isn't a reserved username.** It doesn't clash with any route, but `following` and `followers` are reserved, so it could be added to the same list for consistency.
