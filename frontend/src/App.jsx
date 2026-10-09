import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import Welcome from './pages/Welcome.jsx'
import ForgotAccount from './pages/ForgotAccount.jsx'
import UserPage from './pages/UserPage.jsx'
import PostPage from './pages/PostPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { Printer } from 'lucide-react'

import { useContext } from 'react'
import { AuthContext } from './AuthContext'

function RootRedirect() {
    const { accessToken } = useContext(AuthContext)
    return <Navigate to={accessToken ? '/welcome' : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/welcome" element={
        <ProtectedRoute>
          <Welcome />
        </ProtectedRoute>
        }
      />
      <Route path="/forgot" element={<ForgotAccount />} />
      <Route path="/user-page" element={
        <ProtectedRoute>
          <UserPage />
          </ProtectedRoute>
        } 
      />
      <Route path="/post/:id" element={<PostPage />} />
      {/* Add the rest as you build them:
          /top-content, /subscriptions, /user-account, /post-creation */}
    </Routes>
  )
}
