# Session Persistence: What Was Fixed

## Problem

Going to `localhost:5173/` in the address bar sent users to the login screen even when logged in, and `/welcome` and `/user-page` were reachable without logging in.

## Fixes, in Order

### 1. Token lost on reload (`AuthContext.jsx`)

- **Cause:** the access token lived only in `useState(null)`, so a full page load reset it.
- **Fix:** initialize state from `localStorage.getItem('access_token')`, write it in `login`, and remove it in `logout`.

```jsx
const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'))

const login = (token) => {
    localStorage.setItem('access_token', token)
    setAccessToken(token)
}

const logout = () => {
    localStorage.removeItem('access_token')
    setAccessToken(null)
}
```

### 2. Unprotected routes (`ProtectedRoute.jsx`, `App.jsx`)

- **Cause:** nothing checked for a token before rendering `/welcome` and `/user-page`.
- **Fix:** a `ProtectedRoute` component that redirects to `/login` when `accessToken` is empty, wrapped around both routes.

```jsx
const ProtectedRoute = ({ children }) => {
    const { accessToken } = useContext(AuthContext)
    if (!accessToken) return <Navigate to="/login" replace />
    return children
}
```

### 3. `useContext(...) is null` crash

- **Cause:** `ProtectedRoute` rendered outside `<AuthProvider>`.
- **Fix:** `AuthProvider` now wraps `<App />` in `main.jsx`, inside `BrowserRouter`.

### 4. Login never stored the token (`Login.jsx`)

- **Cause:** the handler called `navigate("/welcome")` but never `login(data.access)`, so the guard bounced the user back.
- **Fix:** call `login(data.access)` before `navigate`.

```jsx
if (Object.hasOwn(data, "access") && Object.hasOwn(data, "refresh")) {
    login(data.access)
    navigate("/welcome")
}
```

### 5. Blank `/login` page (`Login.jsx`)

- **Cause:** `useContext` was used but only `useState` was imported.
- **Fix:** `import { useState, useContext } from 'react'`.

### 6. `/` always went to login (`App.jsx`)

- **Cause:** the root route was hard-coded to login.
- **Fix:** a `RootRedirect` component sends logged-in users to `/welcome` and everyone else to `/login`.

```jsx
function RootRedirect() {
    const { accessToken } = useContext(AuthContext)
    return <Navigate to={accessToken ? '/welcome' : '/login'} replace />
}
```

### 7. Logout didn't clear the token (`Welcome.jsx`)

- **Cause:** "Log out" was a `<Link to="/login">`, which only navigates.
- **Fix:** replaced it with a `<button>` calling `logout()` then `navigate('/login', { replace: true })`.

```jsx
function handleLogout() {
  logout()
  navigate('/login', { replace: true })
}
```

### 8. Logged-in users could still open `/login` (`PublicRoute.jsx`, `App.jsx`)

- **Cause:** nothing stopped a user with a valid token from viewing the login form.
- **Fix:** a `PublicRoute` component, the inverse of `ProtectedRoute`, that redirects to `/welcome` when `accessToken` is set. Wrapped around `/login` (and optionally `/create-account`).

```jsx
const PublicRoute = ({ children }) => {
    const { accessToken } = useContext(AuthContext)
    if (accessToken) return <Navigate to="/welcome" replace />
    return children
}
```

```jsx
<Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
```

- **Watch out:** `Welcome` reads `state?.from === 'create-account'` to show "Account created!". If the sign-up flow sets a token before navigating, the `PublicRoute` redirect on `/create-account` can drop that state and the page will say "You logged in!" instead. This did happen, so `/create-account` is left unwrapped and handled in the page itself (see fix 10).

### 9. Signup now logs the new user in (`CreateAccount.jsx`)

- **Cause:** after a successful signup the handler only called `navigate("/login")`, so the user had to sign in again.
- **Fix:** after signup succeeds, request tokens from `/api/token/` with the same username and password, store the access token, then go to `/welcome` with navigation state so the page shows "Account created!". If the token request fails, fall back to `/login`.

```jsx
const tokenResponse = await fetch("https://quickbuckz.onrender.com/api/token/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});

if (!tokenResponse.ok) {
  navigate("/login", { replace: true })
  return
}

const tokens = await tokenResponse.json()

login(tokens.access)
navigate("/welcome", { state: { from: 'create-account', name: first_name } })
```

- Required imports: `useContext` from `react` and `AuthContext` from `../AuthContext`. Forgetting `useContext` blanks the page.

### 10. "You logged in!" shown after signup, and logged-in users on `/create-account` (`CreateAccount.jsx`, `App.jsx`)

- **Cause:** with `/create-account` wrapped in `PublicRoute`, storing the token triggered a plain redirect to `/welcome` that dropped the navigation state, so the page said "You logged in!" instead of "Account created!".
- **Fix:** unwrap the route in `App.jsx` and have the page guard itself. A `useRef` flag lets the post-signup navigation through while still redirecting users who were already logged in.

```jsx
// App.jsx: plain route, no PublicRoute
<Route path="/create-account" element={<CreateAccount />} />
```

```jsx
// CreateAccount.jsx
import { useState, useContext, useRef } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'

const { accessToken, login } = useContext(AuthContext)
const justSignedUp = useRef(false)

// after all hooks, before handleChange
if (accessToken && !justSignedUp.current) {
  return <Navigate to="/welcome" replace />
}

// in handleSubmit, before storing the token
justSignedUp.current = true
login(tokens.access)
navigate("/welcome", { state: { from: 'create-account', name: first_name } })
```

- The guard must sit after every hook call, since React needs hooks to run in the same order on every render.
- Reloading `/welcome` clears the navigation state, so it shows "You logged in!" from then on. That is expected.

## Known Gaps

- **Refresh token:** only the access token is stored. simplejwt access tokens expire after 5 minutes by default, so a restored session can go stale, and backend calls will return 401. The next step is storing the refresh token and using it to renew.
- **Backend enforcement:** the frontend guard is UX only. DRF views returning user data need `IsAuthenticated`.
- **Optional:** add a logout button to `/user-page` (reuse the same `handleLogout` from `Welcome.jsx`, or extract a shared `LogoutButton` component).
