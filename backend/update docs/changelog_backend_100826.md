# Backend Change Log: Custom User Model

This document records what changed when the backend moved from Django's built-in `User` to a custom `User` model (`accounts.User`), added username rules, and split public profile data from private account data. It sits alongside `README.md` and `frontend_api_reference.md`, which describe the backend as it was *before* these changes. Section 6 lists which parts of those two files are now outdated.

**Status labels used below**
- **Verified**: tested for real, either in the Django shell or by sending requests to a local dev server, both connected to the shared Neon database.
- **Not yet tested over HTTP**: the logic is in place, but no request has been sent to the API endpoint to confirm it.
- **Pending**: not built yet.

---

## 1. Summary

| Area | Before | Now |
|---|---|---|
| User model | Django's built-in `django.contrib.auth.models.User` | Custom `accounts.User` (extends `AbstractUser`) |
| Email | Not unique, case preserved | Unique (case-insensitive), always stored lowercase |
| Username | Django defaults (up to 150 characters) | 4-20 characters, custom rules (section 2), always stored lowercase |
| Login identifier | Username only | Username **or** email, case-insensitive |
| Signup password | Any password accepted | Validated: at least 8 characters, not too common, not entirely numeric, not too similar to the username or email (section 2) |
| Profile | `bio`, `profile_picture`, `created_at` | Same, plus a `visibility` field (public/private). Private profiles are hidden from other users' lists (section 3) |
| Public profile list (`GET /api/profiles/`) | `id`, `user`, `bio`, `profile_picture`, `created_at` | Also `username`, `first_name`, `last_name` (read-only, taken from the linked user) |
| Private account data | None | New `AccountSecurity` model (empty stub, never exposed by the API) |
| Database | Had real test data | Schema wiped and rebuilt. All previous users, profiles and posts are gone |

Why: unique emails and a controlled username format are needed for email-or-username login, and the new model split keeps private account data out of anything public-facing.

---

## 2. Username and email rules

### Username

| Rule | Detail |
|---|---|
| Length | 4 to 20 characters |
| Allowed characters | Letters, digits, underscore `_`, dot `.` (no dashes, spaces or `@`) |
| Case | Uppercase input is accepted and converted to lowercase (`Bob.Smith` is stored as `bob.smith`) |
| Dots | Cannot be the first or last character, and cannot appear twice in a row |
| Underscores | No more than two in a row |
| Content | At least two letters or digits, and at least one letter (so `1234`, `12_34` and `____` are rejected) |
| Uniqueness | Case-insensitive (`Bob` and `bob` are the same username) |

Validation error messages (returned under the `username` key):
- `Usernames must be 4-20 characters: letters, numbers, underscores, and dots only.`
- `Usernames cannot start or end with a dot.`
- `Usernames cannot contain consecutive dots.`
- `Usernames cannot contain more than two underscores in a row.`
- `Usernames need at least two letters or numbers.`
- `Usernames need at least one letter.`
- `A user with that username already exists.`

### Email
- Must be unique, compared case-insensitively.
- Stored lowercase (`Bobby@Example.COM` is saved as `bobby@example.com`).

Duplicate email error (returned under the `email` key): `user with this email already exists.`

**Status:** Rules **verified** in the shell (validator test table, duplicate detection, lowercasing) and **verified over HTTP** on `POST /api/signup/`: a successful signup returns `201` with the lowercased username and email; duplicates (in any capitalization), bad characters, too-short names and digits-only names each return `400` with the messages above.

### Password

Checked on signup (`POST /api/signup/`) by Django's password validators. Every rule that fails is reported together under the `password` key.

