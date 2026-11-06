import { useEffect, useState } from 'react'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'

// Asks the backend once per account if you're a moderator (or admin): GET /api/users/me/role/
// Every post card uses this, so the answer is shared instead of asking again for each one.
const checks = {}

// Returns null while checking, then true or false.
// Any error counts as "not a mod", so it fails closed.
// This only decides which buttons to show; the backend still checks every delete.
export function useIsMod() {
  const { fetchWithToken } = useAuthContext()
  const { userCache } = useCache()
  const username = userCache?.username
  const [isMod, setIsMod] = useState(null)

  useEffect(() => {
    if (!username) return
    checks[username] ??= fetchWithToken('/api/users/me/role/').then((result) => !result.isError)
    checks[username].then(setIsMod)
  }, [username])

  return isMod
}
