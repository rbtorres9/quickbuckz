import React, {useContext, createContext, useState} from 'react'

export const AuthContext = createContext(null)

/* 
    THIS NEEDS TO BE UPDATED SO THAT ACCESS AND REFRESH TOKENS ARE STORED SECURELY
    THIS IS SIMPLY FOR TESTING PURPOSES AND CONVENIENCE
*/

export const AuthProvider = ({children}) => {
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'))
    const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'))

    const refresh = async () => {
        try {
            const response = await fetch('https://quickbuckz.onrender.com/api/token/refresh/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'refresh': `${refreshToken}`
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw errorData
            }

            const data = await response.json()

            if (Object.hasOwn(data, 'access')) {
                console.log("Set Access Token: ", data.access)
                localStorage.setItem('access_token', data.access)
                setAccessToken((_) => data.access)

                return data.access
            }
        }
        catch (err) {
            console.log(`Refresh Failed: `, err)
            logout()
        }
        
        return null
    }
    const login = (access, refresh) => {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        setAccessToken((_) => access)
        setRefreshToken((_) => refresh)
    }
    const logout = () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setAccessToken((_) => null)
        setRefreshToken((_) => null)
    }

    const fetchWithToken = async (url, options = {}, access=null) => {
        try {
            let response = await fetch(`https://quickbuckz.onrender.com${url}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${access ?? accessToken}`
                }
            })

            // If the token is invalid, refresh it and try again
            if (response.status === 401) {
                const newToken = await refresh()
                if (newToken) {
                    response = await fetch(`https://quickbuckz.onrender.com${url}`, {
                        ...options,
                        headers: {
                            ...options.headers,
                            'Authorization': `Bearer ${newToken}`
                        }
                    })
                }
            }

            if (!response.ok) {
                throw await response.json()
            }

            const data = await response.json()

            return data
        }
        catch (err) {
            let errorJson = {
                "error": err
            }

            console.error(`Error in fetchWithToken:`, err)

            return  errorJson
        }
    }

    return (
    <AuthContext.Provider value={{ accessToken, login, logout, refresh, fetchWithToken }}>
        { children }
    </AuthContext.Provider>
    )
}

export const useAuthContext = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error("useAuthContext must be used within a AuthProvider")
    }
    return context
}