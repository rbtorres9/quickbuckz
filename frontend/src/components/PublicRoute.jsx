import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { afterLoginPath } from '../utils/afterLogin.js'

const PublicRoute = ({ children }) => {
    const { loggedIn } = useContext(AuthContext)
    const location = useLocation()

    if (loggedIn) {
        return <Navigate to={afterLoginPath(location)} replace />
    }

    return children
}

export default PublicRoute
