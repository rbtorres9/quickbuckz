import { createContext, useContext, useEffect, useState } from 'react'
import { themeVars } from './themes.js'

// Sample data. The backend team replaces this with real database calls.
export const sampleUser = {
  name: 'Jordan Reyes',
  handle: 'jordanr',
  bio: 'Chasing northern lights and cheap flights. Anchorage-based, always planning the next trip.',
  followers: 248,
  following: 131,
}

const NOW = Date.now()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const samplePosts = [
  {
    id: 1, createdAt: NOW - 2 * DAY, author: 'Jordan Reyes', handle: 'jordanr', date: '2d', likes: 84, liked: false, image: 'img-a',
    text: 'Finally saw the aurora from Fairbanks. Three nights of clouds, then this. Worth every minute of waiting in the cold.',
    comments: [
      { id: 1, name: 'Sam Patel', handle: 'samp', text: 'Unreal colors. What time did it show up?', time: '1d' },
      { id: 2, name: 'Ava Kim', handle: 'avak', text: 'Adding Fairbanks to my list 🙌', time: '20h' },
    ],
  },
  {
    id: 2, createdAt: NOW - 5 * DAY, author: 'Jordan Reyes', handle: 'jordanr', date: '5d', likes: 41, liked: true, image: null,
    text: 'Tip: book shoulder season (May or September). Half the crowds, way cheaper lodging, still great weather most days.',
    comments: [{ id: 3, name: 'Leo Grant', handle: 'leog', text: 'Can confirm, did September last year.', time: '4d' }],
  },
  { id: 3, createdAt: NOW - 7 * DAY, author: 'Jordan Reyes', handle: 'jordanr', date: '1w', likes: 126, liked: false, image: 'img-b', text: '', comments: [] },
  {
    id: 4, createdAt: NOW - 3 * DAY, author: 'Ava Kim', handle: 'avak', date: '3d', likes: 203, liked: true, image: 'img-c',
    text: 'Sunset over the harbor on our last night.', comments: [],
  },
  {
    id: 5, createdAt: NOW - 4 * HOUR, author: 'Sam Patel', handle: 'samp', date: '4h', likes: 17, liked: false, image: null,
    text: 'Anyone done the Kenai Fjords day cruise? Trying to decide between the 6 hour and the 8 hour tour.',
    comments: [{ id: 4, name: 'Jordan Reyes', handle: 'jordanr', text: 'Do the 8 hour. You get way closer to the glaciers.', time: '2h' }],
  },
  {
    id: 6, createdAt: NOW - 1 * DAY, author: 'Leo Grant', handle: 'leog', date: '1d', likes: 58, liked: false, image: 'img-b',
    text: 'Packed light for once: one backpack, ten days. Never going back.', comments: [],
  },
  {
    id: 7, createdAt: NOW - 6 * HOUR, author: 'Mia Torres', handle: 'miat', date: '6h', likes: 12, liked: false, image: null,
    text: 'First time in Juneau. Where should I eat?', comments: [],
  },
]

// Other people on the site (sample). The backend will provide these from the users table.
export const sampleUsers = {
  jordanr: { name: 'Jordan Reyes', handle: 'jordanr', bio: 'Chasing northern lights and cheap flights. Anchorage-based, always planning the next trip.', followers: 248, following: 131, theme: 'classic' },
  avak: { name: 'Ava Kim', handle: 'avak', bio: 'Photographer. Coastal towns and golden hour.', followers: 1204, following: 310, theme: 'sunset' },
  samp: { name: 'Sam Patel', handle: 'samp', bio: 'Weekend road trips around Southcentral Alaska.', followers: 87, following: 142, theme: 'aurora' },
  leog: { name: 'Leo Grant', handle: 'leog', bio: 'One backpack, ten countries and counting.', followers: 432, following: 95, theme: 'glacier' },
  miat: { name: 'Mia Torres', handle: 'miat', bio: 'New to Alaska and asking all the questions.', followers: 19, following: 60, theme: 'midnight' },
}

// Who the logged-in user follows. Mia isn't followed, so her post stays off the Home feed.
const sampleFollowing = ['avak', 'samp', 'leog']

// Who follows the logged-in user. Mia follows you, but you don't follow her back yet.
// TODO: load followers from the backend database
const sampleFollowers = ['samp', 'miat']

