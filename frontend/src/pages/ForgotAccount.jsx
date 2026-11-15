import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useApiContext } from '../context/ApiContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'

// TODO: confirm this address with the backend once the forgot-password API is built.
// The backend should EMAIL the reset link (with the token) and never send the token back here.
const FORGOT_PASSWORD_URL = '/api/forgot/password/'
const FORGOT_USERNAME_URL = '/api/forgot/username/'

// One page for both "forgot password" and "forgot username".
// /forgot?type=username opens on the username tab.
export default function ForgotAccount() {
  const [params] = useSearchParams()
  const [type, setType] = useState(params.get('type') === 'username' ? 'username' : 'password')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const { fetchBaseUrl } = useApiContext()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const url = type === 'username' ? FORGOT_USERNAME_URL : FORGOT_PASSWORD_URL

    setSending(true)
    const result = await fetchBaseUrl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setSending(false)

    if (result.response?.status === 404) return setError("Password/username reset isn't available.")
    if (result.isError) return setError(errorMessage(result.result))
    // Same message whether or not the email has an account, so no one can use this to check emails
    setSent(true)
  }

  const tab = (value, label) => (
    <button
      type="button"
      onClick={() => { setType(value); setSent(false); setError('') }}
      className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
        type === value ? 'bg-accent text-page' : 'text-muted hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40 sm:p-10">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Account help</h1>

        <div className="mt-6 flex gap-1 rounded-lg border border-line bg-field p-1">
          {tab('password', 'Forgot password')}
          {tab('username', 'Forgot username')}
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-page">
              <MailCheck size={22} strokeWidth={2.5} />
            </div>
            <p className="text-sm text-muted">
              If an account uses <span className="font-medium text-white">{email}</span>, we've sent{' '}
              {type === 'password' ? 'a link to reset your password' : 'your username'} to it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <p className="text-sm text-muted">
              {type === 'password'
                ? "Enter your account's email and we'll send you a link to reset your password."
                : "Enter your account's email and we'll send you your username."}
            </p>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-page transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-60"
            >
              {sending ? 'Sending…' : type === 'password' ? 'Send reset link' : 'Send my username'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="font-semibold text-accent hover:underline">Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}
