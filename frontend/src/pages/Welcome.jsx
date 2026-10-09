import { useContext } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { AuthContext } from '../AuthContext'


// Dummy "you're in" page. Login and Create Account send people here.
// Replace with the real /user-page once the backend exists.
export default function Welcome() {
  const { state } = useLocation()
  const { logout } = useContext(AuthContext)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const name = state?.name
  const isNew = state?.from === 'create-account'

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-2xl shadow-black/40 sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-page">
          <CheckCircle2 size={26} strokeWidth={2.5} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {isNew ? 'Account created!' : 'You logged in!'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {name ? `Welcome, ${name}. ` : ''}
          This is a placeholder page. Real accounts aren't connected yet.
        </p>

        <Link
          to="/user-page"
          className="mt-6 inline-block w-full rounded-lg bg-accent py-3 text-sm font-semibold text-page transition hover:bg-accent-hover"
        >
          Go to profile
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 inline-block w-full rounded-lg border border-line py-3 text-sm font-semibold transition hover:bg-white/5"
        >
          Log out
        </button>
      </div>
    </main>
  )
}
