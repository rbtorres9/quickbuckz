import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'

// Sits beside the Following title. The badge counts requests sent TO you,
// styled like the notification bell's badge in NavBar.jsx.
export default function RequestsLink() {
  const { fetchWithToken } = useAuthContext()
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetchWithToken('/api/profile/me/followers/requests/').then((result) => {
      if (result.isError) return // keep the link usable; just no badge
      const data = result.result
      setCount(data.count ?? (data.results ?? data).length)
    })
  }, [])

  return (
    <Link
      to="/subscriptions/requests"
      className="relative text-sm font-semibold text-accent hover:underline"
      aria-label={count ? `Follow requests, ${count} pending` : 'Follow requests'}
    >
      Requests
      {count > 0 && (
        <span className="absolute -right-4 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-page">
          {/* cap the badge so a large count doesn't stretch it */}
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}