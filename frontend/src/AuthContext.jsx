import React, {useContext, createContext, useState} from 'react'

export const AuthContext = createContext(null)

export const AuthProvider = ({children}) => {
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'))    
    const login = (token) => {
        localStorage.setItem('access_token', token)
        setAccessToken(token)
    }
    const logout = () => {
        localStorage.removeItem('access_token')
        setAccessToken(null)
    }
        return (
        <AuthContext.Provider value={{ accessToken, login, logout}}>
            { children }
        </AuthContext.Provider>
    )
}