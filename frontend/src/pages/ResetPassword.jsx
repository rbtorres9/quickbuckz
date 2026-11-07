import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useApiContext } from '../context/ApiContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'

// The page the reset email links to: /reset-password?token=...
// TODO: confirm this address with the backend once the reset-password API is built.
const RESET_PASSWORD_URL = '/api/password/reset/'

const inputClass =
  'w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { fetchBaseUrl } = useApiContext()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    // Quick checks here; the backend checks the real password rules too
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setSaving(true)
    const result = await fetchBaseUrl(RESET_PASSWORD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    setSaving(false)
    if (result.response?.status === 404) return setError("Password reset isn't available yet. Check back soon.")
    // e.g. the link expired, or the password is too common
    if (result.isError) return setError(errorMessage(result.result))
    setDone(true)
  }

  let content
  if (!token) {
    content = (
      <p className="mt-6 text-center text-sm text-muted">
        This reset link is missing its code.{' '}
        <Link to="/forgot" className="font-semibold text-accent hover:underline">Request a new link</Link>
      </p>
    )
  } else if (done) {
    content = (
      <div className="mt-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-accent" />
        <p className="mt-3 text-sm text-muted">Your password was changed. You can sign in with it now.</p>
        <Link to="/login" className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-page hover:bg-accent-hover">
          Sign in
        </Link>
      </div>
    )
  } else {
    content = (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="block text-sm font-medium">New password</label>
          <input id="newPassword" type="password" autoComplete="new-password" required value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }} className={inputClass} />
          <p className="text-xs text-muted">At least 8 characters. Avoid common passwords.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium">Confirm new password</label>
          <input id="confirmPassword" type="password" autoComplete="new-password" required value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError('') }} className={inputClass} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-page transition hover:bg-accent-hover disabled:opacity-60">
          {saving ? 'Saving…' : 'Set new password'}
        </button>
        <p className="text-center text-xs text-muted">
          Link expired? <Link to="/forgot" className="font-semibold text-accent hover:underline">Get a new one</Link>
        </p>
      </form>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40 sm:p-10">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Set a new password</h1>
        {content}
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="font-semibold text-accent hover:underline">Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}
