import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { getName } from '../utils/NameHandler.js'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from './Avatar.jsx'

// "Suggested for you": the newest accounts you don't follow yet.
// Rows stay after you tap Follow so you can undo, same as PeopleList.
export default function FollowSuggestions() {
  const { fetchWithToken } = useAuthContext()
  const { refreshUserCache } = useCache()
  const [people, setPeople] = useState(null) // null = still loading
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // username whose button is busy

  useEffect(() => {
    fetchWithToken('/api/profile/me/suggestions/').then((result) => {
      if (result.isError) {
        setPeople([])
        return setError(errorMessage(result.result))
      }
      setPeople(result.result.results ?? result.result)
    })
  }, [])

  // Follow = POST (public follows, private sends a request), Unfollow/Cancel = DELETE
  async function toggleFollow(person) {
    setPending(person.username)
    const result = await fetchWithToken(`/api/profile/${person.username}/follow/`, {
      method: person.is_following || person.is_requested ? 'DELETE' : 'POST',
    })
    const data = result.result

    setPending(null)
    if (result.isError) return setError(errorMessage(data))
    refreshUserCache() // keeps your Following count right
    setPeople((list) => list.map((p) => (p.username === person.username
      ? { ...p, is_following: data.is_followed, is_requested: data.is_requested }
      : p)))
  }

  if (people === null) return null                 // loading: show nothing
  if (people.length === 0 && !error) return null   // no one to suggest

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">Suggested for you</h2>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {people.length > 0 && (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {people.map((person) => {
            const name = getName(person) || person.username
            const isPrivate = person.visibility === 'private'
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
                  aria-label={`${person.is_following ? 'Unfollow' : person.is_requested ? 'Cancel request to' : isPrivate ? 'Request to follow' : 'Follow'} ${name}`}
                  className={`group shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                    person.is_following || person.is_requested
                      ? 'border border-line hover:border-red-400/60 hover:text-red-300'
                      : 'bg-accent text-page hover:bg-accent-hover'
                  }`}
                >
                  {person.is_following ? (
                    <>
                      <span className="group-hover:hidden">Following</span>
                      <span className="hidden group-hover:inline">Unfollow</span>
                    </>
                  ) : person.is_requested ? (
                    <>
                      <span className="group-hover:hidden">Requested</span>
                      <span className="hidden group-hover:inline">Cancel</span>
                    </>
                  ) : isPrivate ? 'Request' : 'Follow'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
