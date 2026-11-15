import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo size={72} className="text-accent" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page doesn't exist, or it may have moved.</p>
      <Link
        to="/home"
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-page hover:bg-accent-hover"
      >
        Go home
      </Link>
    </main>
  )
}
