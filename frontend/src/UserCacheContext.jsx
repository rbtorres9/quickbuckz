import React, {useContext, createContext, useState} from 'react'

export const UserCacheContext = createContext(null)

export const UserCacheProvider = ({children}) => {
    const [ user, setUser ] = useState(() => localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null)
    
    const refreshUserCache = async (accessToken) => {
        try {
            const response = await fetch('https://quickbuckz.onrender.com/api/profile/me', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            if (!response.ok) {
                throw await response.json()
            }

            const data = await response.json()

            localStorage.setItem('user', JSON.stringify(data))

            console.log("User cache refreshed:", data)
        }
        catch (err) {
            console.log(`Failed to refresh user cache:`, err)
        }
    }

    return (
        <UserCacheContext.Provider value={{ user, refreshUserCache }}>
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