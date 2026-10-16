import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, sampleUsers } from '../data/store.jsx'
import Avatar from '../components/Avatar.jsx'

export default function Notifications() {
  const { notifications, markAllRead, following, toggleFollowUser, posts } = useStore()

  // Remember which ones were new when the page opened, so they stay highlighted,
  // then mark everything as read (this clears the badge on the bell).
  const [newIds] = useState(() => notifications.filter((n) => !n.read).map((n) => n.id))
  useEffect(() => {
    markAllRead()
  }, [])

  // A short preview of the post a like or comment was on
  function postPreview(postId) {
    const post = posts.find((p) => p.id === postId)
    if (!post) return 'a post that was deleted'
    if (!post.text) return 'your photo'
    return post.text.length > 60 ? post.text.slice(0, 60) + '…' : post.text
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>

      {notifications.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center text-sm text-muted">
          No notifications yet.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {notifications.map((n) => {
            const person = sampleUsers[n.handle]
            if (!person) return null
            const isNew = newIds.includes(n.id)

            return (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${isNew ? 'bg-accent/5' : ''}`}>
                <Link to={`/user/${n.handle}`} className="shrink-0">
                  <Avatar name={person.name} />
                </Link>

                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    <Link to={`/user/${n.handle}`} className="font-semibold hover:underline">{person.name}</Link>{' '}
                    {n.type === 'follow' && 'followed you'}
                    {n.type === 'like' && 'liked your post'}
                    {n.type === 'comment' && 'commented on your post'}
                    <span className="text-muted"> · {n.time}</span>
                    {isNew && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-page">New</span>}
                  </p>

                  {n.type === 'comment' && <p className="mt-1 break-words">“{n.text}”</p>}

                  {(n.type === 'like' || n.type === 'comment') && (
                    <Link to={`/post/${n.postId}`} className="mt-1 block truncate text-muted hover:text-white">
                      {postPreview(n.postId)}
                    </Link>
                  )}
                </div>

                {n.type === 'follow' && !following.includes(n.handle) && (
                  <button
                    onClick={() => toggleFollowUser(n.handle)}
                    className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover"
                  >
                    Follow back
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
