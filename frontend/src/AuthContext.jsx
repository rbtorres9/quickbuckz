import React, {useContext, createContext, useState} from 'react'

export const AuthContext = createContext(null)

/* 
    THIS NEEDS TO BE UPDATED SO THAT ACCESS AND REFRESH TOKENS ARE STORED SECURELY
    THIS IS SIMPLY FOR TESTING PURPOSES AND CONVENIENCE
*/

export const AuthProvider = ({children}) => {
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'))
    const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'))

    const refresh = async (refresh) => {}
    const login = (access, refresh) => {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        setAccessToken(access)
        setRefreshToken(refresh)
    }
    const logout = () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setAccessToken(null)
        setRefreshToken(null)
    }

    return (
    <AuthContext.Provider value={{ accessToken, login, logout, refresh }}>
        { children }
    </AuthContext.Provider>
    )
}