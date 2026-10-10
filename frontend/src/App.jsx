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
import ProtectedRoute from './components/ProtectedRoute.jsx'
import PublicRoute from './components/PublicRoute.jsx'

let protect = (element) => (<ProtectedRoute>{element}</ProtectedRoute>)
let publicize = (element) => (<PublicRoute>{element}</PublicRoute>)

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={publicize(<Login />)}/>
      <Route path="/forgot" element={publicize(<ForgotAccount />)}/>
      <Route path="/create-account" element={publicize(<CreateAccount />)}/>

      <Route path="/welcome" element={protect(<Welcome />)}/>
      
      {/* Logged-in pages: these all get the nav bar.
          Swap each ComingSoon for the real page as it's built. */}
      <Route element={<Layout />}>
        <Route path="/home" element={protect(<ComingSoon title="Home" />)} />
        <Route path="/top-content" element={protect(<ComingSoon title="Top" />)} />
        <Route path="/subscriptions" element={protect(<Following />)} />
        <Route path="/post-creation" element={protect(<PostCreation />)} />
        <Route path="/user-account" element={protect(<ComingSoon title="Account settings" />)} />
        <Route path="/user-page" element={protect(<UserPage />)} />
        <Route path="/user/:handle" element={protect(<UserPage />)} />
        <Route path="/post/:id" element={protect(<PostPage />)} />
      </Route>
    </Routes>
  )
}
