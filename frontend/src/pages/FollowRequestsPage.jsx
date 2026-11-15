import { Link } from 'react-router-dom'
import FollowRequests from '../components/FollowRequests.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

// Follow requests sent to you (Accept / Decline) and by you (Cancel)
export default function FollowRequestsPage() {
  usePageTitle('Follow requests')
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Follow requests</h1>
        <Link to="/subscriptions" className="text-sm font-semibold text-accent hover:underline">
          Back to Following
        </Link>
      </div>
      <FollowRequests />
    </main>
  )
}
