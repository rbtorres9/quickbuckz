# Changelog

## 2026-11-19 — Blocking users (backend)

### Added
- **Users can block other users.** A block hides the two accounts from each other in both directions, and either user can block the other. Unblocking removes only your own block. If the other person also blocked you, their block stays.
  - `backend/accounts/models.py`: new `Block` model with `blocker` and `blocked` (both FK to User, `CASCADE`) and `created_at`. Reverse names: `user.blocks_made` (people I blocked) and `user.blocks_received` (people who blocked me). Newest blocks are listed first.
    - `unique_block`: you can't block the same person twice.
    - `no_self_block`: the database refuses a block on yourself.
  - Migration: `accounts/migrations/0013_block.py`.
- **New endpoints** (`backend/accounts/views.py`, `backend/accounts/urls.py`):

  | Method | URL | Result |
  |---|---|---|
  | POST | `/api/profile/<username>/block/` | Blocks the user. Returns `201` the first time, `200` if already blocked, `400` if you try to block yourself, and `404` if the user doesn't exist or is deactivated |
  | DELETE | `/api/profile/<username>/block/` | Unblocks the user. Returns `200` |
  | GET | `/api/profile/me/blocks/` | Lists the people you blocked |

  - The POST and DELETE responses are `{"is_blocked": true}` or `{"is_blocked": false}`.
  - `BlockView.post` runs in a single transaction. It creates the block, then deletes **follows and pending follow requests in both directions**. The existing `post_delete` signals remove the matching follow and follow-request notifications.
  - Each `BlockListView` item has `id`, `username`, `first_name`, `last_name`, `profile_picture` and `created_at` (from `BlockSerializer` in `backend/accounts/serializers.py`). It has the same shape as the sent follow requests list.
- **New helpers in `backend/accounts/views.py`:**
  - `blocks_between(a, b)`: `True` if either user has blocked the other. It's used to refuse actions (follow, like, comment) and has **no** moderator exception.
  - `hidden_user_ids(viewer)`: a subquery of the users hidden from the viewer by a block in either direction. For logged-out viewers it's empty. For mods and admins it leaves out users who have **open reports** against them, so mods can still review them.
  - `unblocked_profiles(viewer)`: `active_profiles()` minus `hidden_user_ids(viewer)`.
- **Admin:** `Block` is registered in the Django admin (`backend/accounts/admin.py`) and shows blocker, blocked and date. You can search by either username.

### Changed
- **Profiles return 404 both ways.** If A blocks B, neither one can open the other's profile. It responds as if the account doesn't exist, not with the locked view.
  - `visible_profiles()` now starts from `unblocked_profiles(user)` instead of `active_profiles()`. This covers posts, user posts, follow lists and mutuals.
  - `ProfileListView` returns `unblocked_profiles(request.user)`.
  - `ProfileByUsernameView` builds its queryset from `unblocked_profiles(viewer)`.
  - `FollowListView` builds the list from `unblocked_profiles(viewer)`, so hidden users don't appear inside anyone's followers or following lists.
- **No new follows while blocked.** `FollowView.post` returns `404` if `blocks_between(request.user, target)` is true.
- **Posts and comments** (`backend/posts/views.py`):
  - Posts by hidden users are filtered out through `visible_profiles`, so their posts return 404 in the feed, in detail and in user post lists.
  - Comments by hidden users are left out of the post detail prefetch and the `GET /api/posts/<id>/comment/` list.
  - Liking (`POST .../like/`) and commenting (`POST .../comment/`) on a post whose author you have a block with returns `403`. This only matters for mods seeing a blocker through the open-report exception. Normal users already get `404` from `get_object()`.
- **Notifications** (`backend/notifications/views.py`):
  - The notification list and unread count leave out notifications whose actor is hidden by a block.
  - Old like and comment notifications are hidden, not deleted, so they come back after an unblock.
  - Mod removal notifications have no actor, so they always show.

### Moderators
- Users **can** block mods and admins.
- A mod who is hidden by a block can still see that user's profile and posts while the user has any **open** report against them (profile, post or comment). Once those reports are closed, the mod gets `404` again.
- Even during that exception, the mod can't follow, like or comment on the user's content, because `blocks_between` has no mod exception.
- Mod deletes work the same as before: the `mod_delete` path in `PostViewSet` skips the visibility filter.

### Known limitations
- A mod seeing a **private** blocker through the open-report exception still gets the locked view if they don't follow that user. This is unchanged from how it worked before.
- If `PostSerializer` has a comment count, it still includes comments from hidden users.
- `POST /api/profile/<username>/block/` looks up the user directly, so you can block someone who has already blocked you.

### Testing checklist
1. A blocks B: `GET /api/profile/a/` as B returns `404`, and `GET /api/profile/b/` as A returns `404`.
2. Any follows and pending follow requests between A and B are removed, and `POST /api/profile/a/follow/` as B returns `404`.
3. A's comments on a third user's post don't show for B, and B's don't show for A.
4. B's earlier like and comment notifications are hidden from A's list and unread count, and they come back after A unblocks.
5. B blocks mod M and a report is filed against B: M can open B's profile, but liking or commenting on B's posts returns `403`. After the report is closed, M gets `404`.
6. `POST /api/profile/<own username>/block/` returns `400`.
