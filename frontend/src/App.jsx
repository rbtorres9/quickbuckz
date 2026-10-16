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
import ProtectedRoute from './components/ProtectedRoute.jsx'
import PublicRoute from './components/PublicRoute.jsx'

// protect: only for signed-in people (others go to /login)
// publicize: only for signed-out people (others go to their profile)
let protect = (element) => (<ProtectedRoute>{element}</ProtectedRoute>)
let publicize = (element) => (<PublicRoute>{element}</PublicRoute>)

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={publicize(<Login />)} />
      <Route path="/forgot" element={publicize(<ForgotAccount />)} />
      <Route path="/create-account" element={<CreateAccount />} />

      {/* Logged-in pages: these all get the nav bar */}
      <Route element={<Layout />}>
        <Route path="/home" element={protect(<Home />)} />
        <Route path="/top-content" element={protect(<Top />)} />
        <Route path="/subscriptions" element={protect(<Following />)} />
        <Route path="/followers" element={protect(<Followers />)} />
        <Route path="/notifications" element={protect(<Notifications />)} />
        <Route path="/post-creation" element={protect(<PostCreation />)} />
        <Route path="/user-account" element={protect(<AccountSettings />)} />
        <Route path="/user-page" element={protect(<UserPage />)} />
        <Route path="/user/:handle" element={protect(<UserPage />)} />
        <Route path="/post/:id" element={protect(<PostPage />)} />
      </Route>

      {/* Any address that doesn't match a page above */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
