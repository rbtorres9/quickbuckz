import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useIsMod } from '../utils/useIsMod.js'
import { errorMessage } from '../utils/errorMessage.js'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'


// Mod tools: reported posts, with Remove post or Dismiss.
// Only for moderators/admins (the backend decides). Roles are set in the Django admin site.

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'comment', label: 'Comments' },
]

// One card per reported post or comment, even if several people reported it
function groupReports(reports) {
  const groups = {}
  for (const report of reports) {
    const key = report.type === 'comment' ? `comment-${report.comment.id}` : `post-${report.post.id}`
    if (!groups[key]) {
      groups[key] = { key, type: report.type, post: report.post, comment: report.comment, reports: [] }
    }
    groups[key].reports.push(report)
  }
  return Object.values(groups)
}


export default function ModTools() { 
  const isMod = useIsMod()
  const { fetchWithToken } = useAuthContext()

  const [reports, setReports] = useState(null) // null = still loading
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null) // report id being handled
  const [message, setMessage] = useState(null)

  async function loadReports() {
    const query = filter === 'all' ? '' : `?type=${filter}`
    const result = await fetchWithToken(`/api/reports/${query}`)
    if (result.isError) {
      setMessage({ text: errorMessage(result.result), ok: false })
      setReports([])
      return
    }
    const data = result.result
    setReports(Array.isArray(data) ? data : data?.results ?? [])
  }

  useEffect(() => {
    if (isMod) loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMod, filter])

  const groups = useMemo(() => groupReports(reports ?? []), [reports])  


  if (isMod === null) return null // still checking; avoids flashing "Moderators only"

  if (!isMod) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Moderators only</h1>
        <p className="mt-2 text-sm text-muted">Your account doesn't have moderator access.</p>
        <Link to="/home" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Back to Home</Link>
      </main>
    )
  }

  async function removeContent(group) {
    const isComment = group.type === 'comment'
    const target = isComment ? group.comment : group.post
    if (!confirm(`Remove @${target.author}'s ${group.type}? This can't be undone.`)) return

    const url = isComment
      ? `/api/posts/${group.post.id}/comment/?comment_id=${group.comment.id}`
      : `/api/posts/${group.post.id}/`

    setBusy(group.key)
    setMessage(null)
    const result = await fetchWithToken(url, { method: 'DELETE' })
    setBusy(null)
    if (result.isError) return setMessage({ text: errorMessage(result.result), ok: false })

    setMessage({ text: isComment ? 'Comment removed.' : 'Post removed.', ok: true })
    loadReports() // deleting a post also clears reports on its comments
  }

  async function dismiss(group) {
    setBusy(group.key)
    setMessage(null)
    const result = await fetchWithToken(`/api/reports/${group.reports[0].id}/dismiss/`, { method: 'POST' })
    setBusy(null)
    if (result.isError) return setMessage({ text: errorMessage(result.result), ok: false })

    setMessage({ text: 'Report dismissed.', ok: true })
    loadReports()
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mod tools</h1>
        {reports && (
          <span className="text-sm text-muted">{groups.length} open {groups.length === 1 ? 'item' : 'items'}</span>
        )}
      </div>

      {/* filter tabs */}
      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setReports(null) }}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              filter === f.value ? 'bg-accent text-white' : 'border border-line hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {message && <p className={`mt-3 text-sm ${message.ok ? 'text-accent' : 'text-red-400'}`}>{message.text}</p>}

      {reports === null ? (
        <p className="mt-6 text-sm text-muted">Loading reports…</p>
      ) : groups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">All clear</p>
          <p className="mt-1 text-sm text-muted">Nothing reported right now.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {/* report cards) */}
          {groups.map((group) => {
            const isComment = group.type === 'comment'
            const target = isComment ? group.comment : group.post
            const reasons = [...new Set(group.reports.map((r) => r.reason))]
            const reporters = group.reports.map((r) => `@${r.reporter}`).join(', ')

            return (
              <li key={group.key} className="rounded-2xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.type}
                    </span>
                    {reasons.map((reason) => (
                      <span key={reason} className="rounded bg-red-500/15 px-2 py-0.5 font-semibold text-red-300">{reason}</span>
                    ))}
                  </p>
                  <Link to={`/user/${target.author}`} className="font-semibold hover:underline">@{target.author}</Link>
                </div>

                <p className="mt-1 text-xs text-muted">
                  reported by {reporters} · {getTimeAgoString(group.reports[0].created_at)} ago
                </p>

                {isComment && (
                  <p className="mt-3 truncate text-xs text-muted">
                    On @{group.post.author}'s post: "{group.post.content}"
                  </p>
                )}

                <div className="mt-3 rounded-lg border border-line bg-field px-4 py-3 text-sm leading-relaxed">
                  {target.content || <span className="text-muted">(photo only)</span>}
                  {!isComment && group.post.image && (
                    <img src={group.post.image} alt="" className="mt-3 max-h-48 rounded-lg object-cover" />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => removeContent(group)}
                    disabled={busy === group.key}
                    className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Remove {group.type}
                  </button>
                  <button
                    onClick={() => dismiss(group)}
                    disabled={busy === group.key}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <Link to={`/post/${group.post.id}`} className="ml-auto self-center text-sm text-muted hover:text-accent">
                    View post
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}