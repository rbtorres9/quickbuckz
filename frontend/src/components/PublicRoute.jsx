import { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../AuthContext'

const PublicRoute = ({ children }) => {
    const { accessToken } = useContext(AuthContext)

    if (accessToken) {
        return <Navigate to="/welcome" replace />
    }

    return children
}

export default PublicRoute