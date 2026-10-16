import { Link, NavLink } from 'react-router-dom'
import { Home, Flame, Users, Plus, User, Plane } from 'lucide-react'
import { useStore } from '../data/store.jsx'

// Edit this list to add, remove, or rename nav links.
const links = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/top-content', label: 'Top', icon: Flame },
  { to: '/subscriptions', label: 'Following', icon: Users },
  { to: '/user-page', label: 'Profile', icon: User },
]

const desktopLink = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-white/5 text-accent' : 'text-muted hover:text-white'
  }`

const mobileLink = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
    isActive ? 'text-accent' : 'text-muted'
  }`

function DemoToggle() {
  // Demo only: preview pages as a visitor or as the profile owner.
  // Delete this (and its use below) once real logins decide who the owner is.
  /*
  const { viewer, setViewer } = useStore()
  return (
    <div className="flex items-center rounded-full border border-line p-0.5 text-xs" title="Demo: view as">
      {['visitor', 'owner'].map((v) => (
        <button
          key={v}
          onClick={() => setViewer(v)}
          className={`rounded-full px-2.5 py-1 capitalize ${viewer === v ? 'bg-accent text-page' : 'text-muted hover:text-white'}`}
        >
          {v}
        </button>
      ))}
    </div>
  )
    */
}

export default function NavBar() {
  return (
    <>
      {/* Top bar: logo + links on desktop, logo only on phones */}
      <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-page">
              <Plane size={16} strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">QuickBuckz</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={desktopLink}>
                <Icon size={17} /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* <DemoToggle /> */}
            <Link
              to="/post-creation"
              className="hidden items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-page transition hover:bg-accent-hover md:flex"
            >
              <Plus size={16} strokeWidth={2.5} /> New post
            </Link>
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-white">
              Log out
            </Link>
          </div>
        </div>
      </header>

      {/* Bottom tab bar on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {links.slice(0, 2).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={mobileLink}>
            <Icon size={20} /> {label}
          </NavLink>
        ))}
        <Link to="/post-creation" className="flex flex-1 justify-center" aria-label="New post">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-page">
            <Plus size={22} strokeWidth={2.5} />
          </span>
        </Link>
        {links.slice(2).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={mobileLink}>
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
