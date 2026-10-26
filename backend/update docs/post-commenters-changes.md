# Changelog

## 2026-10-25

### Added
- **Comment previews in post lists.** `GET /api/posts/` and `GET /api/profile/<username>/posts/`
  now include a `comments` array holding the 3 most recent comments on each post, oldest to newest.
  Use `comments_count` to tell whether there are more (e.g. "View all 5 comments").
- **Comment author details.** Each comment now includes its author's `username`, `first_name`,
  `last_name` and `profile_picture` (a full URL, or `null` if the user has no picture).
- **Full comment list on post detail.** `GET /api/posts/<id>/` returns every comment on the post,
  each with author details.

### Changed
- **BREAKING: `comment.author` is now an object instead of a username string.** This applies to every
  endpoint that returns comments, including `GET/POST /api/posts/<id>/comment/`.
  - Before: `"author": "hyou"`
  - After: `"author": {"username": "hyou", "first_name": "", "last_name": "", "profile_picture": null}`
  - Frontend: change `comment.author` to `comment.author.username` wherever it's used as a name.
- Post detail now loads comment authors and their profiles up front, so it doesn't run a query per comment.

### Security
- **Private profiles' posts are no longer visible to everyone through `/api/posts/`.**
  `PostViewSet` now filters posts by `visible_profiles(request.user)`, the same check
  `/api/profile/<username>/posts/` already used. List, detail, like and comment all respect it, and a
  post the user isn't allowed to see returns `404`.

### Notes
- No database migrations needed.
- Post list endpoints run one extra query per post to load its comment preview. That's fine at
  current scale; revisit if the feed gets slow.