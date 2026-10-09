import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, sampleUsers } from '../data/store.jsx'
import Avatar from '../components/Avatar.jsx'

export default function Following() {
  const { following, toggleFollowUser } = useStore()

  // Keep the list as it was when the page opened, so an accidental Unfollow
  // doesn't make the person vanish. They can tap Follow again to undo.
  const [shown] = useState(following)
  const people = shown.map((handle) => sampleUsers[handle]).filter(Boolean)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Following</h1>
        <span className="text-sm text-muted">{following.length} {following.length === 1 ? 'person' : 'people'}</span>
      </div>

      {people.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">You're not following anyone yet</p>
          <p className="mt-1 text-sm text-muted">When you follow people, they'll show up here.</p>
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
            const isFollowing = following.includes(person.handle)
            return (
              <li key={person.handle} className="flex items-center gap-3 px-5 py-4">
                <Link to={`/user/${person.handle}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={person.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold group-hover:underline">{person.name}</p>
                    <p className="truncate text-sm text-muted">@{person.handle}</p>
                    {person.bio && <p className="mt-1 line-clamp-2 text-sm">{person.bio}</p>}
                  </div>
                </Link>
                <button
                  onClick={() => toggleFollowUser(person.handle)}
                  aria-label={`${isFollowing ? 'Unfollow' : 'Follow'} ${person.name}`}
                  className={`group shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isFollowing
                      ? 'border border-line hover:border-red-400/60 hover:text-red-300'
                      : 'bg-accent text-page hover:bg-accent-hover'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <span className="group-hover:hidden">Following</span>
                      <span className="hidden group-hover:inline">Unfollow</span>
                    </>
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
