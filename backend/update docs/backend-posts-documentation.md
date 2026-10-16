# Backend: Posts, Likes, and Comments

This document describes the backend implementation of posts and their interactions (likes and comments) in the Django REST Framework API.

## Overview

Post-related code lives in a dedicated `posts` app. The `accounts` app handles identity only: the custom user model, `AccountSecurity`, and `Profile`.

**Stack:** Django, Django REST Framework, PostgreSQL (Neon), JWT authentication (`djangorestframework-simplejwt`), hosted on Render.

## App Structure

```
backend/
├── accounts/        # custom user, AccountSecurity, Profile
├── posts/
│   ├── models.py        # Post, Like, Comment
│   ├── serializers.py   # PostSerializer, PostDetailSerializer, CommentSerializer
│   ├── views.py         # PostViewSet (CRUD, like, comment actions)
│   ├── urls.py          # DefaultRouter registration
│   └── admin.py         # admin registration for Post and Like
└── config/
    ├── settings.py      # INSTALLED_APPS, REST_FRAMEWORK, SIMPLE_JWT
    └── urls.py          # includes posts.urls under api/
```

## Models (`posts/models.py`)

### Post

| Field | Type | Notes |
|---|---|---|
| `author` | ForeignKey to `AUTH_USER_MODEL` | `related_name="posts"`, cascades on user delete |
| `content` | TextField | |
| `created_at` | DateTimeField | `auto_now_add=True` |

### Like

| Field | Type | Notes |
|---|---|---|
| `user` | ForeignKey to `AUTH_USER_MODEL` | `related_name="likes"` |
| `post` | ForeignKey to `Post` | `related_name="likes"` |
| `created_at` | DateTimeField | `auto_now_add=True` |

**Constraint:** `UniqueConstraint(fields=["user", "post"], name="unique_like_per_user_post")`. A user can like a post at most once. The database enforces this, so duplicates are rejected even under concurrent requests.

### Comment

| Field | Type | Notes |
|---|---|---|
| `post` | ForeignKey to `Post` | `related_name="comments"` |
| `author` | ForeignKey to `AUTH_USER_MODEL` | `related_name="comments"` |
| `content` | TextField | |
| `created_at` | DateTimeField | `auto_now_add=True` |

**Meta:** `ordering = ["created_at"]`, so comments return oldest first. No unique constraint, since users can comment many times.

## Serializers (`posts/serializers.py`)

### CommentSerializer

Used for both reading and creating comments.

- `author` is read-only and returns the username.
- `id`, `post`, `author`, `created_at` are read-only. `post` is set by the view from the URL, and `author` from the logged-in user, so clients can't set either.
- `content` is the only writable field.

### PostSerializer

Used for the list endpoint and for create/update/delete.

- `author`: read-only, returns the username.
- `likes_count`: read-only, `likes.count`.
- `comments_count`: read-only, `comments.count`.
- Fields: `id`, `author`, `content`, `created_at`, `likes_count`, `comments_count`.
- `id`, `author`, `created_at` are read-only.

### PostDetailSerializer

Extends `PostSerializer` and adds the full `comments` list, nested with `CommentSerializer`. Used only for the single-post retrieve action, so the list response stays small.

## Views (`posts/views.py`)

### PostViewSet

A `ModelViewSet` with a custom `like` and `comment` action.

- **Queryset:** `Post.objects.all().order_by("-created_at")`, newest first.
- **Permissions:** `IsAuthenticatedOrReadOnly`. Anyone can read. Creating, liking, and commenting require a valid token.
- **Serializer selection:** `get_serializer_class` returns `PostDetailSerializer` for the retrieve action and `PostSerializer` otherwise.
- **Create:** `perform_create` sets `author` to the logged-in user.

### Like action

`@action(detail=True, methods=["post"])`, named `like`.

