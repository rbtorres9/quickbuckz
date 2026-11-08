import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCache } from '../context/CacheContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'
import Logo from '../components/Logo.jsx'
import { getTheme, themeVars } from '../data/themes.js'
import { getName } from '../utils/NameHandler.js'

// /user-page shows your own profile (real, from the database).
// /user/:handle shows someone else's.
export default function UserPage() {
  const { handle } = useParams()
  const { fetchUserProfile, fetchWithToken, fetchUserPosts  } = useAuthContext()
  const [ followBusy, setFollowBusy ] = useState(false)
  const [ followError, setFollowError ] = useState('')
  const { userCache, refreshUserCache, isViewingUser, setIsViewingUser, viewingUserCache, setViewingUserCache } = useCache()
  const [ tab, setTab ] = useState('posts')
  const [ editing, setEditing ] = useState(false)
  
  const [ loadingUser, setLoadingUser ] = useState(true)
  const [ loadingPosts, setLoadingPosts ] = useState(true)
  const [ postsError, setPostsError ] = useState(null)
  const [ userError, setUserError ] = useState(null)

  const [ person, setPerson ] = useState(null)
  const [ posts, setPosts ] = useState([])
  const [ shown, setShown ] = useState([])
  // const person = isSelf
  //   ? {
  //       name: [userCache.first_name, userCache.last_name].filter(Boolean).join(' ') || userCache.username,
  //       handle: userCache.username,
  //       bio: userCache.bio,
  //       avatarUrl: userCache.profile_picture,
  //       bannerUrl: userCache.banner,
  //       theme: profile.theme, // TODO: save theme in the database
  //     }
  //   : sampleUsers[handle]

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
      const userData = userResult.result

      setLoadingUser(false)

      if (userResult.isError) {
        setUserError(userData)
        return
      }

      setPerson(userData)
      setViewingUserCache(userData)

      const postsResult = await fetchUserPosts(`${handle}`)
      setLoadingPosts(false)

      if (postsResult.isError) {
        setPostsError(postsResult)
        return
      }

      setPosts(postsResult.result)
    }

    const fetchMyData = async() => {
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

    if (isSelf) {
      if (userCache) fetchMyData() // wait until your account has loaded
    }
    else {
      fetchOtherUserData()
    }
  }, [isSelf, userCache?.username])

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

  if (isSelf && !userCache) {
    return <main className="mx-auto max-w-2xl px-4 py-24 text-center text-sm text-muted">Loading your profile…</main>
  }

  // TODO: load other users' profiles and posts from the backend database
  if (loadingUser) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
          <p className="font-medium">Loading data about @{handle}.</p>
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

  // Follow = POST, Unfollow = DELETE. The backend sends back the new state and count.
  const followed = person.is_followed
  async function toggleFollow() {
    setFollowBusy(true)
    setFollowError('')
    const result = await fetchWithToken(`/api/profile/${person.username}/follow/`, { method: followed ? 'DELETE' : 'POST' })
    setFollowBusy(false)

    const data = result.result
    if (result.isError) return setFollowError(errorMessage(data))
    refreshUserCache() // so your own Following count stays right
    setPerson({ ...person, is_followed: data.is_followed, followers_count: data.followers_count })
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
  } else {
    button = (
      <button
        onClick={toggleFollow}
        disabled={followBusy}
        className="mb-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        { followBusy ? "Following..." : "Follow"}
      </button>
    )
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
            {button}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{personName}</h1>
          <p className="text-sm text-muted">@{person.username}</p>
          {person.bio && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">{person.bio}</p>}
          <div className="mt-4 flex gap-5 text-sm">
            <span><b>{isLoading ? '–' : posts.length}</b> <span className="text-muted">Posts</span></span>
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
          {isLoading ? (
            <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <p className="font-medium">Loading posts...</p>
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