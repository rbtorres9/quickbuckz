import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import NavBar from './NavBar.jsx'

// The GIF that plays on both sides of the page on wide screens.
// To change it, put any GIF at frontend/public/side.gif
const SIDE_GIF = '/side.gif'

// Wraps every logged-in page so they all get the nav bar.
export default function Layout() {
  const [hasGif, setHasGif] = useState(true) // hides the sides if side.gif is missing

  return (
    <>
      <NavBar />
      {/* Fun: the GIF stacked to fill both sides; the right side is mirrored so both face the middle */}
      {hasGif && (
        <>
          <img src={SIDE_GIF} alt="" onError={() => setHasGif(false)} className="hidden" />
          <div className="side-gif" style={{ backgroundImage: `url(${SIDE_GIF})` }} />
          <div className="side-gif flip" style={{ backgroundImage: `url(${SIDE_GIF})` }} />
        </>
      )}
      {/* bottom padding keeps content clear of the phone tab bar */}
      <div className="pb-20 md:pb-0">
        <Outlet />
      </div>
    </>
  )
}