- Loads the post with `get_object()`, which returns 404 for an unknown ID.
- Uses `Like.objects.get_or_create(user, post)`. If a like already exists, it is deleted, which toggles the state.
- Returns `{"liked": <bool>, "likes_count": <int>}`. `liked` is `True` if the like was just created and `False` if it was removed.

### Comment action

`@action(detail=True, methods=["get", "post"])`, named `comment`.

- **GET:** returns all comments on the post, serialized with `CommentSerializer(many=True)`. Public.
- **POST:** validates the body with `CommentSerializer`, then saves with `post=post` and `author=request.user`. Returns the created comment with HTTP 201. Requires authentication. Invalid input returns 400 with field errors.

## URLs

`posts/urls.py` registers the viewset with a router:

```python
router = DefaultRouter()
router.register("posts", PostViewSet, basename="post")
urlpatterns = router.urls
```

`config/urls.py` includes it under the `api/` prefix:

```python
path("api/", include("posts.urls")),
```

## Settings

- `posts` is listed in `INSTALLED_APPS`.
- `REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]` uses `rest_framework_simplejwt.authentication.JWTAuthentication`.

## Admin (`posts/admin.py`)

- `Post` is registered with `PostAdmin`: list display `id`, `author`, `content`, `created_at`; filter by `created_at`; search by `content` and `author__username`.
- `Like` is registered with `LikeAdmin`: list display `id`, `user`, `post`, `created_at`.
- `Comment` is registered in the same way if you want it visible in the admin.

## API Endpoints

Base path: `/api/`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/posts/` | Public | List posts, newest first, with `likes_count` and `comments_count` |
| POST | `/posts/` | Required | Create a post. Body: `{"content": "..."}` |
| GET | `/posts/{id}/` | Public | Post detail, including the full `comments` array |
| PUT/PATCH | `/posts/{id}/` | Required | Update a post (per viewset permissions) |
| DELETE | `/posts/{id}/` | Required | Delete a post |
| POST | `/posts/{id}/like/` | Required | Toggle the current user's like. Returns `liked` and `likes_count` |
| GET | `/posts/{id}/comment/` | Public | List comments on a post, oldest first |
| POST | `/posts/{id}/comment/` | Required | Add a comment. Body: `{"content": "..."}`. Returns 201 |

**Authentication:** send the access token as `Authorization: Bearer <access>`. Obtain it from `POST /api/token/` with `username` (or email) and `password`. Access tokens expire after the simplejwt default lifetime, so log in again when requests return 401.

### Example responses

List item:

```json
{
  "id": 1,
  "author": "hyou",
  "content": "hello",
  "created_at": "2026-10-12T19:47:55.960327Z",
  "likes_count": 1,
  "comments_count": 8
}
```

Detail item adds:

```json
{
  "comments": [
    {
      "id": 1,
      "post": 1,
      "author": "ratdog",
      "content": "first comment",
      "created_at": "2026-10-12T21:55:36.138331Z"
    }
  ]
}
```

Like toggle:

```json
{ "liked": true, "likes_count": 1 }
```

## Error Responses

| Status | Cause |
|---|---|
| 400 | Invalid body, for example a missing `content` field |
| 401 | Missing or invalid token on an authenticated endpoint |
| 404 | Post ID does not exist, or the URL is wrong (the singular `/api/post/` path is not routed) |

## Data Migration Note

`Post` was originally defined in `accounts`. It was moved to `posts`, and the old table was removed. Because the data was disposable, the migration history was reset for both apps. Any environment with the old schema must be rebuilt rather than migrated in place.

## Verification

The following were verified locally and on Render:

- Anonymous `GET` on posts and comments returns 200.
- Authenticated `POST` on comments returns 201 with the saved comment.
- Anonymous `POST` on comments and likes returns 401.
- Like toggles between `liked: true` and `liked: false`, and `likes_count` updates accordingly.
- Post list includes counts. Post detail includes the nested comments.
- Admin lists Posts and Likes.
