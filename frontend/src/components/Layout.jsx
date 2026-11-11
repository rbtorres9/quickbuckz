import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useCache } from '../context/CacheContext.jsx'
import NavBar from './NavBar.jsx'

// Fun stuff on the empty sides of the page (wide screens only).
// Right side: this GIF, repeated top to bottom. Put any GIF at frontend/public/side.gif
const SIDE_GIF = '/side.gif'

// Wraps every logged-in page so they all get the nav bar.
export default function Layout() {
  const [hasGif, setHasGif] = useState(true) // hides the sides if side.gif is missing
  const [hasLeftPicture, setHasLeftPicture] = useState(true)
  const { userCache, isViewingUser, viewingUserCache } = useCache()

  const cache = (isViewingUser && viewingUserCache) ? viewingUserCache : userCache

  return (
    <>
      <NavBar />

      { cache?.left_picture ? (
        <div className={`side-gif ${cache.left_picture_flip ? '-scale-x-100' : ''} ${cache.left_picture_tile ? '' : 'single'}`} style={{ backgroundImage: `url(${cache.left_picture})` }} />
      ) : (
        true && <div className="side-gif" style={{ backgroundImage: `url(${SIDE_GIF})` }} />
      )}


      { cache?.right_picture ? (
        <div className={`side-gif flip ${cache.right_picture_flip ? '' : '-scale-x-100'} ${cache.right_picture_tile ? '' : 'single'}`} style={{ backgroundImage: `url(${cache.right_picture})` }} />
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
