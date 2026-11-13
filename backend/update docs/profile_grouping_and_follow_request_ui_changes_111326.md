# Change Log: Profile Picture Grouping, Follow Request UI and Notifications

This document covers the work done on 11/13/26:
- the six side-picture fields on public profiles are grouped under `background_picture`
- the always-`true` `is_locked` field is removed from the locked profile card
- UserPage handles follow requests (Requested button, locked notice)
- follow requests create notifications with **Accept** / **Decline** buttons
- follow request endpoints moved under `/api/profile/me/`, plus new endpoints for requests you **sent**
- "Follow back" works when the person you're following back is private
- a new **Follow requests page** (`/subscriptions/requests`), linked from the Following title with a pending-count badge
- followers/following lists include **every** account, so the list matches the count. People lists show **Requested** for private accounts

It follows `private_profiles_and_follow_requests_changes.md`. Some of that document is now out of date; section 11 lists what to update. Section 13 is what's still to do.

**Status labels used below**
- **Verified**: tested for real, in the Django admin or shell, by automated tests, or by sending requests to a local dev server.
- **Not yet tested over HTTP**: the logic is in place, the backend files compile and the frontend files build, but no request has been sent to a running server to confirm it.
- **Pending**: not built yet.

---

## 1. Summary

| Area | Before | Now | Status |
|---|---|---|---|
| Side pictures on `/api/profiles/` and `/api/profile/<username>/` | Six flat fields (`right_picture`, `left_picture_flip`, ...). `'background_picture'` was listed in `fields` with no matching field, which crashed the endpoint (`ImproperlyConfigured`) | One `background_picture` object holding the six fields | Not yet tested over HTTP |
| `is_locked` on the locked card | Always `true` | Removed. A locked card is recognised by the missing `bio` | Not yet tested over HTTP |
| Following a private account from UserPage | Button stayed on "Follow" and there was no way to cancel. Posts showed "Error fetching posts" | Button becomes **Requested** (click to cancel). Posts are replaced by a "This account is private" notice | Not yet tested over HTTP |
| Incoming follow requests | No notification | `follow_request` notification with Accept / Decline | Not yet tested over HTTP |
| Follow request endpoints | `/api/follow-requests/` (incoming only) | `/api/profile/me/followers/requests/` (incoming) and `/api/profile/me/following/requests/` (sent) | Not yet tested over HTTP |
| "Follow back" on a private requester | Button didn't change after clicking | Shows **Requested** (click to cancel), and still does after a reload | Not yet tested over HTTP |
| Managing follow requests in the UI | Only from notifications | `/subscriptions/requests` page with "Requests to you" (Accept / Decline) and "Sent" (Cancel). A **Requests** link beside the Following title has a badge counting requests sent to you | Not yet tested over HTTP |
| Followers / following lists | Private accounts the viewer couldn't see were left out, so e.g. "1 follower" opened an empty list | Every active account is listed. The bio is hidden for private accounts you can't see | Not yet tested over HTTP |
| Follow button in people lists | Following a private account went back to "Follow" | Shows **Requested** (hover: Cancel), and still does after a reload | Not yet tested over HTTP |
| Database | n/a | `Notification.type` `max_length` 10 → 20 and the new `follow_request` choice (migration `notifications/0002_alter_notification_type`) | Migration generated |

---

## 2. Profile serializer: `background_picture` group

**File:** `backend/accounts/serializers.py`

A new read-only `BackgroundPictureSerializer` holds the six side-picture fields. `PublicProfileSerializer` uses it with `source='*'`, so the whole `Profile` object is passed in and no model change or migration is needed.

```python
background_picture = BackgroundPictureSerializer(source='*', read_only=True)
```

Response shape:
```json
"background_picture": {
    "right_picture": null,
    "right_picture_flip": false,
    "right_picture_tile": false,
    "left_picture": null,
    "left_picture_flip": false,
    "left_picture_tile": false
}
```

| Endpoint | Serializer | Shape |
|---|---|---|
| `GET /api/profiles/` | `PublicProfileSerializer` | Grouped |
| `GET /api/profile/<username>/` | `ProfileDetailSerializer` (inherits the public serializer) | Grouped |
| `GET` / `PATCH /api/profile/me/` | `OwnerProfileSerializer` | **Flat, unchanged**. The edit modal sends multipart form data with flat keys |

**Frontend:** `frontend/src/components/Layout.jsx` reads either shape:
```jsx
const profile = (isViewingUser && viewingUserCache) ? viewingUserCache : userCache
const cache = profile?.background_picture ?? profile
```

---

## 3. `is_locked` removed

**File:** `backend/accounts/serializers.py`, `LockedProfileSerializer`

The `is_locked` `SerializerMethodField`, its `Meta.fields` entry and `get_is_locked()` are removed. It was always `True`, and the frontend never read it.

To tell a locked card from a full profile, check for `bio`: the locked card leaves it out, and full profiles always include it (even as `""`).

---

## 4. UserPage: follow request behaviour

**File:** `frontend/src/pages/UserPage.jsx`

