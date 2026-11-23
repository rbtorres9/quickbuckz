import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
    const { accessToken, loggedOutByUser } = useContext(AuthContext)
    const location = useLocation()

    if (!accessToken) {
        // Pressed Log out: no "from", so login goes to /user-page.
        // Otherwise remember where they were going (like a shared post) so login can send them back.
        const state = loggedOutByUser.current ? undefined : { from: location.pathname + location.search }
        return <Navigate to="/login" replace state={state} />
    }

    return children
}

export default ProtectedRoute
