import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationsContext.jsx'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'
import { errorMessage } from '../utils/errorMessage.js'


export default function Notifications() {
  // page state loaded from GET /api/notifications/ 
  const { fetchWithToken } = useAuthContext()
  const { refreshUnread } = useNotifications()

  const [notifications, setNotifications] = useState([])
  const [newIds, setNewIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingFollow, setPendingFollow] = useState(null) // username whose Follow back is in flight


  // Remember which ones were new when the page opened, so they stay highlighted,
  // then mark everything as read (this clears the badge on the bell).
  useEffect(() => {
    let cancelled = false

    async function load() {
      const data = await fetchWithToken('/api/notifications/')
      if (cancelled) return // StrictMode runs effects twice in dev; ignore the first run

      if (!Array.isArray(data)) {
        setError(errorMessage(data?.error))
        setLoading(false)
        return
      }

      const unreadIds = data.filter((n) => !n.read).map((n) => n.id)
      setNotifications(data)
      setNewIds(unreadIds)
      setLoading(false)

      if (unreadIds.length > 0) {
        await fetchWithToken('/api/notifications/mark-all-read/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ up_to_id: Math.max(...unreadIds) }),
        })
        refreshUnread()
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])    

  // POST /api/profile/<username>/follow/ is a toggle, so block double clicks
  async function followBack(username) {
    if (pendingFollow) return
    setPendingFollow(username)
    const data = await fetchWithToken(`/api/profile/${username}/follow/`, { method: 'POST' })
    setPendingFollow(null)

    if (!data || data.error) {
      setError(errorMessage(data?.error))
      return
    }

    // Update every notification from this person, not just the one clicked
    setNotifications((list) =>
      list.map((n) => (n.actor_username === username ? { ...n, is_following_actor: data.is_followed } : n))
    )
  }

  // A short preview of the post a like or comment was on
  // The backend sends the first 60 characters; add … when it was cut off
  function postPreview(n) {
    if (!n.post_preview) return 'a post that was deleted'
    return n.post_preview.length >= 60 ? n.post_preview + '…' : n.post_preview
  }


  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>

      {error && (
        <p className="mt-4 whitespace-pre-line rounded-xl border border-red-400/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center text-sm text-muted">
          Loading…
        </p>
      ) : notifications.length === 0 ? (
      
        <p className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center text-sm text-muted">
          No notifications yet.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {notifications.map((n) => {
            // fields come straight from the API 
            const isNew = newIds.includes(n.id)
            const profileUrl = `/user/${n.actor_username}`


            return (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${isNew ? 'bg-accent/5' : ''}`}>
                {/* real name and profile picture */}
                <Link to={profileUrl} className="shrink-0">
                  <Avatar name={n.actor_name} src={n.actor_avatar} />
                </Link>

                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    {/* actor_name and created_at */}
                    <Link to={profileUrl} className="font-semibold hover:underline">{n.actor_name}</Link>{' '}
                    {n.type === 'follow' && 'followed you'}
                    {n.type === 'like' && 'liked your post'}
                    {n.type === 'comment' && 'commented on your post'}
                    <span className="text-muted" title={new Date(n.created_at).toLocaleString()}>
                      {' '}· {getTimeAgoString(n.created_at)}
                    </span>
                    {isNew && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-page">New</span>}
                  </p>

                  {/* comment_text, post and post_preview */}
                  {n.type === 'comment' && n.comment_text && <p className="mt-1 break-words">“{n.comment_text}”</p>}

                  {(n.type === 'like' || n.type === 'comment') && (
                    n.post ? (
                      <Link to={`/post/${n.post}`} className="mt-1 block truncate text-muted hover:text-white">
                        {postPreview(n)}
                      </Link>
                    ) : (
                      <p className="mt-1 truncate text-muted">{postPreview(n)}</p>
                    )
                  )}
                </div>

                {/* Follow back uses is_following_actor and the real follow toggle */}
                {n.type === 'follow' && !n.is_following_actor && (
                  <button
                    onClick={() => followBack(n.actor_username)}
                    disabled={pendingFollow === n.actor_username}
                    className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-60"
                  >
                    {pendingFollow === n.actor_username ? 'Following…' : 'Follow back'}
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