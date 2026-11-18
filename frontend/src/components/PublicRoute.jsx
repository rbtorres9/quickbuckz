import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { afterLoginPath } from '../utils/afterLogin.js'

const PublicRoute = ({ children }) => {
    const { accessToken } = useContext(AuthContext)
    const location = useLocation()

    if (accessToken) {
        return <Navigate to={afterLoginPath(location)} replace />
    }

    return children
}

export default PublicRoute
