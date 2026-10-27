import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'

// Mod tools: reported posts, with Remove post or Dismiss.
// Prototype: reports are sample data and mod mode is turned on in Settings.
// TODO: backend needs a moderator role, a Reports table, and permission for mods to delete any post.
export default function ModTools() {
  const { reports, removeReport, deletePost, modMode } = useStore()
  const { fetchWithToken } = useAuthContext()
  const [busy, setBusy] = useState(null) // report id being handled
  const [message, setMessage] = useState('')

  if (!modMode) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Moderators only</h1>
        <p className="mt-2 text-sm text-muted">Turn on mod mode in Settings to see reports.</p>
        <Link to="/user-account" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Go to Settings</Link>
      </main>
    )
  }

  async function removePost(report) {
    if (!confirm(`Remove @${report.author}'s post? This can't be undone.`)) return
    setMessage('')
    if (report.isReal) {
      setBusy(report.id)
      const data = await fetchWithToken(`/api/posts/${report.postId}/`, { method: 'DELETE' })
      setBusy(null)
      // Note: a successful DELETE sends no JSON back, which fetchWithToken reports as an error,
      // so only treat a "permission" answer as a real failure.
      if (data.error && JSON.stringify(data.error).toLowerCase().includes('permission')) {
        return setMessage("The backend doesn't let mods remove other people's posts yet.")
      }
    } else {
      deletePost(report.postId)
    }
    removeReport(report.id)
    setMessage('Post removed.')
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mod tools</h1>
        <span className="text-sm text-muted">{reports.length} open {reports.length === 1 ? 'report' : 'reports'}</span>
      </div>
      {message && <p className={`mt-3 text-sm ${message === 'Post removed.' ? 'text-accent' : 'text-red-400'}`}>{message}</p>}

      {reports.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">All clear</p>
          <p className="mt-1 text-sm text-muted">No reported posts right now.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="rounded-2xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <p>
                  <span className="rounded bg-red-500/15 px-2 py-0.5 font-semibold text-red-300">{report.reason}</span>
                  <span className="ml-2 text-muted">reported by @{report.reportedBy} · {report.time}</span>
                </p>
                <Link to={`/user/${report.author}`} className="font-semibold hover:underline">@{report.author}</Link>
              </div>
              <p className="mt-3 rounded-lg border border-line bg-field px-4 py-3 text-sm leading-relaxed">
                {report.text || <span className="text-muted">(photo only)</span>}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => removePost(report)}
                  disabled={busy === report.id}
                  className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Remove post
                </button>
                <button onClick={() => removeReport(report.id)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5">
                  Dismiss
                </button>
                {report.isReal && (
                  <Link to={`/post/${report.postId}`} className="ml-auto self-center text-sm text-muted hover:text-accent">View post</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
