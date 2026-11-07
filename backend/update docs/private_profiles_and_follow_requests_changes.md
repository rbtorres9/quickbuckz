# Backend Change Log: Private Profiles and Follow Requests

This document covers how private profiles work now:
- private profiles show a **locked card** instead of returning `404`
- followers of a private profile see everything (profile, posts, follower lists)
- following a private profile sends a **follow request** that the owner accepts or declines

It follows `follow_like_endpoints_and_post_permissions_changes.md`. Some of that document is now out of date; section 8 lists what to update. Section 10 is the frontend to-do checklist.

**Status labels used below**
- **Verified**: tested for real, in the Django admin or shell, by automated tests (`python manage.py test`), or by sending requests to a local dev server.
- **Not yet tested over HTTP**: the logic is in place, but no request has been sent to a running server to confirm it.
- **Pending**: not built yet.

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| Viewing a private profile you don't follow | `404`, the same as "user not found" | `200` with a **locked card**: name, avatar, counts and `is_locked: true`. No bio, banner, birthday or posts |
| Viewing a private profile you follow | `404` | Full profile, the same as a public one |
| A private profile's posts, follower and following lists | Only the owner could see them | The owner **and their followers** |
| Following a private profile | `404` | Creates a pending **follow request** (`202`) |
| Cancelling a request | n/a | `DELETE /api/profile/<username>/follow/` (the same call as unfollow) |
| Managing incoming requests | n/a | New `GET /api/follow-requests/`, `POST` / `DELETE /api/follow-requests/<username>/` |
| Pending-request state on profiles | n/a | `is_requested` on `GET /api/profile/<username>/` and on follow responses |
| Database | n/a | **New `FollowRequest` model** (migration `0007_followrequest` + merge `0009`) |

Why: a private profile used to look the same as a deleted or misspelled username, and there was no way to ever get access to one. Now people can see that the account exists and ask to follow it, and the owner decides who gets in.

---

## 2. Data model

### `FollowRequest` (new), in `accounts/models.py`
| Field | Type | Notes |
|---|---|---|
| `requester` | FK → User | The person asking. `related_name="sent_follow_requests"` |
| `target` | FK → User | The private account being asked. `related_name="received_follow_requests"` |
| `created_at` | DateTime | `auto_now_add`. Requests are ordered newest first |

Constraints:
- `unique_follow_request`: one pending request per requester/target pair, so double clicks and retries can't create duplicates.
- `no_self_follow_request`: you can't request to follow yourself (the same rule as `Follow`).

A request only exists while it is pending. Accepting it creates a normal `Follow` row and deletes the request. Declining or cancelling deletes it.

### Migrations
- `0007_followrequest.py`: creates the table.
- `0009_merge_0007_followrequest_0008_profile_theme.py`: an empty merge. It was needed because `0007_profile_left_picture_…` and `0008_profile_theme` were created on another branch at the same time.

**Commit both files together.** Without the merge file, `migrate` fails with "Conflicting migrations detected".

---

## 3. Who can see what

`visible_profiles(viewer)` in `accounts/views.py` decides who can see a profile's **content**. It now returns:

| Viewer | Profiles returned |
|---|---|
| Logged out | Public profiles |
| Logged in | Public profiles **+ their own + private profiles they follow** (new) |

Everything that already used `visible_profiles()` picks this up automatically, with **no code changes in `posts/`**:
- the `/api/posts/` feed: followers now see a private account's posts
- `GET /api/profile/<username>/posts/`
- `GET /api/profile/<username>/followers/`, `/following/`, `/mutuals/`
- liking and commenting on posts

`GET /api/profile/<username>/` is the one exception. It looks the user up among **all** profiles and only uses `visible_profiles()` to choose a serializer (section 4).

---

## 4. `GET /api/profile/<username>/`

| Viewer | Status | Serializer | Notes |
|---|---|---|---|
| Can see the profile (public, owner, or follower) and logged in | `200` | `ProfileDetailSerializer` | Now also includes `is_requested` and `visibility` |
| Can see the profile and logged out | `200` | `PublicProfileSerializer` | Unchanged |
| **Can't** see the profile (private and not following, logged in or out) | `200` | `LockedProfileSerializer` (new) | Includes `is_locked: true` |
| Username doesn't exist | `404` | n/a | Unchanged |

