import React, {useContext, createContext, useState} from 'react'

// easy api url reference
import { useApiContext } from './ApiContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import ApiResult from '../utils/ApiResult'

export const AuthContext = createContext(null)

export const AuthProvider = ({children}) => {
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'))
    const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token')) // might be unused state

    const { fetchBaseUrl } = useApiContext()

    const refresh = async () => {
        try {
            const stored = localStorage.getItem('refresh_token')
            if (!stored) { logout(); return null}

            const result = await fetchBaseUrl(`/api/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'refresh': stored
                })
            })

            if (result.isError) {
                throw result
            }

            const newAccess = result.result?.access
            if (newAccess) {
                localStorage.setItem('access_token', newAccess)
                setAccessToken(newAccess)

                const newRefresh = result.result?.refresh
                if (newRefresh) {
                    localStorage.setItem('refresh_token', newRefresh)
                    setRefreshToken(newRefresh)
                }

                return newAccess
            }

            logout()
            return null
        }
        catch (err) {
            const failed = new ApiResult(
                err?.result ?? "Refresh request failed",
                err?.response
            )

            console.error(`Error refreshing token:`, errorMessage(failed.result))
            logout()
        }
        
        return null
    }
    const login = (access, refresh) => {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        setAccessToken((_) => access)
        setRefreshToken((_) => refresh) // might be unused state
    }
    const logout = () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setAccessToken((_) => null)
        setRefreshToken((_) => null) //  might be unused state
    }

    const fetchWithToken = async (url, options = {}) => {
        try {
            const withToken = (token) => ({
                ...options,
                headers: {
                    ...options.headers,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
            })

            let result = await fetchBaseUrl(url, withToken(localStorage.getItem('access_token')))

            if (result.response?.status === 401) {
                const newToken = await refresh()
                if (newToken) {
                    result = await fetchBaseUrl(url, withToken(newToken))
                }
            }

            if (result.isError) {
                throw result
            }

            return result
        }
        catch (err) {
            let result = new ApiResult(
                err?.result ?? err ?? `Failed to fetch ${url}`,
                err?.response
            )

            console.error(`Error fetching with token:`, errorMessage(result.result))

            return result
        }
    }

    const fetchPosts = async () => {
        return fetchWithToken('/api/posts/')
    }

    const fetchUserProfile = async (username) => {
        return fetchWithToken(`/api/profile/${username}/`)
    }

    const fetchUserPosts = async (username) => {
        return fetchWithToken(`/api/profile/${username}/posts/`)
    }

    const fetchPostById = async (id) => {
        return fetchWithToken(`/api/posts/${id}/`)
    }

    return (
    <AuthContext.Provider value={{ accessToken, login, logout, refresh, fetchWithToken, fetchPosts, fetchUserProfile, fetchUserPosts, fetchPostById }}>
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