| Rule | Error message |
|---|---|
| At least 8 characters | `This password is too short. It must contain at least 8 characters.` |
| Not on the list of commonly used passwords | `This password is too common.` |
| Not made only of digits | `This password is entirely numeric.` |
| Not too similar to the username or email | `The password is too similar to the username.` (Django's standard wording names the email address instead when that is what matched) |

Example response when several rules fail: `{"password": ["This password is too common.", "This password is entirely numeric."]}`

**Status:** **Verified over HTTP.** A too-short password, a common one, an all-digit one and one too similar to the username each returned `400` with the messages above, and a strong password returned `201`. The email-similarity wording was not tested. Password rules apply to signup only. Login is unaffected, so existing accounts keep working.

---

## 3. For the frontend team

### Changes that affect API calls
1. **Usernames are returned lowercase.** If a user signs up as `Bob_99`, responses show `bob_99`. Do not compare against what the user typed.
2. **Signup can now return `400` for username and email problems**, in the standard DRF error shape, e.g. `{"username": ["Usernames cannot start or end with a dot."]}`. Show these messages next to the form field.
3. **Login accepts email or username.** The request body field is still named `username`, for example `{ "username": "bobby@example.com", "password": "..." }`. Either the username or the email can go in that field, in any capitalization. **Verified** over HTTP against `/api/token/`, including an email typed in capitals.
4. **Old tokens are no longer valid.** The database was wiped and rebuilt. Anyone holding an access or refresh token from before the reset should be logged out. Clear stored tokens in the frontend and log in again. Do this even if a token has not expired, because user IDs were reassigned and an old token could point at the wrong account.
5. **All old accounts are gone.** Test users, profiles and posts created before the reset no longer exist. Sign up again.
6. **`GET /api/profiles/` is public and hides private profiles.** No login is needed, which matches the original `frontend_api_reference.md`. Profiles set to `private` are left out of the list for everyone except their owner, who sees their own profile when the request carries a valid token. **Verified** over HTTP: a request with no token returns `200` and leaves out the private profile, and with one private profile a second logged-in user's list had one fewer entry than the owner's. **Watch out:** a request that carries an expired or invalid `Authorization` header returns `401` even though the endpoint is public (verified), so the frontend should send the header only when it holds a valid token.
7. **`POST /api/profiles/` is no longer allowed** and returns `405`. Profiles are created automatically at signup, and edited through `PATCH /api/profile/me/`. **Verified.**
8. **`/api/profile/me/` now includes `visibility`** (`"public"` or `"private"`) and lets the owner change it. Any other value returns `400` with `{"visibility": ["\"bogus\" is not a valid choice."]}`. The `user` field is read-only: sending it has no effect. **Verified.**
9. **Each item in `GET /api/profiles/` now includes `username`, `first_name` and `last_name`.** All three are read-only and come from the linked user account, so the frontend can show a name without a second request. `first_name` and `last_name` are empty strings until they are set, and for now they can only be set in the Django admin, because no API endpoint accepts them yet. They appear only for profiles that are visible in the list (public ones, plus the requester's own). **Verified.**
10. **Signup now validates the password.** A weak password returns `400` with a `password` key holding one or more readable messages (see section 2). Test accounts with passwords such as `test123` will be rejected. **Verified.**

### What did *not* change
- All URLs are the same (the only difference is that `POST /api/profiles/` is now rejected).
- The Post JSON shape is unchanged.
- The Profile JSON in `GET /api/profiles/` keeps every previous field and adds `username`, `first_name` and `last_name` (item 9 above). `visibility` appears only in `/api/profile/me/` responses.
- `Authorization: Bearer <access_token>` works as before.

---

## 4. Models

### `User` (`accounts/models.py`)
Extends `AbstractUser`. Keeps all standard auth fields and adds:
- `username`: max length 20, unique, custom validator
- `email`: unique
- `clean()` and `save()` lowercase and strip both fields
- Database constraints `unique_email_ci` and `unique_username_ci` (case-insensitive uniqueness, a backstop for writes that skip `save()`)

### `Profile` (public, user-configurable)
| Field | Notes |
|---|---|
| `user` | One-to-one with `User`, `related_name="profile"` |
| `bio` | Text, optional |
| `profile_picture` | Image, optional |
| `visibility` | **New.** `"public"` or `"private"`, default `"public"` |
| `created_at` | Set automatically |

Profiles use two serializers. `PublicProfileSerializer` (used by `GET /api/profiles/`) is fully read-only, omits `visibility`, and adds `username`, `first_name` and `last_name` read from the linked user. `OwnerProfileSerializer` (used by `/api/profile/me/`) adds `visibility` and keeps `user` read-only. Which profiles appear in the list is decided in `ProfileListView.get_queryset()`: public profiles, plus the requester's own. **Verified** over HTTP.

### `AccountSecurity` (private)
- One-to-one with `User`, `related_name="security"`.
- Has `created_at` and `updated_at` only. It is an empty stub for later private data (for example 2FA settings or lockout counters).
- **Must never be added to a public serializer or any endpoint other than the owner's own, when it eventually has real data.**

### `Post`
- `author` now points at `settings.AUTH_USER_MODEL` instead of the built-in `User`. Field names and API output are unchanged.

### Automatic creation
A `post_save` signal on `User` now creates **both** a `Profile` and an `AccountSecurity` row whenever a user is created. Previously it created only a `Profile`. **Verified.**

---

## 5. Backend internals and files changed

| File | Change |
|---|---|
| `config/settings.py` | `AUTH_USER_MODEL = "accounts.User"`; `AUTHENTICATION_BACKENDS = ["accounts.backends.EmailOrUsernameBackend"]`; Django's password validators enabled through `AUTH_PASSWORD_VALIDATORS` (minimum length 8) |
| `accounts/models.py` | Custom `User`, updated `Profile`, new `AccountSecurity`, `Post.author` re-pointed |
| `accounts/validators.py` | **New.** `validate_username_rules` |
| `accounts/backends.py` | **New.** `EmailOrUsernameBackend` (case-insensitive lookup by username or email, safe handling of duplicates, timing-safe on misses) |
| `accounts/signals.py` | Creates `Profile` and `AccountSecurity` on user creation |
| `accounts/serializers.py` | `RegisterSerializer` lowercases and strips `username` and `email` before validation, so duplicates are caught as clean `400` errors instead of database errors. `ProfileSerializer` was replaced by `PublicProfileSerializer` and `OwnerProfileSerializer` (`user` is read-only in both); the public one also returns `username`, `first_name` and `last_name`. `RegisterSerializer.validate()` also runs Django's password validators against the new user's username and email |
| `accounts/views.py` | `ProfileListView` is now list-only (`ListAPIView`), open to anonymous visitors (`AllowAny`), hides other users' private profiles, and loads each profile's user in the same query (`select_related`) to avoid an extra query per profile. `MyProfileView` uses `OwnerProfileSerializer` |
| `accounts/apps.py` | Unchanged in behavior; `ready()` still imports the signals |
| `accounts/admin.py` | New `CustomUserAdmin` with Profile and AccountSecurity inlines (inlines hidden on the "add user" page so the signal does not conflict), email field on the add page; `Post` still registered |
| `accounts/migrations/` | Old migrations deleted. Fresh `0001_initial` generated for the new models |

Any code that needs the user model should use `settings.AUTH_USER_MODEL` (in model fields) or `get_user_model()` (everywhere else), never `from django.contrib.auth.models import User`.

---

## 6. Team workflow and deployment

### What each teammate needs to do
1. `git pull` to get the new migration files and code.
2. **Do not run `makemigrations`** before pulling. A second `0001_initial` would conflict with the committed one.
3. Run `python manage.py migrate`. It should report nothing to apply, since the shared Neon database is already migrated.
4. Previous superuser accounts no longer exist. If you need admin access, run `python manage.py createsuperuser` and pick a username that follows the rules in section 2. Check with the team first so duplicate accounts are not created.

### Deployment
- The shared Neon database has the new schema. A backend version running the **old** code cannot work against it, because the built-in `auth_user` table no longer exists. The new code must be deployed to Render for the live API to work.
- Render's `build.sh` runs `migrate` on each deploy. With the migrations committed, that should report nothing to apply.

### Existing documents that are now outdated
| Document | Section | What is outdated |
|---|---|---|
| `README.md` | Step 6, "Run migrations and create a superuser" | Superuser accounts were reset (see above), and usernames must follow the new rules |
| `README.md` | Section 4, Models | Describes `OneToOneField(User, ...)` to the built-in `User`. Profile now points at `settings.AUTH_USER_MODEL`, and a custom `User` exists |
| `README.md` | Section 7, Signals | Shows a signal that creates only a `Profile`. It now also creates `AccountSecurity`, and `User` is the custom model |
| `README.md` | Section 11, Post model | Shows `ForeignKey(User, ...)`; now `settings.AUTH_USER_MODEL`. It also shows `upload_to='posts/'`, but the code uses `'posts/images/'` (this mismatch predates the User changes) |
| `frontend_api_reference.md` | Login | Add: email also accepted; usernames are lowercase |
| `frontend_api_reference.md` | Signup | Add: username/email/password rules and the new `400` error messages |
| `frontend_api_reference.md` | Profile data shape | `/api/profiles/` items now include `username`, `first_name` and `last_name`, and `/api/profile/me/` now also returns `visibility` |
| `frontend_api_reference.md` | Endpoints table | Does not mention that private profiles are hidden from `GET /api/profiles/`, or that `visibility` can be updated via `PATCH /api/profile/me/` |

Suggested replacement text for `frontend_api_reference.md` is in section 8.

---

## 7. Pending work and known gaps

1. ~~**Signup serializer.**~~ **Done and verified.** Username and email are lowercased before DRF's uniqueness check, so a signup with `Bob` while `bob` exists returns a clean `400` instead of a server error.
2. ~~**Login by email over HTTP.**~~ **Done and verified.** `POST /api/token/` accepts an email in the `username` field.
3. ~~**Profile `visibility` not exposed or enforced.**~~ **Done and verified.** Private profiles are hidden from other users' lists, the owner sees `visibility` on `/api/profile/me/` and can change it.
4. ~~**Serializer field lists.**~~ **Checked.** `PublicProfileSerializer`, `OwnerProfileSerializer`, `PostSerializer` and `RegisterSerializer` all use explicit `fields` lists, with no `"__all__"`. Keep it that way for any new serializer that touches `User`.
5. **`AccountSecurity` has no functionality yet.** It is intentionally empty.
6. ~~**`ProfileListView` accepted POST.**~~ **Done and verified.** It is now list-only (`405` on POST).
7. ~~**`ProfileSerializer.user` was writable.**~~ **Done and verified.** `user` is read-only in both profile serializers.
8. **Private profiles do not affect posts.** `GET /api/posts/` still lists posts from every user, including users whose profile is private. Decide whether `visibility` should also limit who can see a user's posts.
9. **No pagination.** `GET /api/profiles/` and `GET /api/posts/` return everything at once, as before.
10. **Default visibility is `public`.** Decide whether new profiles should instead start as `private`. Changing the default affects only profiles created afterward.
11. **`frontend_api_reference.md` has not been updated yet.** Section 8 has the replacement text.
12. **`first_name` and `last_name` can only be set in the Django admin.** Neither signup nor `PATCH /api/profile/me/` accepts them, so they are empty for most users. Decide whether users should set them at signup, through their profile, or both.
13. **Password rules apply at signup only.** There is no change-password or reset endpoint yet. When one is added it must call `validate_password` too, because DRF does not run Django's validators on its own.

---

## 8. Suggested updates for `frontend_api_reference.md`

Replace or add the following in the existing file.

### Login (add under the request example)
> `username` may be the account's username **or** its email address, in any capitalization.

### Signup (add under the request example)
> - Usernames are 4-20 characters: letters, numbers, underscores and dots only. They cannot start or end with a dot, cannot contain `..` or `___`, need at least two letters or numbers, and need at least one letter.
> - Usernames and emails are case-insensitive and are returned in lowercase.
> - Passwords must be at least 8 characters, not commonly used, not entirely numeric, and not too similar to the username or email. A rejected password returns `400` with every problem listed under `password`, e.g. `{"password": ["This password is too common.", "This password is entirely numeric."]}`.
> - Invalid or duplicate values return `400` with errors keyed by field, e.g. `{"username": ["A user with that username already exists."], "email": ["user with this email already exists."]}`.

### Endpoints table (replace the profile rows)

| Method | Endpoint | Auth required? | Purpose |
|---|---|---|---|
| GET | `/api/profiles/` | No | List profiles. Profiles set to private are hidden from everyone except their owner (who is recognized only when a valid token is sent) |
| GET | `/api/profile/me/` | **Yes** | View your own profile (includes `visibility`) |
| PATCH / PUT | `/api/profile/me/` | **Yes** | Update your own `bio`, `profile_picture` and `visibility` |

> This endpoint is public, so requests without a token work. But a request that includes an **expired or invalid** `Authorization` header is rejected with `401` before the endpoint runs, so attach the header only when you hold a valid token (refresh it first if needed).

### Profile data shapes (replace the Profile section)

Public (items in `GET /api/profiles/`):
```json
{
  "id": 1,
  "user": 1,
  "username": "ada_l",
  "first_name": "Ada",
  "last_name": "Lovelace",
  "bio": "text",
  "profile_picture": null,
  "created_at": "2026-09-20T21:37:22.376608Z"
}
```

Owner (`GET` and `PATCH /api/profile/me/`):
```json
{
  "id": 1,
  "user": 1,
  "bio": "text",
  "profile_picture": null,
  "visibility": "public",
  "created_at": "2026-09-20T21:37:22.376608Z"
}
```
- `visibility` is `"public"` or `"private"`. Any other value returns `400`.
- `user` is the numeric ID of the linked user and cannot be changed.
- Only `bio`, `profile_picture` and `visibility` can be updated.
- `username`, `first_name` and `last_name` appear only in the public list. They come from the user's account and are read-only. `username` is always present and lowercase, while `first_name` and `last_name` are empty strings when not set.

### Known gaps (add)
- Private profiles are hidden from the profile list only. Their authors' posts still appear in `GET /api/posts/`.
- Tokens issued before the database reset are invalid. Clear stored tokens and log in again.
- A stale token on a public endpoint (such as `GET /api/profiles/` or `GET /api/posts/`) returns `401` instead of the public data.
