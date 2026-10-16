import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import ForgotAccount from './pages/ForgotAccount.jsx'
import UserPage from './pages/UserPage.jsx'
import PostPage from './pages/PostPage.jsx'
import Layout from './components/Layout.jsx'
import PostCreation from './pages/PostCreation.jsx'
import Following from './pages/Following.jsx'
import Followers from './pages/Followers.jsx'
import AccountSettings from './pages/AccountSettings.jsx'
import NotFound from './pages/NotFound.jsx'
import Home from './pages/Home.jsx'
import Notifications from './pages/Notifications.jsx'
import Top from './pages/Top.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/forgot" element={<ForgotAccount />} />

      {/* Logged-in pages: these all get the nav bar */}
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/top-content" element={<Top />} />
        <Route path="/subscriptions" element={<Following />} />
        <Route path="/followers" element={<Followers />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/post-creation" element={<PostCreation />} />
        <Route path="/user-account" element={<AccountSettings />} />
        <Route path="/user-page" element={<UserPage />} />
        <Route path="/user/:handle" element={<UserPage />} />
        <Route path="/post/:id" element={<PostPage />} />
      </Route>

      {/* Any address that doesn't match a page above */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
