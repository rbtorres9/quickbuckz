import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { StoreProvider } from './data/store.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { UserCacheProvider } from './context/UserCacheContext.jsx'
import { ApiProvider } from './context/ApiContext.jsx'
import { NotificationsProvider } from './context/NotificationsContext.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ApiProvider>
        <AuthProvider>
          <UserCacheProvider>
            <NotificationsProvider>
              <StoreProvider>
                <App />
              </StoreProvider>
            </NotificationsProvider>
          </UserCacheProvider>
        </AuthProvider>
      </ApiProvider>
    </BrowserRouter>
  </StrictMode>
)
