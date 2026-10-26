import React, {createContext, useContext, useMemo, useState} from 'react'
import ApiResult from '../utils/ApiResult'
import { API_URL } from '../config.js'

export const ApiContext = createContext(null)

export const ApiProvider = ({children}) => {
    const baseUrl = API_URL
    const [fetching, setFetching] = useState(false)

    const fetchBaseUrl = async (suffix = '', options = {}) => {
        if (!suffix) {
            return new ApiResult(null, true)
        }

        let resolvedSuffix = String(suffix)

        if (!resolvedSuffix.startsWith('/')) {
            resolvedSuffix = `/${resolvedSuffix}`
        }

        if (!resolvedSuffix.endsWith('/')) {
            resolvedSuffix += '/'
        }

        const url = `${baseUrl}${resolvedSuffix}`

        try {
            setFetching(true)

            const response = await fetch(url, {
                method: 'GET',
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                }
            })

            const contentType = response.headers.get('content-type') || ''
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text()

            if (!response.ok) {
                throw data ?? { message: 'Request failed' }
            }

            return new ApiResult(data, false)
        }
        catch (err) {
            console.error(`Error fetching ${url}`, err)
            return new ApiResult(err, true)
        }
        finally {
            setFetching(false)
        }
    }

    const fetchPosts = async () => {
        return fetchBaseUrl('/api/posts/')
    }

    const value = useMemo(() => ({
        baseUrl,
        loading: fetching,
        fetchBaseUrl,
        fetchPosts,
    }), [baseUrl, fetching])

    return (
        <ApiContext.Provider value={value}>
            {children}
        </ApiContext.Provider>
    )
}

export const useApiContext = () => {
    const context = useContext(ApiContext)

    if (!context) {
        throw new Error('useApiContext must be used within an ApiProvider')
    }

    return context
}