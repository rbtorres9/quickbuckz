import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { getName } from '../utils/NameHandler.js'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from './Avatar.jsx'

// A list of people with Follow / Following buttons. Used by the Following and Followers pages.
// direction: "following" (people you follow) or "followers" (people who follow you)
export default function PeopleList({ title, direction, emptyText }) {
  const { fetchWithToken } = useAuthContext()
  const { refreshUserCache } = useCache()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // username whose button is busy

  useEffect(() => {
    fetchWithToken(`/api/profile/me/${direction}/`).then((data) => {
      setLoading(false)
      if (Object.hasOwn(data, 'error')) return setError(errorMessage(data.error))
      setPeople(data.results ?? data)
    })
  }, [direction])

  // Follow = POST, Unfollow = DELETE. The list keeps everyone so an accidental
  // Unfollow doesn't make the person vanish; tap Follow again to undo.
  async function toggleFollow(person) {
    setPending(person.username)
    const data = await fetchWithToken(`/api/profile/${person.username}/follow/`, {
      method: person.is_following ? 'DELETE' : 'POST',
    })
    setPending(null)
    if (Object.hasOwn(data, 'error')) return setError(errorMessage(data.error))
    refreshUserCache() // so your own Following count stays right
    setPeople((list) => list.map((p) => (p.username === person.username ? { ...p, is_following: data.is_followed } : p)))
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {!loading && <span className="text-sm text-muted">{people.length} {people.length === 1 ? 'person' : 'people'}</span>}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-6 py-10 text-center text-sm text-muted">Loading…</p>
      ) : people.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">{emptyText}</p>
          <Link
            to="/user-page"
            className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover"
          >
            Back to profile
          </Link>
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
                    {person.bio && <p className="mt-1 line-clamp-2 text-sm">{person.bio}</p>}
                  </div>
                </Link>
                <button
                  onClick={() => toggleFollow(person)}
                  disabled={pending === person.username}
                  aria-label={`${person.is_following ? 'Unfollow' : 'Follow'} ${name}`}
                  className={`group shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                    person.is_following
                      ? 'border border-line hover:border-red-400/60 hover:text-red-300'
                      : 'bg-accent text-page hover:bg-accent-hover'
                  }`}
                >
                  {person.is_following ? (
                    <>
                      <span className="group-hover:hidden">Following</span>
                      <span className="hidden group-hover:inline">Unfollow</span>
                    </>
                  ) : direction === 'followers' ? (
                    'Follow back'
                  ) : (
                    'Follow'
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
