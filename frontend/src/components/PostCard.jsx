import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react'
import { useCache } from '../context/CacheContext.jsx'
import { useApiContext } from '../context/ApiContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getTimeAgoString, getDateTimeString } from '../utils/DateTimeUtils.js'
import { errorMessage } from '../utils/errorMessage.js'
import { useIsMod } from '../utils/useIsMod.js'
import Avatar from './Avatar.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import { askRemovalMessage } from '../utils/removalMessage.js'

// One post from the database (content, image, created_at, author = username).
// `user` is the author's profile. If a page doesn't pass it, the card loads it itself.

// Each author's profile is loaded once and shared by all their posts
const authorProfiles = {}

export default function PostCard({ post, user, full = false, onDeleted }) {
  const { userCache } = useCache()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [viewing, setViewing] = useState(false) // full-screen photo open?
  const [burst, setBurst] = useState(false) // heart animation showing?
  const [copied, setCopied] = useState(false) // "Link copied" showing?
  const clickTimer = useRef(null)
  const { fetchUserProfile } = useApiContext()
  const { fetchWithToken } = useAuthContext()
  const isMod = useIsMod() // mods can delete anyone's post
  const [loadedAuthor, setLoadedAuthor] = useState(null)
  const [deleted, setDeleted] = useState(false) // hides the card after you delete it
  const [ isLiked, setIsLiked ] = useState(post.is_liked)
  const [ likesCount, setLikesCount ] = useState(post.likes_count)
  const likeBusy = useRef(false) // ignore extra clicks while a like is saving
  const [content, setContent] = useState(post.content) // changes after you edit the post
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [editError, setEditError] = useState('')

  const handle = post.author

  // Load the author's name and photo when the page didn't pass them in
  useEffect(() => {
    if (user) return
    authorProfiles[handle] ??= fetchUserProfile(handle)
    authorProfiles[handle].then((res) => { if (!res.isError) setLoadedAuthor(res.result) })
  }, [user, handle])
  user = user ?? loadedAuthor
  const isMine = handle === userCache?.username
  const profileLink = isMine ? '/user-page' : `/user/${handle}`

  const authorName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || handle
  const avatar = user?.profile_picture
  const text = content
  const photoUrl = post.image
  const comments = post.comments_count

  // Close the ⋯ menu when clicking anywhere else, or pressing Esc
  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Edit your own post's text (only the author can, the backend checks too)
  function startEditing() {
    setMenuOpen(false)
    setDraft(content ?? '')
    setEditError('')
    setEditing(true)
  }
  async function saveEdit() {
    const trimmed = draft.trim()
    if (!trimmed) return setEditError("A post can't be empty.")
    const result = await fetchWithToken(`/api/posts/${post.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    })
    if (result.isError) return setEditError(errorMessage(result.result))
    setContent(result.result.content)
    setEditing(false)
  }

  // Delete your own post. Real posts are deleted on the backend (only the author or a mod can).
  async function handleDelete() {
    setMenuOpen(false)
    const whose = isMine ? 'this post' : `@${handle}'s post`
    //  options = plain method: DELETE when author deleting their own post
    // change this to with message body when a mod act on it
    const options = { method: 'DELETE' }
    if (!isMine && isMod) {
      // deletion confirmation prompt
      const message = askRemovalMessage(`Delete ${whose}? This can't be undone.`)
      if (!message) return
      options.headers = { 'Content-Type': 'application/json' }
      options.body = JSON.stringify({ message })
    } 
    else if (!confirm(`Delete ${whose}? This can't be undone.`)) return

    const result = await fetchWithToken(`/api/posts/${post.id}/`, options)
    if (result.isError) return alert(errorMessage(result.result))
    setDeleted(true)
    onDeleted?.()
  }

  // Report: ask why, then send it to the moderators' list
  // send report to the backend
  async function handleReport() {
    setMenuOpen(false)

    const reason = prompt('Why are you reporting this post?')
    if (!reason?.trim()) return

    const result = await fetchWithToken(`/api/posts/${post.id}/report/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    if (result.isError) return alert(errorMessage(result.result))
    alert(result.result?.detail ?? 'Thanks, this post was reported.')
  }

  // Block the author. Every post of theirs on this page hides (see the listener below).
  // TODO (backend): POST /api/profile/<username>/block/ (same as the profile page)
  async function handleBlock() {
    setMenuOpen(false)
    if (!confirm(`Block @${handle}? They won't be able to see your profile or posts, and you'll stop following each other.`)) return

    const result = await fetchWithToken(`/api/profile/${handle}/block/`, { method: 'POST' })
    if (result.isError) return alert(errorMessage(result.result))
    window.dispatchEvent(new CustomEvent('user-blocked', { detail: handle }))
    onDeleted?.() // the post page leaves; profile lists drop it
  }

  // Someone was blocked: hide this card if it's theirs
  useEffect(() => {
    const hide = (e) => { if (e.detail === handle) setDeleted(true) }
    window.addEventListener('user-blocked', hide)
    return () => window.removeEventListener('user-blocked', hide)
  }, [handle])

  // Click a photo: open it full-screen. Double-click: like it with a heart burst.
  // (A double-click also fires a click, so we wait a moment to see which it was.)
  function handlePhotoClick() {
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => setViewing(true), 250)
  }

  // Like = POST, Unlike = DELETE. The heart changes right away; if saving fails it goes back.
  async function toggleLike(post) {
    if (likeBusy.current) return
    likeBusy.current = true
    const wasLiked = isLiked
    const oldCount = likesCount

    setIsLiked(!wasLiked)
    setLikesCount(oldCount + (wasLiked ? -1 : 1))

    const result = await fetchWithToken(`/api/posts/${post.id}/like`, { method: wasLiked ? "DELETE" : "POST" })
    likeBusy.current = false
    if (result.isError) {
      setIsLiked(wasLiked)
      setLikesCount(oldCount)
    }
  }

  function handlePhotoDoubleClick() {
    clearTimeout(clickTimer.current)
    if (!isLiked) toggleLike(post)
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

  if (deleted) return null

  const photo = (
    <img src={photoUrl} alt="" className={`w-full rounded-xl bg-black/30 object-contain ${full ? 'max-h-[32rem]' : 'max-h-96'}`} />
  )

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to={profileLink} className="shrink-0" tabIndex={-1} aria-hidden="true">
          <Avatar name={authorName} src={avatar} />
        </Link>
        <div className="flex-1 text-sm">
          <Link to={profileLink} className="font-bold hover:underline">{authorName}</Link>{' '}
          <span className="text-muted">
            @{handle} ·{' '}
            <span title={getDateTimeString(post.created_at)}>{getTimeAgoString(post.created_at)}</span>
          </span>
        </div>
        {/* Your posts: Edit and Delete. Anyone else's: Report, Block (plus Delete for mods). */}
        {(
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-md px-2 py-1 text-muted hover:bg-white/5"
              aria-label="Post options"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-field text-sm shadow-xl">
                {isMine ? (
                  <>
                    <button onClick={startEditing} className="block w-full px-3 py-2 text-left hover:bg-white/5">
                      Edit
                    </button>
                    <button onClick={handleDelete} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleReport}
                      className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5"
                    >
                      Report
                    </button>
                    <button onClick={handleBlock} className="block w-full truncate px-3 py-2 text-left text-red-400 hover:bg-white/5">
                      Block @{handle}
                    </button>
                    {isMod && (
                      <button onClick={handleDelete} className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5">
                        Delete (mod)
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="px-5 pt-3">
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setEditError('') }}
            rows={3}
            autoFocus
            aria-label="Edit post"
            className="w-full resize-none rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          {editError && <p className="mt-1 text-sm text-red-400">{editError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-white/5">
              Cancel
            </button>
            <button onClick={saveEdit} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-page hover:bg-accent-hover">
              Save
            </button>
          </div>
        </div>
      ) : (
        text && <p className="whitespace-pre-line break-words px-5 pt-3 text-sm leading-relaxed">{text}</p>
      )}
      {photoUrl && (
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
        {(
          <>
            <span className="flex items-center gap-1.5"><button
              onClick={() => toggleLike(post)}
              aria-label={`${isLiked ? 'Unlike' : 'Like'} post, ${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`}
              aria-pressed={isLiked}
              className={`flex items-center gap-1.5 hover:text-white ${isLiked ? 'text-accent' : ''}`}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} /> {likesCount}
            </button>
            </span>
            <span className="flex items-center gap-1.5">
              <Link
                to={`/post/${post.id}`}
                aria-label={`${comments} ${comments === 1 ? 'comment' : 'comments'}, open post`}
                className="flex items-center gap-1.5 hover:text-white"
              >
                <MessageCircle size={18} /> {comments}
              </Link>
            </span>
            <button onClick={handleShare} aria-label="Share post" className="ml-auto flex items-center gap-1.5 hover:text-white">
              {copied ? <span className="text-xs text-accent">Link copied</span> : <Share2 size={18} />}
            </button>
          </>
        )}
      </div>

      {viewing && <PhotoViewer post={{ imageUrl: photoUrl }} onClose={() => setViewing(false)} />}
    </article>
  )
}
