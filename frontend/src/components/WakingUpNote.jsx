import { useEffect, useState } from 'react'

// Shown under a loading message when loading takes a while.
// The backend is on Render's free plan, which goes to sleep when nobody uses it,
// so the first request after a break can take up to a minute.
export default function WakingUpNote({ after = 4000 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), after)
    return () => clearTimeout(timer)
  }, [after])

  if (!show) return null
  return (
    <p className="mt-3 text-center text-xs text-muted" role="status">
      Waking up the server… after a break this can take up to a minute.
    </p>
  )
}
