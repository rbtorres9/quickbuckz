import { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import { AuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { useApiContext } from '../context/ApiContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'


function Field({ id, label, ...props }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-lg border border-line bg-field px-4 py-3 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        {...props}
      />
    </div>
  )
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [slow, setSlow] = useState(false) // taking a while? (the server may be waking up)
  const navigate = useNavigate()
  const { login } = useContext(AuthContext)
  const { refreshUserCache } = useCache()
  const { fetchBaseUrl } = useApiContext()

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    try {
      const result = await fetchBaseUrl(`/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (result.isError) {
        throw new Error("Invalid credentials");
      }

      const data = result.result;

      if (Object.hasOwn(data, "access") && Object.hasOwn(data, "refresh")) {
        login(data.access, data.refresh)
        await refreshUserCache(data.access) // load your profile before showing it
        navigate("/user-page")
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40 sm:p-10">
        {/* While signing in, the pup runs across the card (right to left) and bounces */}
        <div className="relative mb-3 h-14">
          <div className={loading ? 'dog-run' : 'absolute left-0'}>
            <Logo size={56} className={`text-accent ${loading ? 'animate-bounce' : ''}`} />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted">Sign in to continue to your workspace.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <Field
            id="username"
            label="Username"
            placeholder="Enter your username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="-mt-2 flex justify-between text-xs">
            <Link to="/forgot?type=username" className="text-muted hover:text-accent">
              Forgot username?
            </Link>
            <Link to="/forgot?type=password" className="text-muted hover:text-accent">
              Forgot password?
            </Link>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-page transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-page border-t-transparent" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in <Lock size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
          <p className="text-center text-xs text-muted" aria-live="polite">
            {slow && 'Waking up the server… the first sign-in can take up to a minute.'}
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{' '}
          <Link to="/create-account" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}