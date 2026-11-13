import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { useNotifications } from '../context/NotificationsContext.jsx'
import { getName } from '../utils/NameHandler.js'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from './Avatar.jsx'

const RECEIVED_URL = '/api/profile/me/followers/requests/'
const SENT_URL = '/api/profile/me/following/requests/'

// "Requests to you": Accept = POST, Decline = DELETE on RECEIVED_URL<username>/
// "Sent": Cancel = DELETE on SENT_URL<username>/
// Hidden when nothing is pending.
export default function FollowRequests() {
  const { fetchWithToken } = useAuthContext()
  const { refreshUserCache } = useCache()
  const { refreshUnread } = useNotifications()
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // username whose buttons are busy

  useEffect(() => {
    Promise.all([fetchWithToken(RECEIVED_URL), fetchWithToken(SENT_URL)]).then(([receivedResult, sentResult]) => {
      setLoading(false)
      if (receivedResult.isError) return setError(errorMessage(receivedResult.result))
      if (sentResult.isError) return setError(errorMessage(sentResult.result))
      setReceived(receivedResult.result.results ?? receivedResult.result)
      setSent(sentResult.result.results ?? sentResult.result)
    })
  }, [])

  async function decide(username, accept) {
    if (pending) return
    setPending(username)
    setError('')
    const result = await fetchWithToken(`${RECEIVED_URL}${username}/`, { method: accept ? 'POST' : 'DELETE' })
    setPending(null)

    if (result.isError) return setError(errorMessage(result.result))
    setReceived((list) => list.filter((p) => p.username !== username))
    if (accept) refreshUserCache() // your Followers count went up
    refreshUnread() // the request's notification was deleted
  }

  async function cancel(username) {
    if (pending) return
    setPending(username)
    setError('')
    const result = await fetchWithToken(`${SENT_URL}${username}/`, { method: 'DELETE' })
    setPending(null)

    if (result.isError) return setError(errorMessage(result.result))
    setSent((list) => list.filter((p) => p.username !== username))
  }

  if (loading) return <p className="mt-6 py-10 text-center text-sm text-muted">Loading…</p>
  if (!error && received.length === 0 && sent.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
        <p className="font-medium">No pending follow requests.</p>
      </div>
    )
  }

  // One row: avatar + name link on the left, buttons on the right
  function row(person, buttons) {
    const name = getName(person) || person.username
    return (
      <li key={person.username} className="flex items-center gap-3 px-5 py-4">
        <Link to={`/user/${person.username}`} className="group flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={name} src={person.profile_picture} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold group-hover:underline">{name}</p>
            <p className="truncate text-sm text-muted">@{person.username} · {getTimeAgoString(person.created_at)}</p>
          </div>
        </Link>
        <div className="flex shrink-0 gap-2">{buttons}</div>
      </li>
    )
  }

  return (
    <section className="mt-2">
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {received.length > 0 && (
        <>
          <p className="mt-4 text-sm font-medium text-muted">Requests to you · {received.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {received.map((person) => row(person, (
              <>
                <button
                  onClick={() => decide(person.username, true)}
                  disabled={pending === person.username}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => decide(person.username, false)}
                  disabled={pending === person.username}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
                >
                  Decline
                </button>
              </>
            )))}
          </ul>
        </>
      )}

      {sent.length > 0 && (
        <>
          <p className="mt-4 text-sm font-medium text-muted">Sent · {sent.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {sent.map((person) => row(person, (
              <button
                onClick={() => cancel(person.username)}
                disabled={pending === person.username}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
              >
                {pending === person.username ? 'Cancelling…' : 'Cancel'}
              </button>
            )))}
          </ul>
        </>
      )}
    </section>
  )
}
