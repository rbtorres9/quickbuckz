import React, {useContext, createContext, useState, useEffect} from 'react'
import { useAuthContext } from './AuthContext.jsx'

export const UserCacheContext = createContext(null)

export const UserCacheProvider = ({children}) => {
    const [ user, setUser ] = useState(() => localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null)

    const { fetchWithToken, accessToken } = useAuthContext()
    
    const refreshUserCache = async (access=null) => {
        if (!access) {
            access = accessToken
        }

        const data = await fetchWithToken('/api/profile/me/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        }, access)

        // fetchWithToken returns { error } on failure; keep the old cache in that case
        if (!data || data.error) return

        localStorage.setItem("user", JSON.stringify(data))
        setUser(data)

        console.log("User cache refreshed:", data)
    }

    // Image URLs in the profile are signed and expire after an hour,
    // so re-fetch the profile on app load instead of trusting the stored copy
    
    useEffect(() => {
        if (accessToken) { 
                refreshUserCache()
        } else {
            localStorage.removeItem('user')
            setUser(null)
        }
    }, [accessToken]) 

    return (
        <UserCacheContext.Provider value={{ user, setUser, refreshUserCache }}>
            { children }
        </UserCacheContext.Provider>
    )
}

export const useUserCache = () => {
    const context = useContext(UserCacheContext)
    if (!context) {
        throw new Error("useUserCache must be used within a UserCacheProvider")
    }
    return context
}