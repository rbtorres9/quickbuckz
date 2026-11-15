import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { useIsMod } from '../utils/useIsMod.js'
import RestrictionHistory from '../components/RestrictionHistory.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

// /mod/<username>/status: one account's status and ban history, with Ban / Reactivate.
// Mods and admins only (the backend checks every request too).
export default function ModUserStatus() {
  const isMod = useIsMod()
  const { username } = useParams()
  usePageTitle(`@${username} status`)
  const navigate = useNavigate()
  const location = useLocation()

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

  // came from inside the app -> go back there; opened directly (new tab, bookmark) -> mod tools
  const goBack = () => (location.key === 'default' ? navigate('/mod') : navigate(-1))

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <RestrictionHistory username={username} onBack={goBack} backLabel="Back" />
    </main>
  )
}
