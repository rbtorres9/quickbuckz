import { createContext, useContext, useState } from 'react'

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
  avak: { name: 'Ava Kim', handle: 'avak', bio: 'Photographer. Coastal towns and golden hour.', followers: 1204, following: 310 },
  samp: { name: 'Sam Patel', handle: 'samp', bio: 'Weekend road trips around Southcentral Alaska.', followers: 87, following: 142 },
  leog: { name: 'Leo Grant', handle: 'leog', bio: 'One backpack, ten countries and counting.', followers: 432, following: 95 },
  miat: { name: 'Mia Torres', handle: 'miat', bio: 'New to Alaska and asking all the questions.', followers: 19, following: 60 },
}

// Who the logged-in user follows. Mia isn't followed, so her post stays off the Home feed.
const sampleFollowing = ['avak', 'samp', 'leog']

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [posts, setPosts] = useState(samplePosts)
  const [isFollowing, setIsFollowing] = useState(false)
  // TODO: load and save follows from the backend database
  const [following, setFollowing] = useState(sampleFollowing)
  const toggleFollowUser = (handle) =>
    setFollowing((list) => (list.includes(handle) ? list.filter((h) => h !== handle) : [...list, handle]))
  // Demo only: lets you preview the page as a visitor or as the owner.
  // Once logins are real, "owner" = the logged-in user is viewing their own profile.
  const [viewer, setViewer] = useState('visitor')

  // The profile owner's editable info (name, bio, photos).
  const [profile, setProfile] = useState({ ...sampleUser, avatarUrl: null, bannerUrl: null })

  // TODO: save profile changes to the backend database
  const updateProfile = (changes) => setProfile((current) => ({ ...current, ...changes }))

  const me = viewer === 'owner'
    ? { name: profile.name, handle: profile.handle }
    : { name: 'You', handle: 'you' }

  function updatePost(id, change) {
    setPosts((all) => all.map((p) => (p.id === id ? { ...p, ...change(p) } : p)))
  }

  const toggleLike = (id) =>
    updatePost(id, (p) => ({ liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }))

  const addComment = (id, text) =>
    updatePost(id, (p) => ({
      comments: [...p.comments, { id: Date.now(), name: me.name, handle: me.handle, text, time: 'now', mine: true }],
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
      value={{ posts, viewer, setViewer, me, isFollowing, setIsFollowing, toggleLike, addComment, deleteComment, deletePost, addPost, profile, updateProfile, following, toggleFollowUser }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
