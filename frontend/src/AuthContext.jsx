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

    return (
    <AuthContext.Provider value={{ accessToken, login, logout, refresh }}>
        { children }
    </AuthContext.Provider>
    )
}