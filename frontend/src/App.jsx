import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import Welcome from './pages/Welcome.jsx'
import ForgotAccount from './pages/ForgotAccount.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/forgot" element={<ForgotAccount />} />
      {/* Add the rest as you build them:
          /user-page, /top-content, /subscriptions, /user-account, /post-creation */}
    </Routes>
  )
}
