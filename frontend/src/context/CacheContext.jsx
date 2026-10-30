import React, {useContext, createContext, useState, useEffect} from 'react'
import { useAuthContext } from './AuthContext.jsx'

export const CacheContext = createContext(null)

export const CacheProvider = ({children}) => {
    const [ userCache, setUserCache ] = useState(() => localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null)

    const { fetchWithToken, accessToken } = useAuthContext()
    
    const refreshUserCache = async (access=null) => {
        if (!access) {
            access = accessToken
        }

        const result = await fetchWithToken('/api/profile/me/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        }, access)

        // fetchWithToken returns { error } on failure; keep the old cache in that case
        if (result.isError) return

        const data = result.result

        localStorage.setItem("user", JSON.stringify(data))
        setUserCache(data)

        console.log("User cache refreshed:", data)
    }

    // Image URLs in the profile are signed and expire after an hour,
    // so re-fetch the profile on app load instead of trusting the stored copy
    
    useEffect(() => {
        if (accessToken) { 
                refreshUserCache()
        } else {
            localStorage.removeItem('user')
            setUserCache(null)
        }
    }, [accessToken]) 

    return (
        <CacheContext.Provider value={{ userCache, setUserCache, refreshUserCache }}>
            { children }
        </CacheContext.Provider>
    )
}

export const useCache = () => {
    const context = useContext(CacheContext)
    if (!context) {
        throw new Error("useUserCache must be used within a UserCacheProvider")
    }
    return context
}