import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
    const { loggedIn } = useContext(AuthContext)
    const location = useLocation()

    if (!loggedIn) {
        // Remember where they were going (like a shared post) so login can send them back
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    }

    return children
}

export default ProtectedRoute
