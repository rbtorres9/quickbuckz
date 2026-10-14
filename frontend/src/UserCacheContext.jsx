import React, {useContext, createContext, useState} from 'react'

export const UserCacheContext = createContext(null)

export const UserCacheProvider = ({children}) => {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [username, setUsername] = useState("")
    const [bio, setBio] = useState("")
    const [profilePicture, setProfilePicture] = useState("")
    
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

            setFirstName((_) => data.first_name)
            setLastName((_) => data.last_name)
            setUsername((_) => data.username)
            setProfilePicture((_) => data.profile_picture)
            setBio((_) => data.bio)
        }
        catch (err) {
            console.log(`Failed to refresh user cache:`, err)
        }
    }

    return (
        <UserCacheContext.Provider value={{ firstName, setFirstName, lastName, setLastName, username, setUsername, profilePicture, setProfilePicture, bio, setBio, refreshUserCache }}>
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