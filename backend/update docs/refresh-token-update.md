# Update: Refresh Token Support

Follow-up to `session-persistence-fixes.md`. That doc ended with the known gap that only the access token was stored. This update closes it.

## Problem

simplejwt access tokens are short-lived. A session restored from localStorage could hold an expired access token, so backend calls would return 401 and the user would have to log in again.

## Backend (Django)

- `accounts/urls.py` exposes `TokenObtainPairView` and `TokenRefreshView` at `api/token/` and `api/token/refresh/`. The trailing slash on the refresh route matters.
- `config/settings.py` sets `SIMPLE_JWT` with a 15-minute access lifetime and a 7-day refresh lifetime.
- Verified with PowerShell against the API:
  - Login returns `access` and `refresh`.
  - Posting the refresh token to the refresh route returns a new `access`.
  - Decoding the tokens gave 899 s for access (15 min; the one-second difference is timestamp rounding) and 604800 s for refresh (7 days).

## Frontend

### `src/config.js`

Exports `API_URL` (the Render backend). It is imported by `AuthContext.jsx`, `Login.jsx`, and `CreateAccount.jsx`.

### `src/context/AuthContext.jsx`

- `login(access, refresh)` stores both tokens in localStorage and sets the access token in state.
- `logout()` removes both tokens and clears state.
- `refresh()` reads `refresh_token` from localStorage, POSTs it to `${API_URL}/api/token/refresh/`, stores the new access token, and returns it. If there is no refresh token or the request fails, it logs the user out.
- `fetchWithToken(url, options)` reads `access_token` from localStorage at call time (this avoids stale closures). On a 401 it calls `refresh()` once and retries the request with the new token.

```jsx
const refresh = async () => {
    const stored = localStorage.getItem('refresh_token')
    if (!stored) { logout(); return null }
    const response = await fetch(`${API_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: stored })
    })
    // on success: store data.access and return it
    // on failure: logout() and return null
}
```

### Call sites

Both pass two arguments now:

- `Login.jsx`: `login(data.access, data.refresh)`
- `CreateAccount.jsx`: `login(tokens.access, tokens.refresh)`

A single-argument call stores the text "undefined" as the refresh token, and every refresh then fails.

### Redirect target

`PublicRoute`, the `CreateAccount` guard, and the post-login navigation all point to `/user-page`. This removes a brief flash through the old `/welcome` page that happened while the profile cache loaded.

## Bugs hit along the way

| Bug | Effect | Fix |
|---|---|---|
| `` `stored` `` template literal without `${}` | Sent the word "stored" as the token; every refresh failed | `JSON.stringify({ refresh: stored })` |
| `{API_URL}` missing the `$` | Request went to a relative URL | `` `${API_URL}${url}` `` |
| Refresh URL without trailing slash | POST redirected or rejected | `/api/token/refresh/` |
| `./config` import from `src/context` | Vite import error | `../config` |
| Default import of `AuthContext` in `App.jsx` | App crashed (it is a named export) | Remove the import |
| `AuthContext.jsx` moved to `src/context` | Every import of it broke | Update each path to `../context/AuthContext` |

## Test results

| Test | Result |
|---|---|
| Corrupt `access_token`, reload | `GET /api/profile/me` returned 401, `POST /api/token/refresh/` returned 200, session continued |
| Corrupt both tokens, reload | Logged out and sent to `/login` |
| Sign up with a new account | Both tokens stored, landed on `/user-page` |
| Visit `/` while logged in | Ends on `/user-page` |

## Observation: duplicate requests

The Network tab showed two 401 requests and two refresh POSTs, nearly identical (764 B and 771 B). Two requests fired at the same time and each triggered its own refresh. In development this is most likely React StrictMode running effects twice. It is harmless while token rotation is off.

## Known gaps

- **Concurrent refreshes.** If rotation (`ROTATE_REFRESH_TOKENS` with the blacklist) is enabled, the second refresh would use an already-used token and log the user out. Fix: share one in-flight refresh promise via `useRef` so simultaneous 401s wait on the same refresh. With rotation on, `refresh()` must also store the new `data.refresh`.
- **Logout does not invalidate the refresh token on the server.** Without the token blacklist, a copied refresh token stays valid until it expires (7 days). Enabling `rest_framework_simplejwt.token_blacklist` and blacklisting on logout closes this. Avoid pasting real tokens into chats or logs for the same reason.
- **Token storage.** localStorage is readable by any XSS bug. Moving to httpOnly cookies is the longer-term hardening step, and the code comment in `AuthContext.jsx` already notes this.
- **Backend enforcement.** DRF views returning user data need `IsAuthenticated`. The frontend guard is UX only.
- **Cleanup.**
  - Remove the `console.log` that prints the new access token.
  - Handle `204 No Content` in `fetchWithToken`.
  - Protect `<Layout />` once in `App.jsx` instead of each child route, so the nav bar doesn't render for logged-out visitors.
