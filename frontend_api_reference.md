# Backend API Reference — For the Frontend Team

## Base URL
- Local development: `http://127.0.0.1:8000/api/`
- (Update this once the backend is deployed somewhere reachable outside localhost — not yet done)

## Authentication
This API uses JWT (JSON Web Tokens). No session cookies — every authenticated request needs a `Bearer` token in the header.

### Login
```
POST /api/token/
Content-Type: application/json

{ "username": "...", "password": "..." }
```
Response (200):
```json
{ "access": "<jwt>", "refresh": "<jwt>" }
```

### Refresh an expired access token
```
POST /api/token/refresh/
Content-Type: application/json

{ "refresh": "<refresh_token>" }
```
Response (200):
```json
{ "access": "<new_jwt>" }
```
- Access tokens are short-lived (default ~5 minutes). Expect to need the refresh flow regularly — a request with an expired token returns `401` with `"code": "token_not_valid"`.

### Signup (create a new account)
```
POST /api/signup/
Content-Type: application/json

{ "username": "...", "email": "...", "password": "..." }
```
Response (201): the created user's `username` and `email` (password is never returned).
- A `Profile` is automatically created for the new user — no separate call needed.
- Signup does **not** log the user in automatically. Call `/api/token/` afterward to get their tokens.

### Using the access token
Every authenticated request needs this header:
```
Authorization: Bearer <access_token>
```

## Endpoints

| Method | Endpoint | Auth required? | Purpose |
|---|---|---|---|
| POST | `/api/signup/` | No | Create a new user account |
| POST | `/api/token/` | No | Log in, get access + refresh tokens |
| POST | `/api/token/refresh/` | No | Get a new access token |
| GET | `/api/posts/` | No | List all posts |
| POST | `/api/posts/` | **Yes** | Create a post (as the logged-in user) |
| GET | `/api/profiles/` | No | List all profiles |
| GET | `/api/profile/me/` | **Yes** | View your own profile |
| PATCH / PUT | `/api/profile/me/` | **Yes** | Update your own profile (bio, picture) |

## Data shapes

### Post
```json
{
  "id": 1,
  "author": "username",
  "content": "text of the post",
  "image": null,
  "created_at": "2026-09-20T23:44:38.912001Z",
  "updated_at": "2026-09-20T23:44:38.912051Z"
}
```
- `author` is read-only — do not send it when creating a post. It's set automatically from the logged-in user's token. Sending it anyway has no effect.
- Creating a post only requires `content` in the request body (`image` is optional).

### Profile
```json
{
  "id": 1,
  "user": 1,
  "bio": "text",
  "profile_picture": null,
  "created_at": "2026-09-20T21:37:22.376608Z"
}
```
- `user` is the numeric ID of the linked `User`, not a username.
- Only `bio` and `profile_picture` are meant to be updated via `PATCH /api/profile/me/`.

## CORS
- The backend uses `django-cors-headers` and currently allows `http://localhost:3000` as an origin (for Framer's local preview).
- **Once you have a published Framer URL**, it needs to be added to `CORS_ALLOWED_ORIGINS` in the backend's `settings.py` — send that URL over so it can be added, or requests will be blocked by the browser.

## Known gaps / things not yet built
- No PATCH/PUT/DELETE for individual posts yet (only create + list)
- No endpoint to fetch a single post or single profile by ID yet (only list views)
- No pagination on list endpoints yet — `/api/posts/` and `/api/profiles/` return everything at once
- Backend is on SQLite locally for now (shared Postgres via Supabase is planned but not yet set up) — this doesn't change the API shape, just means data isn't yet shared across team members' local servers
- No deployed/hosted URL yet — everything above assumes local development against a teammate's own running server
