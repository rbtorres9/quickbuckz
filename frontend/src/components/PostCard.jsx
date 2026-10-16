import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react'
import { useStore } from '../data/store.jsx'
import Avatar from './Avatar.jsx'

export default function PostCard({ post, full = false, onDeleted }) {
  const { viewer, toggleLike, deletePost, profile } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const byOwner = post.handle === profile.handle
  const isMine = viewer === 'owner' && byOwner
  // Posts by the profile owner always show their latest name and photo
  const authorName = byOwner ? profile.name : post.author

  // Close the ⋯ menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  function handleDelete() {
    if (!confirm('Delete this post?')) return
    deletePost(post.id)
    onDeleted?.()
  }

  // Real photos use imageUrl; the sample posts use gradient placeholders.
  const image = post.imageUrl ? (
    <img
      src={post.imageUrl}
      alt=""
      className={`mx-5 mt-3 w-[calc(100%-2.5rem)] rounded-xl object-cover ${full ? 'max-h-[32rem]' : 'h-56'}`}
    />
  ) : post.image ? (
    <div className={`${post.image} mx-5 mt-3 rounded-xl ${full ? 'h-72' : 'h-56'}`} />
  ) : null

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Avatar name={authorName} src={byOwner ? profile.avatarUrl : null} />
        <div className="flex-1 text-sm">
          <b>{authorName}</b> <span className="text-muted">@{post.handle} · {post.date}</span>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md px-2 py-1 text-muted hover:bg-white/5"
            aria-label="Post options"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-lg border border-line bg-field text-sm shadow-xl">
              {isMine ? (
                <>
                  <button className="block w-full px-3 py-2 text-left hover:bg-white/5">Edit</button>
                  <button onClick={handleDelete} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                    Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); alert('Thanks, this post was reported.') }}
                  className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5"
                >
                  Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {post.text && <p className="px-5 pt-3 text-sm leading-relaxed">{post.text}</p>}
      {image && (full ? image : <Link to={`/post/${post.id}`}>{image}</Link>)}

      <div className="flex items-center gap-5 px-5 py-4 text-sm text-muted">
        <button
          onClick={() => toggleLike(post.id)}
          className={`flex items-center gap-1.5 hover:text-white ${post.liked ? 'text-accent' : ''}`}
        >
          <Heart size={18} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}
        </button>
        <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 hover:text-white">
          <MessageCircle size={18} /> {post.comments.length}
        </Link>
      </div>
    </article>
  )
}
