import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import NavBar from './NavBar.jsx'

// Fun stuff on the empty sides of the page (wide screens only).
// Right side: this GIF, repeated top to bottom. Put any GIF at frontend/public/side.gif
const SIDE_GIF = '/side.gif'
// Left side: this picture, shown once in the middle. Put it at frontend/public/side-left.png
// (for a .jpg or .gif, change the name here to match). No file = the GIF on both sides.
const LEFT_PICTURE = '/side.gif'

// Wraps every logged-in page so they all get the nav bar.
export default function Layout() {
  const [hasGif, setHasGif] = useState(true) // hides the sides if side.gif is missing
  const [hasLeftPicture, setHasLeftPicture] = useState(true)

  return (
    <>
      <NavBar />
      {/* Hidden copies just to find out if the files exist */}
      <img src={SIDE_GIF} alt="" onError={() => setHasGif(false)} className="hidden" />
      <img src={LEFT_PICTURE} alt="" onError={() => setHasLeftPicture(false)} className="hidden" />

      { false  ? (
        <div className="side-gif single" style={{ backgroundImage: `url(${LEFT_PICTURE})` }} />
      ) : (
        true && <div className="side-gif" style={{ backgroundImage: `url(${SIDE_GIF})` }} />
      )}
      {/* the right side is mirrored so it faces the middle */}
      {hasGif && <div className="side-gif flip" style={{ backgroundImage: `url(${SIDE_GIF})` }} />}

      {/* bottom padding keeps content clear of the phone tab bar */}
      <div className="pb-20 md:pb-0">
        <Outlet />
      </div>
    </>
  )
}
