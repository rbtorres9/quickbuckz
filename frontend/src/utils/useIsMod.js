import { useEffect, useState } from 'react'
import { useAuthContext } from '../context/AuthContext.jsx'

// Asks the backend if you're a moderator (or admin): GET /api/users/me/role/
// Returns null while checking, then true or false.
// Any error counts as "not a mod", so it fails closed.
export function useIsMod() {
  const { fetchWithToken } = useAuthContext()
  const [isMod, setIsMod] = useState(null)

  useEffect(() => {
    fetchWithToken('/api/users/me/role/').then((result) => setIsMod(!result.isError))
  }, [])

  return isMod
}
