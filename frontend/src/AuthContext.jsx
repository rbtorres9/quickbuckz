import React, {useContext, createContext, useState} from 'react'

export const AuthContext = createContext(null)

export const AuthProvider = ({children}) => {
    const [accessToken, setAccessToken] = useState(null)
    const login = (token) => setAccessToken(token)
    const logout = () => setAccessToken(null)

    return (
        <AuthContext.Provider value={{ accessToken, login, logout}}>
            { children }
        </AuthContext.Provider>
    )
}