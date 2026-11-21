import { createContext, useContext, useEffect, useState } from 'react'
import { useCache } from '../context/CacheContext.jsx'
import { themeVars } from './themes.js'

// The site theme (Settings). Saved to your profile on the backend; also kept in this browser
// so the right colors show before your profile loads.
// Everything else (posts, follows, notifications, profiles, reports) comes from the backend.

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const { userCache } = useCache()

  // How the site looks to you (Settings). Recolors the whole site. Remembered on this device.
  const [siteTheme, setSiteTheme] = useState(() => localStorage.getItem('siteTheme') || 'classic')
  useEffect(() => {
    localStorage.setItem('siteTheme', siteTheme)
    for (const [name, value] of Object.entries(themeVars(siteTheme))) {
      document.documentElement.style.setProperty(name, value)
    }
  }, [siteTheme])

  useEffect(() => {
    if (userCache?.site_theme)
      setSiteTheme(userCache.site_theme)

  }, [userCache])

  return (
    <StoreContext.Provider value={{ siteTheme, setSiteTheme }}>
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
