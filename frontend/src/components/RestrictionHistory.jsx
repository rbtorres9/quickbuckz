import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getDateTimeString } from '../utils/DateTimeUtils.js'

// Mod tools > one account's status and ban history, with Ban / Reactivate
// GET /api/profile/<username>/status/, POST and DELETE /api/profile/<username>/ban/
export default function RestrictionHistory({ username, onBack, backLabel }) {
  const { fetchWithToken } = useAuthContext()
  const [status, setStatus] = useState(null) // null = loading, false = failed to load
  const [error, setError] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { text, ok }

  function loadStatus(isCancelled = () => false) {
    return fetchWithToken(`/api/profile/${username}/status/`).then((result) => {
      if (isCancelled()) return
      if (result.isError) {
        setError(errorMessage(result.result))
        setStatus(false)
        return
      }
      setError(null)
      setStatus(result.result)
    })
  }

  useEffect(() => {
    let cancelled = false
    setStatus(null)
    setError(null)
    setMessage(null)
    setReason('')
    loadStatus(() => cancelled)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  async function ban(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const result = await fetchWithToken(`/api/profile/${username}/ban/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setBusy(false)
    if (result.isError) return setMessage({ text: errorMessage(result.result), ok: false })
    setReason('')
    setMessage({ text: `@${username} was banned.`, ok: true })
    loadStatus()
  }

  async function reactivate() {
    setBusy(true)
    setMessage(null)
    const result = await fetchWithToken(`/api/profile/${username}/ban/`, { method: 'DELETE' })
    setBusy(false)
    if (result.isError) return setMessage({ text: errorMessage(result.result), ok: false })
    setMessage({ text: `@${username} was reactivated.`, ok: true })
    loadStatus()
  }

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted hover:text-accent hover:underline underline-offset-4"
      >
        ← {backLabel}
      </button>

      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">@{username}</h1>
        {status && !status.is_deactivated && (
          <Link to={`/user/${username}`} className="text-sm text-muted hover:text-accent hover:underline underline-offset-4">
            View profile
          </Link>
        )}
      </div>

      {status && (
        <p className="mt-1 text-sm text-muted">
          Account status:{' '}
          <span className={status.is_deactivated ? 'font-semibold text-red-300' : 'font-semibold'}>
            {status.is_deactivated ? 'Banned' : 'Active'}
          </span>
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {message && (
        <p className={`mt-3 text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
      )}

      {status === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : status && (
        <>
          {status.is_deactivated ? (
            <button
              type="button"
              onClick={reactivate}
              disabled={busy}
              className="mt-4 rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
            >
              Reactivate account
            </button>
          ) : (
            <form onSubmit={ban} className="mt-4 flex flex-wrap gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="Reason for the ban"
                className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !reason.trim()}
                className="rounded-full bg-red-500/80 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Ban account
              </button>
            </form>
          )}

          <h2 className="mt-8 text-sm font-semibold text-muted">Ban history</h2>
          {status.history.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              {status.is_deactivated
                ? 'Banned in the admin site, so there is no reason on record.'
                : 'This account has never been banned.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {status.history.map((entry) => {
                const banned = entry.action === 'deactivate'
                return (
                  <li key={entry.id} className="rounded-2xl border border-line bg-card px-5 py-4">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${banned ? 'bg-red-500/15 text-red-300' : 'bg-white/10 text-muted'}`}>
                      {banned ? 'Banned' : 'Reactivated'}
                    </span>
                    {banned && <p className="mt-2 text-sm">{entry.details}</p>}
                    <p className="mt-2 text-xs text-muted">
                      {getDateTimeString(entry.created_at)}
                      {entry.moderator && ` by ${entry.moderator === 'Admin' ? 'Admin' : `@${entry.moderator}`}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}