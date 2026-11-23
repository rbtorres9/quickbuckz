import { useEffect, useState } from 'react'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'

// Mod tools > Deactivated: accounts a mod has deactivated ("banned" in the backend), GET /api/profiles/banlist/
// Click one to open its status page, where a mod can reactivate it.
export default function ModRestrictions({ onOpen }) {
  const { fetchWithToken } = useAuthContext()
  const [users, setUsers] = useState(null) // null = still loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchWithToken('/api/profiles/banlist/').then((result) => {
      if (cancelled) return
      if (result.isError) {
        setError(errorMessage(result.result))
        setUsers([])
        return
      }
      setUsers(Array.isArray(result.result) ? result.result : [])
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Deactivated accounts</h1>
        {users && (
          <span className="text-sm text-muted">{users.length} {users.length === 1 ? 'user' : 'users'}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Accounts a moderator deactivated. Open one to see why or to reactivate it. People who deactivated their own account aren't listed.</p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {users === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        !error && (
          <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
            <p className="font-medium">No one here</p>
            <p className="mt-1 text-sm text-muted">No accounts are deactivated right now.</p>
          </div>
        )
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
                    {u.last_deactivated
                      ? `Deactivated ${u.deactivation_count} ${u.deactivation_count === 1 ? 'time' : 'times'} · last ${getTimeAgoString(u.last_deactivated)} ago`
                      : 'Deactivated in the admin site'}
                  </p>
                </div>
                <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">Deactivated</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}