### Locked card response
```json
{
  "id": 12,
  "username": "alice",
  "first_name": "Alice",
  "last_name": "Ng",
  "profile_picture": "https://…/profiles/profile_pictures/…jpg",
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
**Rule for the frontend:** if `is_locked` is present and `true`, don't request the profile's posts or follower lists, because they return `404`. The full serializers don't send `is_locked` at all.

### New fields
| Field | On | Meaning |
|---|---|---|
| `is_locked` | Locked card only | Always `true`. The only field you need to check |
| `is_requested` | Locked card + `ProfileDetailSerializer` | The viewer has a pending request to this user. Always `false` when logged out |
| `visibility` | Locked card + `ProfileDetailSerializer` | `"public"` or `"private"`. Use it to tell that unfollowing this account will lock it again |

How it works: `get_object()` stores `self.can_view` (whether the profile is in `visible_profiles(viewer)`), and `get_serializer_class()` reads it. DRF always calls `get_object()` first. `with_follow_flags()` now also adds `is_requested`.

---

## 5. Follow endpoint changes

### `POST /api/profile/<username>/follow/`
| Situation | Status | Result |
|---|---|---|
| Target is public, new follow | `201` | `Follow` created (unchanged) |
| Already following (public or private) | `200` | Nothing changes |
| Target is private, new request | `202` | `FollowRequest` created |
| Target is private, request already pending | `200` | Nothing changes |
| Target is yourself | `400` | `{"detail": "You can't follow yourself."}` |
| Username doesn't exist | `404` | |
| No token | `401` | |

**Changed:** private targets used to return `404`.

### `DELETE /api/profile/<username>/follow/`
This removes the follow **and** any pending request. One call handles both "Unfollow" and "Cancel request". Repeating it changes nothing.

### Response (both methods)
```json
{ "is_followed": false, "is_requested": true, "followers_count": 40 }
```
`is_requested` is new. `followers_count` doesn't change while a request is pending.

---

## 6. Follow request endpoints (new)

All of these require a token (`401` without one) and only act on requests sent **to the logged-in user**.

### `GET /api/follow-requests/`
Lists your pending incoming requests, newest first. There's no pagination.
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

### `POST /api/follow-requests/<username>/`: accept
Creates `Follow(follower=<username>, following=you)` and deletes the request in one transaction.
- `200` `{"detail": "Request accepted."}`
- `404` if that user has no pending request to you, including when someone tries to accept a request that was sent to another user.
- The existing `on_follow` signal fires, so you also get a normal "followed you" notification.

### `DELETE /api/follow-requests/<username>/`: decline
- `200` `{"detail": "Request declined."}` (a `200` with a body rather than `204`, so the frontend's JSON parsing doesn't choke on an empty response)
- `404` if there's no such pending request

---

## 7. Files changed

| File | Change |
|---|---|
| `accounts/models.py` | New `FollowRequest` model |
| `accounts/migrations/0007_followrequest.py` | New |
| `accounts/migrations/0009_merge_….py` | New (merge) |
| `accounts/views.py` | `visible_profiles()` includes followed private profiles. `with_follow_flags()` adds `is_requested`. `ProfileByUsernameView` returns a locked card instead of `404`. `FollowView` creates requests for private targets and its `DELETE` also cancels them. New `FollowRequestListView` and `FollowRequestDecisionView`. New imports: `FollowRequest`, `transaction`, two serializers |
| `accounts/serializers.py` | `ProfileDetailSerializer` adds `is_requested` and `visibility`. New `LockedProfileSerializer` and `FollowRequestSerializer` |
| `accounts/urls.py` | `follow-requests/` and `follow-requests/<str:username>/` |
| `accounts/tests.py` | 13 tests in `PrivateProfileTests` (section 9) |
| `posts/` | **No changes.** It picks up the new rules through `visible_profiles()` |

---

## 8. Other docs now out of date

- `follow_like_endpoints_and_post_permissions_changes.md` §2: "Target doesn't exist, or has a private profile → `404`" for `POST /follow/`. A private profile now gives `202`/`200` (section 5).
- The same doc, §1 and §6, says "Private profiles' posts … hidden unless you're the author". They're now also visible to **followers**.
- `frontend_api_reference.md` is missing: the locked card and `is_locked`, `is_requested`, `visibility` on profile detail, the new follow response field, and the three `/api/follow-requests/` endpoints.

---

## 9. Testing

**Verified** with automated tests. All 13 pass (`Ran 13 tests … OK`):

| Test | Checks |
|---|---|
| `test_non_follower_gets_locked_card` | `200`, `is_locked`, no `bio` |
| `test_logged_out_gets_locked_card` | Same, with no token |
| `test_missing_user_still_404` | A bad username still returns `404` |
| `test_owner_sees_own_private_profile` | The owner gets the full profile |
| `test_non_follower_cannot_see_posts` | Posts return `404` for non-followers |
| `test_follow_private_creates_request` | `202`, then `200` on repeat, only one row, `is_requested` on the profile |
| `test_cancel_request` | `DELETE /follow/` removes the request |
| `test_follow_public_still_direct` | Public follows are unchanged (`201`, no request) |
| `test_request_list_only_shows_mine` | Each user sees only their own incoming requests |
| `test_accept_unlocks_profile_and_posts` | Accepting creates the follow, removes the request, and unlocks the profile and posts |
| `test_decline` | Declining removes the request, and a second decline returns `404` |
| `test_cannot_accept_someone_elses_request` | `404` when you try to answer someone else's request |
| `test_unfollow_relocks` | Unfollowing a private account brings the locked card back |

Run them:
```powershell
python manage.py test accounts -v 2 --noinput
```

**Known issue with the shared Neon database:** the test runner creates `test_neondb` through Neon's pooled host. The pooler can keep a connection open, so Django can't drop it afterwards ("database is being accessed by other users"). This doesn't affect the test results. To clean up, open the Neon SQL Editor with the database set to **`neondb`** (not `test_neondb`) and run:
```sql
DROP DATABASE test_neondb WITH (FORCE);
```
A permanent fix (**Pending**, optional) is to run tests against SQLite. Add `import sys` to `config/settings.py` and change the database check to `if env('DATABASE_HOST', default=None) and 'test' not in sys.argv:`.

**Not yet tested over HTTP:** no requests have been sent to a running dev server or to Render yet.

---

## 10. Team workflow

- [ ] Commit `0007_followrequest.py` **and** `0009_merge_….py` together
- [ ] Tell the team, then run `python manage.py migrate` (shared Neon database; it only adds a new table)
- [ ] Redeploy to Render so the live API has the new endpoints
- [ ] Update the docs listed in section 8

---

## 11. Frontend to-do checklist

**Pending.** None of this is built yet. The backend already supports all of it.

### `frontend/src/pages/UserPage.jsx`
- [ ] In `fetchOtherUserData`, after `setPerson(userData)`: if `userData.is_locked`, set posts to `[]`, set `loadingPosts` to false, and **don't** call `fetchUserPosts` (it would `404` and show "Error fetching posts")
- [ ] **Bug fix:** add `handle` to the dependency list of the main `useEffect` (line 104). Right now, going from `/user/a` to `/user/b` keeps showing user A
- [ ] `toggleFollow`: send `DELETE` when `is_followed` **or** `is_requested` is true, otherwise `POST`. Copy `is_followed`, `is_requested` and `followers_count` from the response into `person`
- [ ] `toggleFollow`: if `visibility === 'private'` and the user just unfollowed, set `is_locked: true`, clear the bio and clear the posts
- [ ] Button: add a **"Requested"** state (outlined, click to cancel, "Cancelling..." while busy) between the "Following" and "Follow" branches
- [ ] Posts count: show `–` instead of `0` when `is_locked`
- [ ] Followers/Following counts: show plain text instead of `<Link>`s when `is_locked`, because those lists return `404`
- [ ] Replace the tabs and post list with a locked panel when `is_locked`: "This account is private", plus "Your follow request is pending." or "Follow @user to see their posts."

### `frontend/src/pages/Notifications.jsx`
- [ ] Load `GET /api/follow-requests/` when the page opens and keep the results in `requests` state
- [ ] Add a **"Follow requests"** section above the notifications list, with avatar, name and **Accept** / **Decline** buttons
- [ ] Accept sends `POST /api/follow-requests/<username>/`, and Decline sends `DELETE` to the same URL. Block double clicks and remove the row on success
- [ ] `followBack`: handle a private target. The response has `is_requested: true`, so show "Requested" instead of leaving "Follow back"

### Optional / later
- [ ] Badge on the bell or nav for pending follow requests (or a new `request` notification type: backend change + migration)
- [ ] Decide whether search (`/api/profiles/`, `ProfileListView`) should list private accounts so people can find them and send requests. Right now it still hides them (backend change)
- [ ] Decide what happens to pending requests when a private account switches to public (auto-accept or delete). Right now they stay pending (backend change)
- [ ] Remove `birthday` from `PublicProfileSerializer`. It's currently sent to everyone, including logged-out visitors (backend change)
- [ ] Update `AccountSettings.jsx`'s Private hint ("Your profile is hidden from other people.") to something like "Only approved followers can see your posts."
