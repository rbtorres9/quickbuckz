import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import Welcome from './pages/Welcome.jsx'
import ForgotAccount from './pages/ForgotAccount.jsx'
import UserPage from './pages/UserPage.jsx'
import PostPage from './pages/PostPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/forgot" element={<ForgotAccount />} />
      <Route path="/user-page" element={<UserPage />} />
      <Route path="/post/:id" element={<PostPage />} />
      {/* Add the rest as you build them:
          /top-content, /subscriptions, /user-account, /post-creation */}
    </Routes>
  )
}
