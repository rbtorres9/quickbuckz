import { Outlet } from 'react-router-dom'
import NavBar from './NavBar.jsx'

// Wraps every logged-in page so they all get the nav bar.
export default function Layout() {
  return (
    <>
      <NavBar />
      {/* bottom padding keeps content clear of the phone tab bar */}
      <div className="pb-20 md:pb-0">
        <Outlet />
      </div>
    </>
  )
}
