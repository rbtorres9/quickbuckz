import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useIsMod } from '../utils/useIsMod.js'
import { errorMessage } from '../utils/errorMessage.js'
import { getTimeAgoString, getDateTimeString} from '../utils/DateTimeUtils.js'
import ModRestrictions from '../components/ModRestrictions.jsx'




// Mod tools: reported posts, with Remove post or Dismiss.
// Only for moderators/admins (the backend decides). Roles are set in the Django admin site.

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'comment', label: 'Comments' },
  { value: 'profile', label: 'Profiles' },
]

const SECTIONS = [
  { value: 'reports', label: 'Reports' },
  { value: 'restrictions', label: 'Ban list' },
]

// One card per reported post or comment, even if several people reported it
function groupReports(reports) {
  const groups = {}
  for (const report of reports) {
      const key = 
      report.type === 'comment' && report.comment ? `comment-${report.comment.id}`
      : report.type === 'post' && report.post ? `post-${report.post.id}`
      : report.type === 'profile' ? `profile-${report.target_author}`
      : `report-${report.id}`
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
  const [statusFilter, setStatusFilter] = useState('open')
  const [openCount, setOpenCount] = useState(null) // null = not loaded yet
  const [busy, setBusy] = useState(null) // report id being handled
  const [message, setMessage] = useState(null)
  const [section, setSection] = useState('reports')

  const navigate = useNavigate()

  async function fetchReports(status, type = filter) {
    const params = new URLSearchParams({ status })
    if (type !== 'all') params.set('type', type)
    const result = await fetchWithToken(`/api/reports/?${params}`)
    if (result.isError) return { error: result.result }
    const data = result.result
    return { list: Array.isArray(data) ? data : data?.results ?? [] }
  }

  async function loadReports() {
    const { list, error } = await fetchReports(statusFilter)
    if (error) {
      setMessage({ text: errorMessage(error), ok: false })
      setReports([])
      return
    }
    setReports(list)

    if (statusFilter === 'open' && filter === 'all') {
      setOpenCount(groupReports(list).length)
    } else {
      const open = await fetchReports('open', 'all')
      if (open.list) setOpenCount(groupReports(open.list).length)
    }
  }

  useEffect(() => {
    if (isMod) loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMod, filter, statusFilter])

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

   // switch between open / reviewed =====
  async function dismiss(group) {
    setBusy(group.key)
    setMessage(null)
    const result = await fetchWithToken(`/api/reports/${group.reports[0].id}/dismiss/`, { method: 'POST' })
    setBusy(null)
    if (result.isError) return setMessage({ text: errorMessage(result.result), ok: false })

    setMessage({ text: 'Report dismissed.', ok: true })
    loadReports()
  }

  function showStatus(value) {
    if (value === statusFilter) return
    setStatusFilter(value)
    setReports(null)
  }

  function openStatus(username) {
    navigate(`/mod/${username}/status`)
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:flex md:gap-8">
      <nav className="mb-5 flex gap-2 md:mb-0 md:w-48 md:shrink-0 md:flex-col md:gap-1">
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSection(s.value)}
            aria-current={section === s.value ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${
              section === s.value ? 'bg-white/10 text-accent' : 'text-muted hover:bg-white/5'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
      {section === 'restrictions' ? (
        <ModRestrictions onOpen={openStatus} />
      ) : (<>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mod tools</h1>
        <div className="flex items-baseline gap-3">
          <button
            onClick={() => showStatus('open')}
            aria-pressed={statusFilter === 'open'}
            className={`text-sm text-muted hover:text-accent ${statusFilter === 'open' ? 'underline underline-offset-4' : ''}`}
          >
            {openCount !== null
              ? `${openCount} active ${openCount === 1 ? 'report' : 'reports'}`
              : 'active reports'}
          </button>
          <button
            onClick={() => showStatus('closed')}
            aria-pressed={statusFilter === 'closed'}
            className={`text-sm text-muted hover:text-accent ${statusFilter === 'closed' ? 'underline underline-offset-4' : ''}`}
          >
            Show reviewed reports
          </button>
        </div>
      </div>

      {/* filter tabs */}
      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setReports(null) }}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              filter === f.value ? 'bg-accent font-semibold text-page' : 'border border-line hover:bg-white/5'
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
          <p className="mt-1 text-sm text-muted">{statusFilter === 'open' ? 'Nothing reported right now.' : 'No reviewed reports yet.'}</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {/* report cards) */}
          {groups.map((group) => {
            const isComment = group.type === 'comment'
            const target = (isComment ? group.comment : group.post)
              ?? { author: group.reports[0].target_author, content: group.reports[0].target_content }
            const canRemove = Boolean(group.post) && (!isComment || Boolean(group.comment))
            const reasons = [...new Set(group.reports.map((r) => r.reason))]
            const reporters = group.reports.map((r) => `@${r.reporter}`).join(', ')
            const reviewed = group.reports.find((r) => r.reviewed_at)
            const canReview = group.reports.every((r) => r.can_review)


            return (
              <li key={group.key} className="rounded-2xl border border-line bg-card p-5">
                {/* row 1 = type + reported user */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.type}
                  </span> of
                  <Link to={`/user/${target.author}`} className="font-semibold hover:underline">@{target.author}</Link>
                  {/* inline account status link */}
                  {target.author && (
                    <button
                      type="button"
                      onClick={() => openStatus(target.author)}
                      className="text-sm text-muted underline underline-offset-4 hover:text-accent"
                    >
                      Account status
                    </button>
                  )}
                </div>

                {/* row 2 = reporters + time (unchanged) */}
                <p className="mt-1 text-xs text-muted">
                  reported by {reporters} · {getTimeAgoString(group.reports[0].created_at)} ago
                </p>

                {/* row 3 = reason(s) */}
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-muted">Reason:</span>
                  {reasons.map((reason) => (
                    <span key={reason} className="rounded bg-red-500/15 px-2 py-0.5 font-semibold text-red-300">{reason}</span>
                  ))}
                </p>

                {isComment && group.post && (
                  <p className="mt-3 truncate text-xs text-muted">
                    On @{group.post.author}'s post: "{group.post.content}"
                  </p>
                )}

                <div className="mt-3 rounded-lg border border-line bg-field px-4 py-3 text-sm leading-relaxed">
                  {target.content || <span className="text-muted">(photo only)</span>}
                  {!isComment && group.post?.image && (
                    <img src={group.post.image} alt="" className="mt-3 max-h-48 rounded-lg object-cover" />
                  )}
                </div>

                {reviewed && (
                  <div>
                    <p className="mt-3 text-xs text-muted">
                      Reviewed at {getDateTimeString(reviewed.reviewed_at)}
                      {reviewed.reviewed_by && <> by {reviewed.reviewed_source === 'admin' ? 'Admin' : `@${reviewed.reviewed_by}`}</>}
                    </p>
                    <p className="mt-3 text-xs text-muted">
                      {reviewed.outcome && <> Action Taken: {reviewed.outcome}</>}
                    </p>
                  </div>
                )}



                <div className="mt-4 flex flex-wrap gap-3">
                  {reviewed ? null : canReview ? (
                    <>
                    {group.type === 'profile' && (
                      <p className="w-full text-sm text-muted">
                        Click Account status or View Profile to take action.
                      </p>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => removeContent(group)}
                        disabled={busy === group.key}
                        className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Remove {group.type}
                      </button>
                    )}
                      <button
                        onClick={() => dismiss(group)}
                        disabled={busy === group.key}
                        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <p className="self-center text-sm text-muted">
                      This is your {group.type}. Another moderator has to review it.
                    </p>
                  )}
                  {reviewed ? (
                    <div className="ml-auto flex items-center gap-4">
                      {group.post && (
                        <Link 
                          to={`/post/${group.post.id}`} 
                          className="self-center text-sm text-muted hover:text-accent hover:underline underline-offset-4" 
                        >
                          View post
                        </Link>
                      )}
                    </div>
                  ) : group.post ? (
                    <Link 
                      to={`/post/${group.post.id}`} 
                      className="ml-auto self-center text-sm text-muted hover:text-accent hover:underline underline-offset-4"
                    >
                      View post
                    </Link>
                  ) : (
                    <Link 
                        to={`/user/${target.author}`} 
                      className="ml-auto self-center text-sm text-muted hover:text-accent hover:underline underline-offset-4"
                    >
                      View profile
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      </>)}
      </div>
    </main>
  )
}