import { useState, useContext, useRef } from 'react'
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { afterLoginPath } from '../utils/afterLogin.js'
import { AuthContext } from '../context/AuthContext'
import { useCache } from '../context/CacheContext.jsx'
import { useStore } from '../data/store.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { themeVars } from '../data/themes.js'
import { useApiContext } from '../context/ApiContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { usePageTitle } from '../utils/usePageTitle.js'

const fields = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'username', label: 'Username', autoComplete: 'username' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
  { name: 'first_name', label: 'First name', autoComplete: 'given-name' },
  { name: 'last_name', label: 'Last name', autoComplete: 'family-name' },
]

export default function CreateAccount() {
  usePageTitle('Create account')
  const [form, setForm] = useState(
    Object.fromEntries(fields.map((f) => [f.name, '']))
  )

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [slow, setSlow] = useState(false) // taking a while? (the server may be waking up)
  // Theme picked here is saved to the new profile right after signup (see below)
  const [theme, setTheme] = useState('classic')
  const navigate = useNavigate()
  const location = useLocation() // may carry a shared link to go back to
  const { accessToken, login, fetchWithToken } = useContext(AuthContext)
  const { refreshUserCache } = useCache()
  const { updateProfile } = useStore()
  const { fetchBaseUrl } = useApiContext()
  const justSignedUp = useRef(false)

  // Already signed in? Go to your profile (unless you just made this account)
  if (accessToken && !justSignedUp.current) {
    return <Navigate to="/user-page" replace />
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password != form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    try {
      const {email, username, password, first_name, last_name } = form
      const result = await fetchBaseUrl(`/api/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      // ERR: This runs when certain fields are invalid such as the username which is unhelpful
      if (result.isError) {
        let errorDetails = `${result.response.status} Error`

        try {
          let errors = []
          const errorData = result.result
          
          for (const [key, value] of Object.entries(errorData)) {
            if (Array.isArray(value)) {
              for (const err of value)
                errors.push(err)
            }
          }

          errorDetails = errors.join("\n")
        }
        catch {
          /* Leave empty for now */
        }

        throw new Error(errorDetails);
      }

      // signup succeeded, so sign the new user in
      const tokenResult = await fetchBaseUrl(`/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (tokenResult.isError) {
        // account exists but auto-login failed, so fall back to the login page
        navigate("/login", { replace: true, state: location.state })
        return
      }

      const tokens = tokenResult.result

      justSignedUp.current = true
      login(tokens.access, tokens.refresh)
      // save the picked theme on the profile
      await fetchWithToken('/api/profile/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      }, tokens.access)
      await refreshUserCache(tokens.access)
      navigate(afterLoginPath(location), { replace: true }) // back to a shared post, or your profile
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40 sm:p-10" style={themeVars(theme)}>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Create your account</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {fields.map(({ name, label, type = 'text', autoComplete }) => (
            <div key={name} className="space-y-1.5">
              <label htmlFor={name} className="block text-sm font-medium">
                {label}
              </label>
              <input
                id={name}
                name={name}
                type={type}
                placeholder={label}
                autoComplete={autoComplete}
                required
                value={form[name]}
                onChange={handleChange}
                className="w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
            </div>
          ))}

          <ThemePicker label="Pick a profile theme" value={theme} onChange={setTheme} />
          <p className="-mt-2 text-xs text-muted">You can change it anytime in Edit profile.</p>

          {error && <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-page transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-page border-t-transparent" aria-hidden="true" />}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-center text-xs text-muted" aria-live="polite">
            {slow && 'Waking up the server… this can take up to a minute.'}
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
