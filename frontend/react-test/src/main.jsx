import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TypingExample from './App.jsx'
import LoginForm from './Logintest.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoginForm />
  </StrictMode>,
)