// Notifications for the logged-in user, newest first: follows, likes and comments.
const sampleNotifications = [
  { id: 3, type: 'comment', handle: 'samp', postId: 1, text: 'Unreal colors. What time did it show up?', time: '1h', read: false },
  { id: 1, type: 'follow', handle: 'miat', time: '2h', read: false },
  { id: 4, type: 'like', handle: 'avak', postId: 1, time: '5h', read: false },
  { id: 5, type: 'like', handle: 'leog', postId: 2, time: '1d', read: true },
  { id: 2, type: 'follow', handle: 'samp', time: '3d', read: true },
]

// Reported posts waiting for a moderator (sample).
// TODO: load and save reports from a Reports table on the backend
const sampleReports = [
  { id: 1, postId: 7, isReal: false, author: 'miat', text: 'First time in Juneau. Where should I eat?', reason: 'Spam', reportedBy: 'samp', time: '1h' },
  { id: 2, postId: 6, isReal: false, author: 'leog', text: 'Packed light for once: one backpack, ten days. Never going back.', reason: 'Not about travel', reportedBy: 'avak', time: '5h' },
]

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [posts, setPosts] = useState(samplePosts)
  // TODO: load and save follows from the backend database
  const [following, setFollowing] = useState(sampleFollowing)
  // TODO: load notifications from the backend database
  const [notifications, setNotifications] = useState(sampleNotifications)
  // Mod mode (prototype). TODO: the backend must check the moderator role, not the browser
  const [reports, setReports] = useState(sampleReports)
  const addReport = (report) => setReports((list) => [{ id: Date.now(), time: 'now', ...report }, ...list])
  const removeReport = (id) => setReports((list) => list.filter((r) => r.id !== id))
  const [modMode, setModMode] = useState(() => localStorage.getItem('modMode') === 'on')
  useEffect(() => localStorage.setItem('modMode', modMode ? 'on' : 'off'), [modMode])

  const markAllRead = () => setNotifications((list) => list.map((n) => ({ ...n, read: true })))

  const toggleFollowUser = (handle) =>
    setFollowing((list) => (list.includes(handle) ? list.filter((h) => h !== handle) : [...list, handle]))
  // The logged-in user. Pages compare against this to know if you're the owner
  // (your profile, your posts) or a visitor (anyone else's).
  // TODO: after login, load this from GET /api/profile/me/
  const [profile, setProfile] = useState({ ...sampleUser, avatarUrl: null, bannerUrl: null, email: 'jordan@example.com', visibility: 'public', theme: localStorage.getItem('profileTheme') || 'classic' })

  // How the site looks to you (Settings). Recolors the whole site.
  // Remembered on this device. TODO: save this choice for the user on the backend
  const [siteTheme, setSiteTheme] = useState(() => localStorage.getItem('siteTheme') || 'classic')
  useEffect(() => {
    localStorage.setItem('siteTheme', siteTheme)
    for (const [name, value] of Object.entries(themeVars(siteTheme))) {
      document.documentElement.style.setProperty(name, value)
    }
  }, [siteTheme])

  // TODO: save the profile theme to the backend once it has a theme field (remembered on this device for now)
  const updateProfile = (changes) => {
    if (changes.theme) localStorage.setItem('profileTheme', changes.theme)
    setProfile((current) => ({ ...current, ...changes }))
  }

  function updatePost(id, change) {
    setPosts((all) => all.map((p) => (p.id === id ? { ...p, ...change(p) } : p)))
  }

  const toggleLike = (id) =>
    updatePost(id, (p) => ({ liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }))

  const addComment = (id, text) =>
    updatePost(id, (p) => ({
      comments: [...p.comments, { id: Date.now(), name: profile.name, handle: profile.handle, text, time: 'now', mine: true }],
    }))

  const deleteComment = (postId, commentId) =>
    updatePost(postId, (p) => ({ comments: p.comments.filter((c) => c.id !== commentId) }))

  const deletePost = (id) => setPosts((all) => all.filter((p) => p.id !== id))

  // Adds a new post to the top of the feed and returns its id.
  // TODO: save new posts to the backend database instead of this sample list
  function addPost({ text, imageUrl }) {
    const id = Date.now()
    setPosts((all) => [
      {
        id, createdAt: Date.now(), author: profile.name, handle: profile.handle, date: 'now',
        likes: 0, liked: false, image: null, imageUrl, text, comments: [],
      },
      ...all,
    ])
    return id
  }

  return (
    <StoreContext.Provider
      value={{ posts, toggleLike, addComment, deleteComment, deletePost, addPost, profile, updateProfile, following, toggleFollowUser, followers: sampleFollowers, notifications, markAllRead, siteTheme, setSiteTheme, reports, addReport, removeReport, modMode, setModMode }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
