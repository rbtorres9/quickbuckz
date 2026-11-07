import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useCache } from '../context/CacheContext.jsx'
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
  const { userCache } = useCache()

  return (
    <>
      <NavBar />
      {/* Hidden copies just to find out if the files exist */}
      <img src={SIDE_GIF} alt="" onError={() => setHasGif(false)} className="hidden" />
      <img src={LEFT_PICTURE} alt="" onError={() => setHasLeftPicture(false)} className="hidden" />

      { userCache?.left_picture ? (
        <div className={`side-gif ${userCache.left_picture_flip ? '-scale-x-100' : ''} ${userCache.left_picture_tile ? '' : 'single'}`} style={{ backgroundImage: `url(${userCache.left_picture})` }} />
      ) : (
        true && <div className="side-gif" style={{ backgroundImage: `url(${SIDE_GIF})` }} />
      )}


      { userCache?.right_picture ? (
        <div className={`side-gif flip ${userCache.right_picture_flip ? '' : '-scale-x-100'} ${userCache.right_picture_tile ? '' : 'single'}`} style={{ backgroundImage: `url(${userCache.right_picture})` }} />
      ) : (
        true && <div className="side-gif flip" style={{ backgroundImage: `url(${SIDE_GIF})` }} />
      )}

      {/* bottom padding keeps content clear of the phone tab bar */}
      <div className="pb-20 md:pb-0">
        <Outlet />
      </div>
    </>
  )
}
