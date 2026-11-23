import { createContext, useContext, useEffect, useState } from 'react'
import { useCache } from '../context/CacheContext.jsx'
import { themeVars } from './themes.js'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const { userCache } = useCache()

  // Your theme colors the whole site for you, and your profile for everyone.
  // A copy is kept in localStorage so the right color shows before the profile loads.
  const [siteTheme, setSiteTheme] = useState(() => localStorage.getItem('siteTheme') || 'classic')
  useEffect(() => {
    localStorage.setItem('siteTheme', siteTheme)
    for (const [name, value] of Object.entries(themeVars(siteTheme))) {
      document.documentElement.style.setProperty(name, value)
    }
  }, [siteTheme])

  // Follow the saved theme. Signed out (no userCache) goes back to the default.
  useEffect(() => {
    setSiteTheme(userCache?.theme ?? 'classic')
  }, [userCache?.theme])

  return (
    <StoreContext.Provider value={{ siteTheme, setSiteTheme }}>
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)