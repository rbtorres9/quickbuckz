import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Flame, Users, Plus, User, Settings, Bell } from 'lucide-react'
import Logo from './Logo.jsx'
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

function NotificationBell() {
  const { notifications } = useStore()
  const unread = notifications.filter((n) => !n.read).length
  // remembers what page before clicking the notification bell
  const location = useLocation()
  const navigate = useNavigate()

  // flag for if we are on notifications page
  const onNotifications = location.pathname === '/notifications'
  const handleClick = (e) =>  {
    if (!onNotifications) return // normal NavLink behaviour; state is passed below
    e.preventDefault();
    if (location.state?.fromBell) {
      navigate(-1) // pop back to the page we came from (e.g. /user-page)
    } else {
      navigate('/home') // landed here directly (typed URL / refresh) — no page to go back to
    }
  }
  return (
    <NavLink
      to="/notifications"
      state={{ fromBell: true }}
      onClick={handleClick}
      className={desktopLink}
      aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
      aria-pressed={onNotifications}
    >
      <span className="relative">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-page">
            {unread}
          </span>
        )}
      </span>
    </NavLink>
  )
}

export default function NavBar() {
  return (
    <>
      {/* Top bar: logo + links on desktop, logo only on phones */}
      <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2 font-semibold">
            <Logo size={34} className="text-accent" />
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
            <Link
              to="/post-creation"
              className="hidden items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-page transition hover:bg-accent-hover md:flex"
            >
              <Plus size={16} strokeWidth={2.5} /> New post
            </Link>
            <NotificationBell />
            <NavLink to="/user-account" className={desktopLink} aria-label="Account settings">
              <Settings size={17} /> <span className="hidden lg:inline">Settings</span>
            </NavLink>
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
