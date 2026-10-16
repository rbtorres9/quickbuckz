import { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

const PublicRoute = ({ children }) => {
    const { accessToken } = useContext(AuthContext)

    if (accessToken) {
        return <Navigate to="/user-page" replace />
    }

    return children
}

export default PublicRoute