import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getDateTimeString } from '../utils/DateTimeUtils.js'

// Mod tools > one user's full restriction history (GET /api/profile/<username>/restrictions/)

// Same labels as AccountRestriction.Kind in backend/moderation/models.py
const KIND_LABELS = {
  account: 'Account',
  posting: 'Posting',
  commenting: 'Commenting',
  interacting: 'Liking and following',
  reporting: 'Reporting',
}

function statusOf(r) {
  if (r.is_active) return { text: 'Active', className: 'bg-red-500/15 text-red-300' }
  if (r.lifted_at) return { text: 'Lifted', className: 'bg-white/10 text-muted' }
  return { text: 'Expired', className: 'bg-white/10 text-muted' }
}

export default function RestrictionHistory({ username, onBack, backLabel }) {
  const { fetchWithToken } = useAuthContext()
  const [items, setItems] = useState(null) // null = still loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)
    fetchWithToken(`/api/profile/${username}/restrictions/`).then((result) => {
      if (cancelled) return
      if (result.isError) {
        setError(errorMessage(result.result))
        setItems([])
        return
      }
      const data = result.result
      setItems(Array.isArray(data) ? data : data?.results ?? [])
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  const activeCount = items ? items.filter((r) => r.is_active).length : 0

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
        <Link to={`/user/${username}`} className="text-sm text-muted hover:text-accent hover:underline underline-offset-4">
          View profile
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Account restriction history{items && items.length > 0 && ` · ${activeCount} active`}
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {items === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        !error && (
          <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
            <p className="font-medium">Clean record</p>
            <p className="mt-1 text-sm text-muted">This account has never been restricted.</p>
          </div>
        )
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((r) => {
            const status = statusOf(r)
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-card px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{KIND_LABELS[r.kind] ?? r.kind}</p>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.text}</span>
                </div>
                <p className="mt-2 text-sm">Reason: {r.reason}</p>
                <p className="mt-2 text-xs text-muted">
                  {getDateTimeString(r.created_at)}
                  {r.created_by && ` by ${r.source === 'admin' ? 'Admin' : `@${r.created_by}`}`}
                  {' · '}
                  {r.expires_at ? `until ${getDateTimeString(r.expires_at)}` : 'permanent'}
                </p>
                {r.lifted_at && (
                  <p className="mt-1 text-xs text-muted">
                    Lifted {getDateTimeString(r.lifted_at)}
                    {r.lifted_by && ` by ${r.lifted_source === 'admin' ? 'Admin' : `@${r.lifted_by}`}`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}