import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react'
import { useStore } from '../data/store.jsx'
import Avatar from './Avatar.jsx'
import PhotoViewer from './PhotoViewer.jsx'

export default function PostCard({ post, full = false, onDeleted }) {
  const { toggleLike, deletePost, profile } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [viewing, setViewing] = useState(false) // full-screen photo open?
  const [burst, setBurst] = useState(false) // heart animation showing?
  const [copied, setCopied] = useState(false) // "Link copied" showing?
  const clickTimer = useRef(null)
  const byOwner = post.handle === profile.handle
  const isMine = byOwner // your own post: Edit/Delete instead of Report
  // Posts by the profile owner always show their latest name and photo
  const authorName = byOwner ? profile.name : post.author
  const profileLink = byOwner ? '/user-page' : `/user/${post.handle}`

  // Close the ⋯ menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  function handleDelete() {
    if (!confirm('Delete this post?')) return
    deletePost(post.id)
    onDeleted?.()
  }

  // Click a photo: open it full-screen. Double-click: like it with a heart burst.
  // (A double-click also fires a click, so we wait a moment to see which it was.)
  function handlePhotoClick() {
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => setViewing(true), 250)
  }
  function handlePhotoDoubleClick() {
    clearTimeout(clickTimer.current)
    if (!post.liked) toggleLike(post.id)
    setBurst(true)
    setTimeout(() => setBurst(false), 700)
  }

  // Share: the phone's share sheet if there is one, otherwise copy the link
  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${authorName} on QuickBuckz`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      // The user closed the share sheet, or copying wasn't allowed: nothing to do
    }
  }

  // Real photos use imageUrl; the sample posts use gradient placeholders.
  const hasPhoto = post.imageUrl || post.image
  const photo = post.imageUrl ? (
    <img src={post.imageUrl} alt="" className={`w-full rounded-xl object-cover ${full ? 'max-h-[32rem]' : 'h-56'}`} />
  ) : (
    <div className={`${post.image} rounded-xl ${full ? 'h-72' : 'h-56'}`} />
  )

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to={profileLink} className="shrink-0">
          <Avatar name={authorName} src={byOwner ? profile.avatarUrl : null} />
        </Link>
        <div className="flex-1 text-sm">
          <Link to={profileLink} className="font-bold hover:underline">{authorName}</Link>{' '}
          <span className="text-muted">@{post.handle} · {post.date}</span>
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
      {hasPhoto && (
        <button
          type="button"
          onClick={handlePhotoClick}
          onDoubleClick={handlePhotoDoubleClick}
          aria-label="Open photo (double-click to like)"
          className="relative mx-5 mt-3 block w-[calc(100%-2.5rem)] cursor-zoom-in select-none"
        >
          {photo}
          {burst && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-accent">
              <Heart size={96} fill="currentColor" className="heart-burst drop-shadow-lg" />
            </span>
          )}
        </button>
      )}

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
        <button onClick={handleShare} aria-label="Share post" className="ml-auto flex items-center gap-1.5 hover:text-white">
          {copied ? <span className="text-xs text-accent">Link copied</span> : <Share2 size={18} />}
        </button>
      </div>

      {viewing && <PhotoViewer post={post} onClose={() => setViewing(false)} />}
    </article>
  )
}
