import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'

// Mod tools > Account restrictions: users who have ever been restricted.
const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
]

export default function ModRestrictions({ onOpen }) {
  const { fetchWithToken } = useAuthContext()
  const [filter, setFilter] = useState('active')
  const [users, setUsers] = useState(null) // null = still loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setUsers(null)
    setError(null)
    fetchWithToken(`/api/restrictions/?status=${filter}`).then((result) => {
      if (cancelled) return
      if (result.isError) {
        setError(errorMessage(result.result))
        setUsers([])
        return
      }
      const data = result.result
      setUsers(Array.isArray(data) ? data : data?.results ?? [])
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Account restrictions</h1>
        {users && (
          <span className="text-sm text-muted">{users.length} {users.length === 1 ? 'user' : 'users'}</span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              filter === f.value ? 'bg-accent text-page' : 'border border-line hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {users === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">No one here</p>
          <p className="mt-1 text-sm text-muted">
            {filter === 'active' ? 'No accounts are restricted right now.' : 'No account has been restricted yet.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {users.map((u) => (
            <li key={u.username}>
              <button
                type="button"
                onClick={() => onOpen(u.username)}
                className="group flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-card px-5 py-4 text-left hover:bg-white/5"
              >
                <div>
                  <p className="font-semibold group-hover:underline underline-offset-4">@{u.username}</p>
                  <p className="mt-1 text-xs text-muted">
                    {u.restriction_count} {u.restriction_count === 1 ? 'restriction' : 'restrictions'} total · last {getTimeAgoString(u.last_restricted)} ago
                  </p>
                </div>
                {u.active_count > 0 ? (
                  <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">{u.active_count} active</span>
                ) : (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-muted">none active</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}