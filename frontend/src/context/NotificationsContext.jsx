import { createContext, useContext, useEffect, useState } from 'react'
import { useAuthContext } from './AuthContext.jsx'

// How often to re-check the unread count while the tab is open
const POLL_MS = 60 * 1000

export const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { accessToken, fetchWithToken } = useAuthContext()
  const [unread, setUnread] = useState(0)

  const refreshUnread = async () => {
    if (!localStorage.getItem('access_token')) return
    const data = await fetchWithToken('/api/notifications/unread-count/')
    // fetchWithToken returns { error } on failure; keep the old count in that case
    if (data && typeof data.unread === 'number') setUnread(data.unread)
  }

  useEffect(() => {
    if (!accessToken) {
      setUnread(0)
      return
    }

    refreshUnread()

    // Skip checks while the tab is in the background, and catch up when it comes back
    const timer = setInterval(() => {
      if (!document.hidden) refreshUnread()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) refreshUnread()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [accessToken])

  return (
    <NotificationsContext.Provider value={{ unread, refreshUnread }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}