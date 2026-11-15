import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useCache } from '../context/CacheContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'
import Logo from '../components/Logo.jsx'
import { getTheme, themeVars } from '../data/themes.js'
import { getName } from '../utils/NameHandler.js'
import { MoreHorizontal } from 'lucide-react'
import { useIsMod } from '../utils/useIsMod.js'
import { askRemovalMessage } from '../utils/removalMessage.js'
import WakingUpNote from '../components/WakingUpNote.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

// /user-page shows your own profile (real, from the database).
// /user/:handle shows someone else's.
export default function UserPage() {
  const isMod = useIsMod()
  const { handle } = useParams()
  usePageTitle(handle ? `@${handle}` : 'Your profile')
  const navigate = useNavigate()

  const { fetchUserProfile, fetchWithToken, fetchUserPosts  } = useAuthContext()
  const [ followBusy, setFollowBusy ] = useState(false)
  const [ followError, setFollowError ] = useState('')
  const { userCache, refreshUserCache, setIsViewingUser, setViewingUserCache } = useCache()
  const [ tab, setTab ] = useState('posts')
  const [ editing, setEditing ] = useState(false)
  const [ menuOpen, setMenuOpen ] = useState(false)
  const menuRef = useRef(null)
  
  const [ loadingUser, setLoadingUser ] = useState(true)
  const [ loadingPosts, setLoadingPosts ] = useState(true)
  const [ postsError, setPostsError ] = useState(null)
  const [ userError, setUserError ] = useState(null)

  const [ person, setPerson ] = useState(null)
  const [ posts, setPosts ] = useState([])
  const [ shown, setShown ] = useState([])

  const isSelf = !handle || handle === userCache?.username

  // Clean up global variables
  useEffect(() => {
    return () => { 
      setIsViewingUser(false)
      setViewingUserCache(null)
    }
  }, [])

  // Load your own posts from the database, newest first
  useEffect(() => {
    const fetchOtherUserData = async () => {
      setIsViewingUser(true)
      setLoadingUser(true)
      setLoadingPosts(true)
      setPostsError(null)
      setUserError(null)

      // Sent with your login so the backend can say whether you follow them (is_followed)
      const userResult = await fetchUserProfile(`${handle}`)
      if (stale) return // you already left this profile while it was loading
      const userData = userResult.result

      setLoadingUser(false)

      if (userResult.isError) {
        setUserError(userData)
        return
      }

      setPerson(userData)
      setViewingUserCache(userData)

      if (userData.visibility === 'private' && !userData.is_followed && !userData.is_self) {
        setPosts([])
        setLoadingPosts(false)
        return
      }

      const postsResult = await fetchUserPosts(`${handle}`)
      if (stale) return
      setLoadingPosts(false)

      if (postsResult.isError) {
        setPostsError(postsResult)
        return
      }

      setPosts(postsResult.result)
    }

    const fetchMyData = async() => {
      // Back on your own profile: stop showing the last person's side pictures and theme
      setIsViewingUser(false)
      setViewingUserCache(null)
      setLoadingUser(true)
      setLoadingPosts(true)
      setPostsError(null)
      setUserError(null)

      setPerson(userCache)
      setLoadingUser(false)

      const postsResult = await fetchUserPosts(`${userCache.username}`)
      setLoadingPosts(false)

      if (postsResult.isError) {
        setPostsError(postsResult)
        return
      }

      setPosts(postsResult.result)
      setLoadingPosts(false)
    }

    let stale = false // set when you leave this profile, so a slow load can't apply their pictures afterwards
    if (isSelf) {
      if (userCache) fetchMyData() // wait until your account has loaded
    }
    else {
      fetchOtherUserData()
    }
    return () => {
      stale = true
      setIsViewingUser(false)
      setViewingUserCache(null)
    }
  }, [isSelf, handle, userCache?.username]) // handle: reload when going from one profile to another

  // Update own profile when edited
  useEffect(() => {
    if (isSelf)
      setPerson(userCache)
  }, [userCache])

  // Your own profile: show changes from Edit profile right away
  useEffect(() => {
    if (isSelf && userCache) setPerson(userCache)
  }, [isSelf, userCache])

  // Your own profile only has Posts for now (Top and Likes need backend support)
  const tabs = isSelf ? [{ id: 'posts', label: 'Posts' }] : [{ id: 'posts', label: 'Posts' }, { id: 'top', label: 'Top' }]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'posts'
  useEffect(() => {
    if (loadingPosts)
      return

    setShown(activeTab === 'top' ? [...posts].sort((a, b) => b.likes_count - a.likes_count) : posts)
  }, [posts, tab, loadingPosts])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  if (isSelf && !userCache) {
    return <main className="mx-auto max-w-2xl px-4 py-24 text-center text-sm text-muted">Loading your profile…<WakingUpNote /></main>
  }

  // TODO: load other users' profiles and posts from the backend database
  if (loadingUser) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">Loading data about @{handle}.</p>
          <WakingUpNote />
          <div className="relative mt-7 h-14">
            <div className="dog-run">
              <Logo size={56} className="text-accent animate-bounce" />
            </div>
          </div>
        </div>
      </main>
    )
  }
  else if (!person) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">User not found</h1>
        <p className="mt-2 text-sm text-muted">There's no one here with the username @{handle}.</p>
        <Link to="/subscriptions" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">
          Back to Following
        </Link>
      </main>
    )
  }

  // Follow/Request = POST, Unfollow/Cancel request = DELETE. The backend sends back the new state and count.
  const followed = person.is_followed
  const requested = person.is_requested
  const isLocked = !isSelf && person.visibility === 'private' && !followed
  async function toggleFollow() {
    setFollowBusy(true)
    setFollowError('')
    const result = await fetchWithToken(`/api/profile/${person.username}/follow/`, { method: (followed || requested) ? 'DELETE' : 'POST' })
    setFollowBusy(false)

    const data = result.result
    if (result.isError) return setFollowError(errorMessage(data))
    refreshUserCache() // so your own Following count stays right
    setPerson({ ...person, is_followed: data.is_followed, is_requested: data.is_requested, followers_count: data.followers_count })
  }
  

  const isLoading = loadingUser || loadingPosts
  const hasError = userError || postsError
  // Falls back to the username when someone has no first/last name
  const personName = getName(person) || person.username || ''

  let button
  if (isSelf) {
    button = (
      <button
        onClick={() => setEditing(true)}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5"
      >
        Edit profile
      </button>
    )
  } else if (followed) {
    button = (
      <button
        onClick={toggleFollow}
        disabled={followBusy}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        { followBusy ? "Unfollowing..." : "Following"}
      </button>
    )
  } else if (requested) {
    button = (
      <button
        onClick={toggleFollow}
        disabled={followBusy}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:border-red-400/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        { followBusy ? "Cancelling..." : "Requested" }
      </button>
    )
  } else {
    button = (
      <button
        onClick={toggleFollow}
        disabled={followBusy}
        className="mb-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        { followBusy ? (person.visibility === 'private' ? "Requesting..." : "Following...") : "Follow"}
      </button>
    )
  }

  const handleReport = async () => {
    setMenuOpen(false)

    const reason = prompt(`Why are you reporting @${person.username}?`)
    if (!reason?.trim()) return

    const result = await fetchWithToken(`/api/profile/${person.username}/report/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    if (result.isError) return alert(errorMessage(result.result))
    alert(result.result?.detail ?? 'Thanks, this profile was reported.')
  }

  const handleBan = async () => {
    setMenuOpen(false)

    const reason = prompt(`Why are you banning @${person.username}?`)
    if (!reason?.trim()) return
    if (!confirm(`Ban @${person.username}? Their profile and posts will be hidden until a moderator reactivates them.`)) return

    const result = await fetchWithToken(`/api/profile/${person.username}/ban/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    if (result.isError) return alert(errorMessage(result.result))

    alert(`@${person.username} was banned.`)
    navigate(`/mod/${person.username}/status`)
  }

  // shared helper for profile picture, banner, background side pictures, bio
  const removeProfileItem = async (item, label) => {
    setMenuOpen(false)

    // removal confirmation prompt
    const message = askRemovalMessage(`Remove @${person.username}'s ${label}? This can't be undone.`)
    if (!message) return

    const result = await fetchWithToken(`/api/profile/${person.username}/remove-content/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [item], message }),
    })
    if (result.isError) return alert(String(errorMessage(result.result)))

    // clear what the backend removed, so the page and side pictures update without a reload
    const cleared = Object.fromEntries(result.result.removed.map((name) => [name, name === 'bio' ? '' : null]))
    setPerson((p) => ({ ...p, ...cleared }))
    setViewingUserCache((c) => (c ? { ...c, ...cleared } : c))
    alert(`@${person.username}'s ${label} was removed.`)
  }


  const removeProfilePicture = () => {
    removeProfileItem('profile_picture', 'profile picture')
  }


  const removeBanner = () => {
    removeProfileItem('banner', 'banner')
  }

  const removeLeftPicture = () => {
    removeProfileItem('left_picture', 'left picture')
  }

  const removeRightPicture = () => {
    removeProfileItem('right_picture', 'right picture')
  }

  const removeBio = () => {
    removeProfileItem('bio', 'bio')
  }

  return (
    <>
      {/* The profile shows in its owner's theme, whatever your own site color is */}
      <main className="mx-auto max-w-2xl px-4 pb-24" style={ themeVars(person.theme) }>
        {person.banner ? (
          <img src={person.banner} alt="" className="mt-4 h-32 w-full rounded-2xl border border-line object-cover sm:h-40" />
        ) : (
          <div className="mt-4 h-32 rounded-2xl border border-line sm:h-40" style={{ background: getTheme(person.theme).banner }} />
        )}

        <div className="-mt-10 px-2 sm:px-4">
          <div className="flex items-end justify-between">
            <Avatar name={personName} src={person.profile_picture} size="lg" />

            <div className='relative flex items-center gap-2' ref={menuRef}>
              { !isSelf && (
                <>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="rounded-md px-2 py-1 text-muted hover:bg-white/5"
                    aria-label="Post options"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  { menuOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-field text-sm shadow-xl">
                      <button
                        onClick={handleReport}
                        className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5"
                      >
                        Report
                      </button>
                      {isMod && (
                        <>
                          <button onClick={handleBan} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                            Ban (mod)
                          </button>
                          <button onClick={removeProfilePicture} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                            Remove profile picture (mod)
                          </button>
                          <button onClick={removeBanner} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                            Remove banner (mod)
                          </button>
                          <button onClick={removeLeftPicture} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                            Remove left picture (mod)
                          </button>
                          <button onClick={removeRightPicture} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                            Remove right picture (mod)
                          </button>
                          <button onClick={removeBio} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                            Remove bio (mod)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {button}
            </div>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{personName}</h1>
          <p className="text-sm text-muted">@{person.username}</p>
          {person.bio && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">{person.bio}</p>}
          <div className="mt-4 flex gap-5 text-sm">
            <span><b>{isLoading || isLocked ? '–' : posts.length}</b> <span className="text-muted">Posts</span></span>
            {isSelf ? (
              <>
                <Link to="/followers" className="hover:underline"><b>{person.followers_count ?? 0}</b> <span className="text-muted">Followers</span></Link>
                <Link to="/subscriptions" className="hover:underline"><b>{person.following_count ?? 0}</b> <span className="text-muted">Following</span></Link>
              </>
            ) : (
              <>
                <Link to={`/user/${person.username}/followers`} className="hover:underline"><b>{person.followers_count ?? 0}</b> <span className="text-muted">Followers</span></Link>
                <Link to={`/user/${person.username}/following`} className="hover:underline"><b>{person.following_count ?? 0}</b> <span className="text-muted">Following</span></Link>
                {person.follows_you && <span className="rounded bg-white/10 px-1.5 text-xs text-muted">Follows you</span>}
              </>
            )}
          </div>
          {followError && <p className="mt-2 text-sm text-red-400">{followError}</p>}

          

        </div>

        <nav className="mt-6 flex border-b border-line text-sm font-medium">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 border-b-2 py-3 ${
                activeTab === t.id ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-4 space-y-4">
          {isLocked ? (
            <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <p className="font-medium">This account is private</p>
              <p className="mt-1 text-sm text-muted">
                {requested ? 'Your follow request is pending.' : `Follow @${person.username} to see their posts.`}
              </p>
            </div>
          ) : isLoading ? (
            <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <p className="font-medium">Loading posts...</p>
              <WakingUpNote />
              <div className="relative mt-7 h-14">
                <div className="dog-run">
                  <Logo size={56} className="text-accent animate-bounce" />
                </div>
              </div>
            </div>
          ) : hasError ? (
            <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <p className="font-medium">Error fetching posts</p>
            </div>
          ) : shown.length ? (
            shown.map((p) => (
              <PostCard key={p.id} post={p} user={isSelf ? userCache : null} onDeleted={() => setPosts((all) => all.filter((x) => x.id !== p.id))} />
            ))
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              {isSelf ? 'Nothing here yet.' : `${personName} hasn't posted yet.`}
            </p>
          )}
        </div>
      </main>

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </>
  )
}