| Change | Detail |
|---|---|
| Skip the posts fetch on locked profiles | If `visibility === 'private'` and the profile is neither followed nor your own, no posts are requested. The backend would return `404` for them |
| New values | `requested = person.is_requested`, `isLocked = !isSelf && visibility === 'private' && !followed` |
| `toggleFollow` | Sends `DELETE` when you follow them **or** have a pending request, otherwise `POST`. Saves `is_requested` from the response |
| Third button state | **Requested**: outlined, red on hover. Clicking it cancels the request ("Cancelling...") |
| Follow button busy label | "Requesting..." for private accounts, "Following..." for public ones |
| Post count | Shows `–` on locked profiles instead of `0` |
| Locked notice | "This account is private", followed by "Your follow request is pending." or "Follow @user to see their posts." |

---

## 5. Follow request notifications

### Model
**File:** `backend/notifications/models.py`

| Change | Detail |
|---|---|
| New type | `FOLLOW_REQUEST = "follow_request"` |
| `type` field | `max_length` 10 → 20. `"follow_request"` is 14 characters, and production Postgres enforces the limit (SQLite doesn't) |
| Migration | `notifications/migrations/0002_alter_notification_type.py` |

### Signals
**File:** `backend/notifications/signals.py`

| Signal | What it does |
|---|---|
| `on_follow_request` (`post_save`, `FollowRequest`) | Creates a `follow_request` notification for the target when a request is created. Repeat POSTs don't make duplicates, because `get_or_create` returns the existing request |
| `on_follow_request_removed` (`post_delete`, `FollowRequest`) | Deletes that notification when the request is accepted, declined or cancelled. A `follow_request` notification therefore only exists while the request is pending |
| `on_follow` (changed) | When a follow comes from accepting a request, its "followed you" notification is created with `read=True`, so the bell badge doesn't go up straight after you click Accept |

### Frontend
**File:** `frontend/src/pages/Notifications.jsx`

- New text: "**{name}** requested to follow you".
- **Accept** (`POST`) and **Decline** (`DELETE`) call `/api/profile/me/followers/requests/<username>/`. A `pendingDecision` state blocks double clicks.
- Accept turns the row into a `follow` notification on the spot. Decline removes the row.

---

## 6. Follow request endpoints

**Files:** `backend/accounts/urls.py`, `backend/accounts/views.py`, `backend/accounts/serializers.py`

`/api/follow-requests/` has been **removed**. The new URLs:

| Method | URL | View | Result |
|---|---|---|---|
| GET | `/api/profile/me/followers/requests/` | `FollowRequestListView` (unchanged) | Requests sent to you, newest first |
| POST | `/api/profile/me/followers/requests/<username>/` | `FollowRequestDecisionView` (unchanged) | Accept: `200` `{"detail": "Request accepted."}` |
| DELETE | `/api/profile/me/followers/requests/<username>/` | `FollowRequestDecisionView` (unchanged) | Decline: `200` `{"detail": "Request declined."}` |
| GET | `/api/profile/me/following/requests/` | **New** `SentFollowRequestListView` | Your pending requests to active accounts |
| DELETE | `/api/profile/me/following/requests/<username>/` | **New** `SentFollowRequestCancelView` | Cancel: `200` `{"detail": "Request cancelled."}`. `404` if there's no pending request. Never removes an existing follow |

- The route names `follow-requests` and `follow-request-decision` are unchanged. The new routes are `sent-follow-requests` and `sent-follow-request-cancel`.
- These URLs don't clash with `profile/<str:username>/followers/`, because they have one more path segment. `me` is already a reserved username in `accounts/validators.py`.
- The new `SentFollowRequestSerializer` returns the same fields as `FollowRequestSerializer` (`id`, `username`, `first_name`, `last_name`, `profile_picture`, `created_at`), but describes the **target** rather than the requester.

---

## 7. "Follow back" on a private requester

**Problem:** after Alice accepts Bob's request, clicking "Follow back" on a private Bob creates a follow **request**. The response is `is_followed: false`, so the button never changed. The notifications API also had no way to report a pending request, so a reload didn't help.

| File | Change |
|---|---|
| `backend/notifications/views.py` | New annotation `is_requested_actor = Exists(FollowRequest(requester=you, target=actor))` |
| `backend/notifications/serializers.py` | `is_requested_actor` added to the fields |
| `frontend/src/pages/Notifications.jsx` | `followBack` saves `is_requested` from the response. New `cancelRequest()` uses `DELETE /api/profile/me/following/requests/<username>/`. Follow rows show **Requested** (click to cancel) when `is_requested_actor` is true. The "Follow back" busy label is now "Sending…" |

---

## 8. Follow requests page

### Page
**Files:** `frontend/src/pages/FollowRequestsPage.jsx` (new), `frontend/src/App.jsx`

- New protected route `/subscriptions/requests`, inside `<Layout />` so it gets the nav bar and side pictures.
- The header has the h1 "Follow requests" and a "Back to Following" link.

### List component
**File:** `frontend/src/components/FollowRequests.jsx` (new)

| Part | Detail |
|---|---|
| Loading | Fetches both lists at once with `Promise.all`. Handles paginated (`.results`) and plain array responses |
| Requests to you | Each row has Accept and Decline. On accept, `refreshUserCache()` updates your Followers count. Either action calls `refreshUnread()`, because the request's notification was deleted |
| Sent | Each row has Cancel, which uses `DELETE /api/profile/me/following/requests/<username>/` |
| Rows | Avatar, name and @username link to the profile, plus how long ago the request was sent (`getTimeAgoString(created_at)`) |
| States | "Loading…", then the error box, then an empty card ("No pending follow requests."). Each list only shows when it has entries |
| Double clicks | `pending` holds the busy username and disables that row's buttons |

### Requests link and badge
**Files:** `frontend/src/components/RequestsLink.jsx` (new), `frontend/src/components/PeopleList.jsx`, `frontend/src/pages/Following.jsx`

- `PeopleList` takes a new optional `titleAction` prop, shown beside the h1. Other pages don't pass it, so they look the same.
- `/subscriptions` passes `<RequestsLink />`, which is a **Requests** link to `/subscriptions/requests`. Other people's following lists (`/user/:handle/following`) don't get it.
- The badge counts requests sent **to you** (`GET /api/profile/me/followers/requests/`). It uses the bell badge's styling from `NavBar.jsx`, caps at `99+`, and is hidden at 0 or if the request fails. It reloads every time the Following page opens.

---

## 9. Followers / following lists

### Every account is listed
**File:** `backend/accounts/views.py`, `FollowListView.get_queryset`

**Problem:** lists were built from `visible_profiles(viewer)`, while `followers_count` counts every follow. When a private account followed you and you didn't follow them back, your profile showed "1 Followers" but the list was empty.

- The list is now built from `active_profiles()`, so it includes every active account and matches the counts. Banned and deactivated accounts are still left out.
- Whose list you can open hasn't changed. `get_target()` still uses `visible_profiles`, so a private account's lists stay closed to people who don't follow them.

### Private bios hidden
**File:** `backend/accounts/serializers.py`, `FollowListSerializer`

- `bio` is now a `SerializerMethodField`. It returns the bio only if the account is public, is you, or you follow them (`is_following`). Otherwise it returns `null`, matching the locked card.

### "Requested" state
| File | Change |
|---|---|
| `backend/accounts/views.py` | `FollowListView` annotates `is_requested` (your pending request to that person). Logged-out viewers get `Value(False)`. `MutualFollowersView` gets `is_requested=Value(False)`, because you already follow everyone in that list |
| `backend/accounts/serializers.py` | `is_requested` added to `FollowListSerializer` |
| `frontend/src/components/PeopleList.jsx` | `toggleFollow` sends `DELETE` when following **or** requested, and saves `is_requested`. The button has a third state: **Requested** (hover: Cancel), outlined with a red hover |

---

## 10. Files changed

| File | Sections |
|---|---|
| `backend/accounts/serializers.py` | 2, 3, 6, 9 |
| `backend/accounts/views.py` | 6, 9 |
| `backend/accounts/urls.py` | 6 |
| `backend/notifications/models.py` | 5 |
| `backend/notifications/migrations/0002_alter_notification_type.py` | 5 (new) |
| `backend/notifications/signals.py` | 5 |
| `backend/notifications/views.py` | 7 |
| `backend/notifications/serializers.py` | 7 |
| `frontend/src/App.jsx` | 8 |
| `frontend/src/components/Layout.jsx` | 2 |
| `frontend/src/components/FollowRequests.jsx` | 8 (new) |
| `frontend/src/components/RequestsLink.jsx` | 8 (new) |
| `frontend/src/components/PeopleList.jsx` | 8, 9 |
| `frontend/src/pages/FollowRequestsPage.jsx` | 8 (new) |
| `frontend/src/pages/Following.jsx` | 8 |
| `frontend/src/pages/UserPage.jsx` | 4 |
| `frontend/src/pages/Notifications.jsx` | 5, 7 |

---

## 11. Docs now out of date

| Doc | What to update |
|---|---|
| `backend/frontend_api_reference.md` | Endpoint table (lines 103–105) and the "Follow requests" section (lines 303–320): change `/api/follow-requests/` to the new URLs and add the two sent-request endpoints. The followers/following section says private profiles you can't see are "left out of the list"; they are now listed with `bio: null`. Also add `is_requested` on list entries, the `background_picture` grouping, the removal of `is_locked`, the `follow_request` notification type, and `is_requested_actor` |
| `backend/update docs/private_profiles_and_follow_requests_changes.md` | `/api/follow-requests/` appears on lines 26, 146, 161, 167, 182, 192, 255 and 257. `is_locked` appears in the summary table |

---


## 12. Still to do

- [ ] Update the docs listed in section 11
- [ ] Optional: a request sent from a people list doesn't appear in the requests page's "Sent" list until it's reopened, because the two lists keep separate state
