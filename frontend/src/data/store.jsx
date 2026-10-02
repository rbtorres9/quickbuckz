import { createContext, useContext, useState } from 'react'

// Sample data. The backend team replaces this with real database calls.
export const sampleUser = {
  name: 'Jordan Reyes',
  handle: 'jordanr',
  bio: 'Chasing northern lights and cheap flights. Anchorage-based, always planning the next trip.',
  followers: 248,
  following: 131,
}

const samplePosts = [
  {
    id: 1, author: 'Jordan Reyes', handle: 'jordanr', date: '2d', likes: 84, liked: false, image: 'img-a',
    text: 'Finally saw the aurora from Fairbanks. Three nights of clouds, then this. Worth every minute of waiting in the cold.',
    comments: [
      { id: 1, name: 'Sam Patel', handle: 'samp', text: 'Unreal colors. What time did it show up?', time: '1d' },
      { id: 2, name: 'Ava Kim', handle: 'avak', text: 'Adding Fairbanks to my list 🙌', time: '20h' },
    ],
  },
  {
    id: 2, author: 'Jordan Reyes', handle: 'jordanr', date: '5d', likes: 41, liked: true, image: null,
    text: 'Tip: book shoulder season (May or September). Half the crowds, way cheaper lodging, still great weather most days.',
    comments: [{ id: 3, name: 'Leo Grant', handle: 'leog', text: 'Can confirm, did September last year.', time: '4d' }],
  },
  { id: 3, author: 'Jordan Reyes', handle: 'jordanr', date: '1w', likes: 126, liked: false, image: 'img-b', text: '', comments: [] },
  {
    id: 4, author: 'Ava Kim', handle: 'avak', date: '3d', likes: 203, liked: true, image: 'img-c',
    text: 'Sunset over the harbor on our last night.', comments: [],
  },
]

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [posts, setPosts] = useState(samplePosts)
  const [isFollowing, setIsFollowing] = useState(false)
  // Demo only: lets you preview the page as a visitor or as the owner.
  // Once logins are real, "owner" = the logged-in user is viewing their own profile.
  const [viewer, setViewer] = useState('visitor')

  const me = viewer === 'owner'
    ? { name: sampleUser.name, handle: sampleUser.handle }
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

  return (
    <StoreContext.Provider
      value={{ posts, viewer, setViewer, me, isFollowing, setIsFollowing, toggleLike, addComment, deleteComment, deletePost }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
