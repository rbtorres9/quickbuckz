# Update: Role-Based Access Control (RBAC)

Adds three roles to accounts (`user`, `mod`, `admin`), lets moderators remove posts, and adds a backend check for access to the mod page. Before this update, the only "moderator" concept was the prototype `modMode` flag stored in the browser.

## Roles

| Role | Stored value | Can do |
|---|---|---|
| User | `user` | Default for every account, including signups |
| Moderator | `mod` | Everything a user can, plus delete anyone's post |
| Admin | `admin` | Everything a moderator can |

Roles are hierarchical: an admin counts as a moderator everywhere. A Django superuser always counts as an admin.

Roles are changed only in the Django admin site. No API endpoint changes roles.

## Backend (Django)

### `accounts/models.py`

- `User` has a new `Role` choices class (`USER`, `MODERATOR`, `ADMIN`) and a `role` field. It defaults to `user` and is indexed.
- Two properties are used for permission checks everywhere:
  - `is_admin` is true when the user is a superuser or has the `admin` role.
  - `is_mod` is true when `is_admin` is true or the user has the `mod` role.
- `User.save()` sets `role` to `admin` whenever `is_superuser` is true. This covers `createsuperuser`, the "Superuser status" checkbox in the admin site, and shell edits. So a superuser's stored role always matches their access.
  - Changing a superuser's role in the admin site has no effect: the save sets it back to `admin`. Remove superuser status first.
  - Queryset `.update()` calls skip `save()`. That's why `is_admin` still checks `is_superuser` directly, as a safety check.

### Migrations

- `0005_user_role`: adds the `role` column. Existing accounts get `user`.
- `0006_superusers_to_admin`: a data migration that sets `role = "admin"` on every existing superuser. It's a migration rather than a one-off shell command, so the deployed database and every local database get the same fix on `migrate`. Its reverse step does nothing.

### `accounts/permissions.py` (new)

- `IsModerator`: allows logged-in users whose `is_mod` is true. Otherwise returns 403 "Moderator access required."
- `IsAdminRole`: allows logged-in users whose `is_admin` is true. Otherwise returns 403 "Admin access required." It's not used yet and is kept for future admin-only endpoints.
- `IsAuthorOrModerator` (object-level):
  - Anyone can read.
  - The author can edit or delete their own post.
  - Moderators and admins can only **delete** other people's posts, not edit them.
- Each class checks `is_authenticated` before reading `is_mod` / `is_admin`, because logged-out users don't have those properties.

### `posts/views.py`

- `IsAuthorOrReadOnly` was removed, and `PostViewSet` now uses `IsAuthorOrModerator`.
- In `get_queryset`, the private-profile filter (`visible_profiles`) is skipped only when a moderator is deleting a post. Without this, `get_object()` returned 404 before the permission check ran, so moderators couldn't remove posts from private accounts. Moderators' feeds and post pages still follow normal visibility.

### `accounts/views.py`

- **New `UserRoleView`** at `GET /api/users/me/role/`. It answers one question: can the person making the request open the mod page?
  - Permissions are `IsAuthenticated` and `IsModerator`. Logged-out users get 401, regular users get 403, and moderators and admins get **204 No Content**.
  - There's no response body. The status code is the answer, so the response never says whether someone is a mod or an admin.
  - The route uses a fixed `me` with no username parameter, so you can only check your own access.
- **`ProfileByUsernameView`** now chooses the serializer for each request with `get_serializer_class`:
  - Logged-in viewers get `ProfileDetailSerializer`, which includes `is_followed`, `follows_you` and `is_self`.
  - Anonymous viewers get `PublicProfileSerializer`, which doesn't include those three viewer-specific fields.

### `accounts/urls.py`

- Added `path('users/me/role/', UserRoleView.as_view(), name='user-role')`. The trailing slash is required, because the frontend calls `/api/users/me/role/`.

### `accounts/admin.py`

- `CustomUserAdmin` adds a "Role" section to the user edit page (appended to `UserAdmin.fieldsets`), shows `role` in the user list, and adds a role filter to the sidebar.

### Where the role is (and isn't) shown

- `/api/profile/me/`, `/api/profile/<username>/` and the follow lists don't include `role`.
- `RegisterSerializer` doesn't accept `role`, so signups can't choose a role.
- Security comes from the server-side checks above, not from hiding the field.

## API summary

| Request | user | mod | admin |
|---|---|---|---|
| `DELETE /api/posts/<id>/` (someone else's post) | 403 | 204 | 204 |
| `PATCH /api/posts/<id>/` (someone else's post) | 403 | 403 | 403 |
| `GET /api/users/me/role/` | 403 | 204 | 204 |
| Logged out, `GET /api/users/me/role/` | 401 | | |

## Frontend TODO

The backend is ready, but the frontend still uses the prototype mod mode.

- **`src/context/AuthContext.jsx`: handle 204 in `fetchWithToken`.** A 204 has no body, so `response.json()` throws, and the call returns `{ error }` even though it succeeded. Return an empty object for 204 before the `!response.ok` check. This is **required** before the next item, or real mods will be shown "Moderators only." It also fixes successful post DELETEs being reported as errors.
- **`src/pages/ModTools.jsx`: use the backend check instead of `modMode`.** On load, call `GET /api/users/me/role/`. Treat a successful response as "can moderate," and treat any error (403, 401, network) as "no access," so it fails closed. Render nothing while the check is running, so "Moderators only" doesn't flash on screen. Once the 204 fix is in, the "permission" string-matching workaround in `removePost` can become a plain error check.
- **Remove the prototype mod mode:** the `modMode` / `setModMode` state in `src/data/store.jsx`, and the mod-mode form in `src/pages/AccountSettings.jsx`.
- The page check is only for the UI. Even if the page is opened, the backend still decides whether a delete is allowed.
