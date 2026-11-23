import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getTimeAgoString, getDateTimeString } from '../utils/DateTimeUtils.js'

// Mod tools > Mod log: every moderation action, newest first (GET /api/mod-log/)

// each tab sends one or more ModerationLog actions to the backend (?action=a,b)
const ACTION_FILTERS = [
  { value: 'all', label: 'All', actions: '' },
  { value: 'removals', label: 'Removals', actions: 'remove_post,remove_comment,remove_in_profile' },
  { value: 'dismissals', label: 'Dismissals', actions: 'dismiss' },
  { value: 'bans', label: 'Deactivations', actions: 'deactivate,reactivate' },
  { value: 'deleted', label: 'Deleted by user', actions: 'content_deleted' },
]

const ACTION_STYLES = {
  remove_post: 'bg-red-500/15 text-red-300',
  remove_comment: 'bg-red-500/15 text-red-300',
  remove_in_profile: 'bg-red-500/15 text-red-300',
  deactivate: 'bg-red-500/15 text-red-300',
  reactivate: 'bg-accent/15 text-accent',
  dismiss: 'bg-white/10 text-muted',
  content_deleted: 'bg-white/10 text-muted',
}

// the post still existed after these actions, so "View post" can work
const POST_STILL_EXISTS = ['dismiss', 'remove_comment']

// "@mod", "Admin", "System", or "Author" for content the owner deleted
function whoDidIt(entry) {
  if (entry.source === 'admin') return 'Admin'
  if (entry.moderator) return `@${entry.moderator}`
  return entry.source === 'system' ? 'System' : 'User'
}

// lowercase + drop a leading @, same as the backend does
const cleanUsername = (value) => value.trim().replace(/^@/, '').toLowerCase()


export default function ModLog({ onOpen }) {
  const { fetchWithToken } = useAuthContext()

  const [entries, setEntries] = useState(null) // null = still loading
  const [count, setCount] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  const [actionFilter, setActionFilter] = useState('all')
  const [moderatorInput, setModeratorInput] = useState('')
  const [targetInput, setTargetInput] = useState('')
  const [search, setSearch] = useState({ moderator: '', target: '' }) // applied on Search, not on every keystroke

  function buildQuery(pageNum) {
    const params = new URLSearchParams({ page: pageNum })
    const actions = ACTION_FILTERS.find((f) => f.value === actionFilter)?.actions
    if (actions) params.set('action', actions)
    if (search.moderator) params.set('moderator', search.moderator)
    if (search.target) params.set('target', search.target)
    return params
  }

  async function fetchPage(pageNum) {
    const result = await fetchWithToken(`/api/mod-log/?${buildQuery(pageNum)}`)
    if (result.isError) return { error: result.result }
    return { data: result.result }
  }

  // first page: reloads whenever a filter changes
  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)
    fetchPage(1).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setError(errorMessage(error))
        setEntries([])
        setHasMore(false)
        return
      }
      setEntries(data.results ?? [])
      setCount(data.count ?? 0)
      setHasMore(Boolean(data.next))
      setPage(1)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, search])

  async function loadMore() {
    const nextPage = page + 1
    setLoadingMore(true)
    const { data, error } = await fetchPage(nextPage)
    setLoadingMore(false)
    if (error) return setError(errorMessage(error))
    setError(null)
    setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.id))
      return [...prev, ...(data.results ?? []).filter((e) => !seen.has(e.id))]
    })
    setHasMore(Boolean(data.next))
    setPage(nextPage)
  }

  function applySearch(e) {
    e.preventDefault()
    setSearch({ moderator: cleanUsername(moderatorInput), target: cleanUsername(targetInput) })
  }

  function clearSearch() {
    setModeratorInput('')
    setTargetInput('')
    setSearch({ moderator: '', target: '' })
  }

  const searching = Boolean(search.moderator || search.target)
  const inputClass = 'w-full rounded-lg border border-line bg-field px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none'

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mod log</h1>
        {count !== null && entries !== null && (
          <span className="text-sm text-muted">{count} {count === 1 ? 'entry' : 'entries'}</span>
        )}
      </div>

      {/* action tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActionFilter(f.value)}
            disabled={loadingMore}
            className={`rounded-full px-3 py-1 text-sm font-semibold disabled:opacity-50 ${
              actionFilter === f.value ? 'bg-accent text-page' : 'border border-line hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* moderator / target search */}
      <form onSubmit={applySearch} className="mt-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <input
          value={moderatorInput}
          onChange={(e) => setModeratorInput(e.target.value)}
          placeholder="Moderator username"
          aria-label="Filter by moderator"
          className={inputClass}
        />
        <input
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          placeholder="Target username"
          aria-label="Filter by target user"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loadingMore}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
        >
          Search
        </button>
        {searching && (
          <button type="button" onClick={clearSearch} className="text-sm text-muted hover:text-accent">
            Clear
          </button>
        )}
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {entries === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        !error && (
          <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
            <p className="font-medium">Nothing logged</p>
            <p className="mt-1 text-sm text-muted">
              {searching || actionFilter !== 'all' ? 'No entries match these filters.' : 'No moderation actions yet.'}
            </p>
          </div>
        )
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-line bg-card px-5 py-4">
                {/* row 1 = action + who did it + when */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_STYLES[entry.action] ?? 'bg-white/10 text-muted'}`}>
                    {entry.action_label}
                  </span>
                  <span className="text-muted">by</span>
                  <span className="font-semibold">{whoDidIt(entry)}</span>
                  <span className="ml-auto text-xs text-muted" title={getDateTimeString(entry.created_at)}>
                    {getTimeAgoString(entry.created_at)} ago
                  </span>
                </div>

                {/* row 2 = target user + report count */}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {entry.target_author ? (
                    <>
                      on
                      <Link to={`/user/${entry.target_author}`} className="font-semibold text-inherit hover:underline">
                        @{entry.target_author}
                      </Link>
                      <button
                        type="button"
                        onClick={() => onOpen(entry.target_author)}
                        className="underline underline-offset-4 hover:text-accent"
                      >
                        Account status
                      </button>
                    </>
                  ) : (
                    <span>on a deleted account</span>
                  )}
                  {entry.via_reports && (
                    <span>· closed {entry.reports_closed} {entry.reports_closed === 1 ? 'report' : 'reports'}</span>
                  )}
                  {entry.source === 'admin' && <span>· admin site</span>}
                </p>

                {/* saved copy of the content / reason */}
                {entry.target_content && (
                  <div className="mt-3 whitespace-pre-line break-words rounded-lg border border-line bg-field px-4 py-3 text-sm leading-relaxed">
                    {entry.target_content}
                  </div>
                )}

                {entry.post_ref && POST_STILL_EXISTS.includes(entry.action) && (
                  <div className="mt-3 flex">
                    <Link
                      to={`/post/${entry.post_ref}`}
                      className="ml-auto text-sm text-muted hover:text-accent hover:underline underline-offset-4"
                    >
                      View post
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-5 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}