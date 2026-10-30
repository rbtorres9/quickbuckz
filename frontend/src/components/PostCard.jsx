import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react'
import { useStore } from '../data/store.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { useApiContext } from '../context/ApiContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getTimeAgoString, getDateTimeString } from '../utils/DateTimeUtils.js'
import Avatar from './Avatar.jsx'
import PhotoViewer from './PhotoViewer.jsx'

// Shows two kinds of post:
//  - real posts from the database (they have created_at, content, author = username)
//  - sample posts from store.jsx (they have date, text, handle)
// `user` is the author's profile. If a page doesn't pass it, the card loads it itself.

// Each author's profile is loaded once and shared by all their posts
const authorProfiles = {}

export default function PostCard({ post, user, full = false, onDeleted }) {
  const { deletePost, profile, addReport } = useStore()
  const { userCache } = useCache()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [viewing, setViewing] = useState(false) // full-screen photo open?
  const [burst, setBurst] = useState(false) // heart animation showing?
  const [copied, setCopied] = useState(false) // "Link copied" showing?
  const clickTimer = useRef(null)
  const { fetchUserProfile } = useApiContext()
  const { fetchWithToken } = useAuthContext()
  const [loadedAuthor, setLoadedAuthor] = useState(null)
  const [ isLiked, setIsLiked ] = useState(post.is_liked)
  const [ likesCount, setLikesCount ] = useState(post.likes_count)

  const isReal = 'created_at' in post
  const handle = isReal ? post.author : post.handle

  // Load the author's name and photo when the page didn't pass them in
  useEffect(() => {
    if (!isReal || user) return
    authorProfiles[handle] ??= fetchUserProfile(handle)
    authorProfiles[handle].then((res) => { if (!res.isError) setLoadedAuthor(res.result) })
  }, [isReal, user, handle])
  user = user ?? loadedAuthor
  const isMine = handle === (userCache?.username ?? profile.handle)
  const profileLink = isMine ? '/user-page' : `/user/${handle}`

  let authorName = post.author
  if (isReal) authorName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || handle
  else if (isMine) authorName = profile.name
  const avatar = isReal ? user?.profile_picture : isMine ? profile.avatarUrl : null

  const text = isReal ? post.content : post.text
  const photoUrl = isReal ? post.image : post.imageUrl // real photo address, if any
  const gradient = isReal ? null : post.image // sample posts use a color placeholder
  const likes = isReal ? post.likes_count : post.likes
  const comments = isReal ? post.comments_count : post.comments.length

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

  // Report: ask why, then send it to the moderators' list
  function handleReport() {
    setMenuOpen(false)
    const reason = prompt('Why are you reporting this post?')
    if (!reason?.trim()) return
    // TODO: send to a backend Reports endpoint instead of the sample list
    addReport({ postId: post.id, isReal, author: handle, text, reason: reason.trim(), reportedBy: userCache?.username ?? profile.handle })
    alert('Thanks, this post was reported.')
  }

  // Click a photo: open it full-screen. Double-click: like it with a heart burst.
  // (A double-click also fires a click, so we wait a moment to see which it was.)
  function handlePhotoClick() {
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => setViewing(true), 250)
  }

  async function toggleLike(post) {
    let options = {
      method: "POST"
    }

    if (isLiked) {
      options.method = "DELETE"
      setLikesCount(likesCount - 1)
    }
    else {
      setLikesCount(likesCount + 1)
    }

    setIsLiked(!isLiked)
    fetchWithToken(`/api/posts/${post.id}/like`, options)
  }

  function handlePhotoDoubleClick() {
    clearTimeout(clickTimer.current)
    if (isReal) return setViewing(true) // TODO: like real posts with POST /api/posts/{id}/like/
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

  const photo = photoUrl ? (
    <img src={photoUrl} alt="" className={`w-full rounded-xl bg-black/30 object-contain ${full ? 'max-h-[32rem]' : 'max-h-96'}`} />
  ) : (
    <div className={`${gradient} rounded-xl ${full ? 'h-72' : 'h-56'}`} />
  )

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to={profileLink} className="shrink-0">
          <Avatar name={authorName} src={avatar} />
        </Link>
        <div className="flex-1 text-sm">
          <Link to={profileLink} className="font-bold hover:underline">{authorName}</Link>{' '}
          <span className="text-muted">
            @{handle} ·{' '}
            {isReal ? <span title={getDateTimeString(post.created_at)}>{getTimeAgoString(post.created_at)}</span> : post.date}
          </span>
        </div>
        {/* Real posts: Report only for now. TODO: Edit/Delete for your own real posts */}
        {(!isReal || !isMine) && (
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
                {isMine && !isReal ? (
                  <>
                    <button className="block w-full px-3 py-2 text-left hover:bg-white/5">Edit</button>
                    <button onClick={handleDelete} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReport}
                    className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5"
                  >
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {text && <p className="whitespace-pre-line break-words px-5 pt-3 text-sm leading-relaxed">{text}</p>}
      {(photoUrl || gradient) && (
        <button
          type="button"
          onClick={handlePhotoClick}
          onDoubleClick={handlePhotoDoubleClick}
          aria-label="Open photo"
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
        {isReal ? (
          <>
            <span className="flex items-center gap-1.5"><button
              onClick={() => toggleLike(post)}
              className={`flex items-center gap-1.5 hover:text-white ${isLiked ? 'text-accent' : ''}`}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} /> {likesCount}
            </button>
            </span>
            <span className="flex items-center gap-1.5">
              <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 hover:text-white">
                <MessageCircle size={18} /> {comments}
              </Link>
            </span>
          </>
        ) : (
          <>
            <button
              onClick={() => {}}
              className={`flex items-center gap-1.5 hover:text-white ${post.liked ? 'text-accent' : ''}`}
            >
              <Heart size={18} fill={post.liked ? 'currentColor' : 'none'} /> {likes}
            </button>
            <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 hover:text-white">
              <MessageCircle size={18} /> {comments}
            </Link>
            <button onClick={handleShare} aria-label="Share post" className="ml-auto flex items-center gap-1.5 hover:text-white">
              {copied ? <span className="text-xs text-accent">Link copied</span> : <Share2 size={18} />}
            </button>
          </>
        )}
      </div>

      {viewing && <PhotoViewer post={{ ...post, imageUrl: photoUrl, image: gradient }} onClose={() => setViewing(false)} />}
    </article>
  )
}
