import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      {/* Add the rest as you build them:
          /user-page, /top-content, /subscriptions, /user-account, /post-creation */}
    </Routes>
  )
}
