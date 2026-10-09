import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import Welcome from './pages/Welcome.jsx'
import ForgotAccount from './pages/ForgotAccount.jsx'
import UserPage from './pages/UserPage.jsx'
import PostPage from './pages/PostPage.jsx'
import Layout from './components/Layout.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import PostCreation from './pages/PostCreation.jsx'
import Following from './pages/Following.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/forgot" element={<ForgotAccount />} />

      {/* Logged-in pages: these all get the nav bar.
          Swap each ComingSoon for the real page as it's built. */}
      <Route element={<Layout />}>
        <Route path="/home" element={<ComingSoon title="Home" />} />
        <Route path="/top-content" element={<ComingSoon title="Top" />} />
        <Route path="/subscriptions" element={<Following />} />
        <Route path="/post-creation" element={<PostCreation />} />
        <Route path="/user-account" element={<ComingSoon title="Account settings" />} />
        <Route path="/user-page" element={<UserPage />} />
        <Route path="/user/:handle" element={<UserPage />} />
        <Route path="/post/:id" element={<PostPage />} />
      </Route>
    </Routes>
  )
}
