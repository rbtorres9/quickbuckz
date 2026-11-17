import React, {createContext, useContext, useMemo, useState} from 'react'
import ApiResult from '../utils/ApiResult'
import { API_URL } from '../config.js'
import { errorMessage } from '../utils/errorMessage.js'

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

        // /api/reports/?type=post becomes ?type=post/, so the type filter matches nothing.
        // /api/posts/12/comment/?comment_id=7 becomes ?comment_id=7/, so deleting a comment fails. 
        // This affects comment deletes everywhere in the app, not just on the mod page.
        // v only add the slash to the path, not the query string v
        const queryStart = resolvedSuffix.indexOf('?')
        let path = queryStart === -1 ? resolvedSuffix : resolvedSuffix.slice(0, queryStart)
        const query = queryStart === -1 ? '' : resolvedSuffix.slice(queryStart)

        if (!path.endsWith('/')) {
            path += '/'
        }
        resolvedSuffix = path + query

        const url = `${baseUrl}${resolvedSuffix}`

        try {
            setFetching(true)

            const csrf = document.cookie
                .split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1];

            const response = await fetch(url, {
                ...options,
                credentials: 'include',
                headers: {
                    ...options.headers,
                    'X-CSRFToken': csrf
                },
            })

            const contentType = response.headers.get('content-type') || ''
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text()

            if (!response.ok) {
                throw {
                    result: data,
                    response: response
                }
            }

            return new ApiResult(data, response)
        }
        catch (err) {
            let result = new ApiResult(
                err?.result ?? err ?? "Request failed",
                err?.response
            )

            console.error(`Error fetching ${url}:`, errorMessage(result.result))
            return result
        }
        finally {
            setFetching(false)
        }
    }

    const fetchPosts = async () => {
        return fetchBaseUrl('/api/posts/')
    }

    const fetchUserProfile = async (username) => {
        return fetchBaseUrl(`/api/profile/${username}/`)
    }

    const fetchUserPosts = async (username) => {
        return fetchBaseUrl(`/api/profile/${username}/posts/`)
    }

    const fetchPostById = async (id) => {
        return fetchBaseUrl(`/api/posts/${id}/`)
    }

    const value = useMemo(() => ({
        baseUrl,
        fetching,
        fetchBaseUrl,
        fetchPosts,
        fetchUserProfile,
        fetchUserPosts,
        fetchPostById,
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