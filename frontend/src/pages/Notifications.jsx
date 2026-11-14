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
  const [pendingDecision, setPendingDecision] = useState(null)  // follow request notification



  // Remember which ones were new when the page opened, so they stay highlighted,
  // then mark everything as read (this clears the badge on the bell).
  useEffect(() => {
    let cancelled = false

    async function load() {
      const result = await fetchWithToken('/api/notifications/')
      const data = result.result
      
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
    const result = await fetchWithToken(`/api/profile/${username}/follow/`, { method: 'POST' })
    const data = result.result
    setPendingFollow(null)

    if (result.isError) {
      setError(errorMessage(data))
      return
    }

    // Update every notification from this person, not just the one clicked
    setNotifications((list) =>
      list.map((n) => (n.actor_username === username
        ? { ...n, is_following_actor: data.is_followed, is_requested_actor: data.is_requested }
        : n))
    )
  }

  // cancel pending request to a private account (through notifications tab)
  async function cancelRequest(username) {
    if (pendingFollow) return
    setPendingFollow(username)
    const result = await fetchWithToken(`/api/profile/me/following/requests/${username}/`, { method: 'DELETE' })
    setPendingFollow(null)

    if (result.isError) {
      setError(errorMessage(result.result))
      return
    }

    setNotifications((list) =>
      list.map((n) => (n.actor_username === username ? { ...n, is_requested_actor: false } : n))
    )
  }


  async function decideRequest(username, accept) {
    if (pendingDecision) return
    setPendingDecision(username)
    const result = await fetchWithToken(`/api/profile/me/followers/requests/${username}/`, { method: accept ? 'POST' : 'DELETE' })
    setPendingDecision(null)

    if (result.isError) {
      setError(errorMessage(result.result))
      return
    }

    setNotifications((list) =>
      accept
        ? list.map((n) => (n.type === 'follow_request' && n.actor_username === username ? { ...n, type: 'follow' } : n))
        : list.filter((n) => !(n.type === 'follow_request' && n.actor_username === username))
    )
  }
  

  // A short preview of the post a like or comment was on
  // The backend sends the first 60 characters; add … when it was cut off
  function postPreview(n) {
    if (!n.post_preview) return 'a post that was deleted'
    return n.post_preview.length >= 60 ? n.post_preview + '…' : n.post_preview
  }

  // text for a mod action notification
  function removalText(n) {
    switch (n.mod_action) {
      case 'remove_post': return 'removed your post'
      case 'remove_comment': return 'removed your comment'
      case 'remove_in_profile': return 'removed content from your profile'
      default: return 'removed your content'
    }
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
            // mod notices have no actor profile
            const isModNotice = n.type === 'content_removed'
            const profileUrl = isModNotice ? null : `/user/${n.actor_username}`

            return (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${isNew ? 'bg-accent/5' : ''}`}>
                {/* plain avatar for mod notifications */}
                {/* else, display real name and profile picture with link to their profile URL */}
                {isModNotice ? (
                  <span className="shrink-0"><Avatar name="Moderators" /></span>
                ) : (
                  <Link to={profileUrl} className="shrink-0">
                    <Avatar name={n.actor_name} src={n.actor_avatar} />
                  </Link>
                )}

                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    {/* text section of the notification card */}
                    {/* unlinked name for mod notifications */}
                    {/* otherwise, actor_name and created_at, with link to profile URL */}
                    {isModNotice
                      ? <span className="font-semibold">{n.actor_name}</span>
                      : <Link to={profileUrl} className="font-semibold hover:underline">{n.actor_name}</Link>}{' '}
                    {n.type === 'follow' && 'followed you'}
                    {n.type === 'like' && 'liked your post'}
                    {n.type === 'comment' && 'commented on your post'}
                    {n.type === 'follow_request' && 'requested to follow you'}
                    {isModNotice && removalText(n)} {/* "Moderators" <mod_actions> e.g. "Moderators removed your post" */}
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
                  {/* mod message + what was removed */}
                  {isModNotice && (
                    <>
                      <p className="mt-2 whitespace-pre-line break-words rounded-lg border border-line bg-field px-3 py-2">
                        {n.message}
                      </p>
                      {n.content_preview && (
                        <p className="mt-1 truncate text-muted">Removed: {n.content_preview}</p>
                      )}
                    </>
                  )}

                </div>

                {/* Follow back uses is_following_actor and the real follow toggle */}
                {/* pending request to a private actor shows "Requested" */}
                {n.type === 'follow' && !n.is_following_actor && (
                  n.is_requested_actor ? (
                    <button
                      onClick={() => cancelRequest(n.actor_username)}
                      disabled={pendingFollow === n.actor_username}
                      className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:border-red-400/60 hover:text-red-300 disabled:opacity-60"
                    >
                      {pendingFollow === n.actor_username ? 'Cancelling…' : 'Requested'}
                    </button>
                  ) : (
                    <button
                      onClick={() => followBack(n.actor_username)}
                      disabled={pendingFollow === n.actor_username}
                      className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-60"
                    >
                      {pendingFollow === n.actor_username ? 'Sending…' : 'Follow back'}
                    </button>
                  )
                )}

                {n.type === 'follow_request' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => decideRequest(n.actor_username, true)}
                      disabled={pendingDecision === n.actor_username}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => decideRequest(n.actor_username, false)}
                      disabled={pendingDecision === n.actor_username}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}