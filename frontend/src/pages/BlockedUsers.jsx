import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { getName } from '../utils/NameHandler.js'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from '../components/Avatar.jsx'
import WakingUpNote from '../components/WakingUpNote.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

// People you've blocked, with an Unblock button. Opened from Settings > Privacy.
// TODO (backend): GET /api/profile/me/blocked/ (list of profiles) and DELETE /api/profile/<username>/block/
export default function BlockedUsers() {
  usePageTitle('Blocked users')
  const { fetchWithToken } = useAuthContext()
  const { refreshUserCache } = useCache()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWithToken('/api/profile/me/blocked/').then((result) => {
      setLoading(false)
      if (result.isError) return setError(errorMessage(result.result))
      setPeople(result.result.results ?? result.result)
    })
  }, [])

  async function unblock(person) {
    const result = await fetchWithToken(`/api/profile/${person.username}/block/`, { method: 'DELETE' })
    if (result.isError) return setError(errorMessage(result.result))
    refreshUserCache()
    setPeople((list) => list.filter((p) => p.username !== person.username))
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Blocked users</h1>
      <p className="mt-1 text-sm text-muted">Blocked people can't see your profile or posts, and you won't see theirs.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="mt-6 py-10 text-center text-sm text-muted">Loading…<WakingUpNote /></div>
      ) : people.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">You haven't blocked anyone.</p>
          <Link to="/user-account" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Back to settings</Link>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {people.map((person) => {
            const name = getName(person) || person.username
            return (
              <li key={person.username} className="flex items-center gap-3 px-5 py-4">
                <Link to={`/user/${person.username}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={name} src={person.profile_picture} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold group-hover:underline">{name}</p>
                    <p className="truncate text-sm text-muted">@{person.username}</p>
                  </div>
                </Link>
                <button
                  onClick={() => unblock(person)}
                  aria-label={`Unblock ${name}`}
                  className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5"
                >
                  Unblock
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
