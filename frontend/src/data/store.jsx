import { createContext, useContext, useEffect, useState } from 'react'
import { useCache } from '../context/CacheContext.jsx'
import { themeVars } from './themes.js'

// Settings the backend doesn't store yet, kept in this browser for now.
// TODO: move both to the backend once it has a theme field.
// Everything else (posts, follows, notifications, profiles, reports) comes from the backend.

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  // Your profile theme (picked in Create account / Edit profile). Remembered on this device.
  const [profile, setProfile] = useState({ theme: localStorage.getItem('profileTheme') || 'classic' })
  const { userCache } = useCache()

  const updateProfile = (changes) => {
    if (changes.theme) localStorage.setItem('profileTheme', changes.theme)
    setProfile((current) => ({ ...current, ...changes }))
  }

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
    <StoreContext.Provider value={{ profile, updateProfile, siteTheme, setSiteTheme }}>
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
