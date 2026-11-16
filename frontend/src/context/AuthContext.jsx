import React, { useContext, createContext, useMemo, useState } from 'react'

import { useApiContext } from './ApiContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import ApiResult from '../utils/ApiResult'

export const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const readLoggedIn = () => localStorage.getItem('loggedIn') === 'true'
    const [loggedIn, setLoggedInState] = useState(readLoggedIn)

    const setLoggedIn = (value) => {
        const next = Boolean(value)
        setLoggedInState(next)
        if (next) {
            localStorage.setItem('loggedIn', 'true')
        } else {
            localStorage.removeItem('loggedIn')
        }
    }

    const { fetchBaseUrl } = useApiContext()

    const refresh = async () => {
        try {
            const result = await fetchBaseUrl('/api/token/refresh/', {
                method: 'POST',
            })

            if (result.isError) {
                throw result
            }

            setLoggedIn(true)
            return true
        }
        catch (err) {
            const failed = new ApiResult(
                err?.result ?? 'Refresh request failed',
                err?.response
            )

            console.error('Error refreshing token:', errorMessage(failed.result))
            await logout()
            return null
        }
    }

    const login = () => {
        setLoggedIn(true)
    }

    const logout = async () => {
        try {
            await fetchBaseUrl('/api/token/clear/', {
                method: 'POST',
            })
        }
        catch (err) {
            console.warn('Logout request failed:', err)
        }

        setLoggedIn(false)
    }

    const fetchWithToken = async (url, options = {}) => {
        try {
            let result = await fetchBaseUrl(url, options)

            if (result.response?.status === 401) {
                const refreshSuccessful = await refresh()
                if (refreshSuccessful) {
                    result = await fetchBaseUrl(url, options)
                }
            }

            if (result.isError) {
                throw result
            }

            return result
        }
        catch (err) {
            const result = new ApiResult(
                err?.result ?? err ?? `Failed to fetch ${url}`,
                err?.response
            )

            console.error('Error fetching with cookie auth:', errorMessage(result.result))

            if (err?.response?.status === 401) {
                await logout()
            }

            return result
        }
    }

    const fetchPosts = async () => fetchWithToken('/api/posts/')
    const fetchUserProfile = async (username) => fetchWithToken(`/api/profile/${username}/`)
    const fetchUserPosts = async (username) => fetchWithToken(`/api/profile/${username}/posts/`)
    const fetchPostById = async (id) => fetchWithToken(`/api/posts/${id}/`)

    const value = useMemo(() => ({
        login,
        logout,
        loggedIn,
        refresh,
        fetchWithToken,
        fetchPosts,
        fetchUserProfile,
        fetchUserPosts,
        fetchPostById,
    }), [loggedIn])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuthContext = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider')
    }
    return context
}