import { useEffect, useState, useRef} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { useCache } from '../context/CacheContext.jsx'
import { useIsMod } from '../utils/useIsMod.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getName } from '../utils/NameHandler.js'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import { askRemovalMessage } from '../utils/removalMessage.js'
import WakingUpNote from '../components/WakingUpNote.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

function ExpandableComment({ content, deleted = false }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const textRef = useRef(null)
  const OVERFLOWING_LINE_COUNT = 10 // How many lines it takes to add a 'Show more' button

  useEffect(() => {
    const element = textRef.current
    if (!element || expanded) return

    const checkOverflow = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 20
      setOverflowing(element.scrollHeight > lineHeight * OVERFLOWING_LINE_COUNT + 1)
    }

    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(element)
    window.addEventListener('resize', checkOverflow)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', checkOverflow)
    }
  }, [content, expanded])

  return (
    <div>
      <p
        ref={textRef}
        className={`mt-0.5 break-words whitespace-pre-line ${deleted ? 'line-through text-white/50' : ''} ${!expanded ? `line-clamp-10` : ''}`}
      >
        {content}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="w-full h-8 border-1 border-accent rounded-md mt-1 text-sm font-semibold text-accent hover:text-accent-hover"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchPostById, fetchUserProfile } = useAuthContext()
  const { userCache } = useCache()
  const isMod = useIsMod() // mods can delete any comment (the backend allows it)
  const { fetchWithToken } = useAuthContext()
  const [ submitting, setSubmitting ] = useState(false)

  const [ post, setPost ] = useState(null)
  usePageTitle(post ? `@${post.author}'s post` : 'Post')
  const [ user, setUser ] = useState(null)
  const [ text, setText ] = useState('')

  const [ error, setError ] = useState(null)
  const [ loading, setLoading ] = useState(true)

  const STATE_REPORTING = "reporting"
  const STATE_REPORTED = "reported"
  const STATE_BUSY_DELETING = "deleting"
  const STATE_DELETED = "deleted"
  const STATE_NORMAL = "normal"

  const [ comments, setComments ] = useState([])
  const [ commentStates, setCommentStates ] = useState({})
  const [ commentCount, setCommentCount ] = useState(comments.length)
  // which comment's ... menu is open
  const [ openMenu, setOpenMenu ] = useState(null) // comment id, or null when closed
  const menuRef = useRef(null)

  // Close the ... menu when clicking anywhere else
  useEffect(() => {
    if (openMenu === null) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpenMenu(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true)
      setError(null)
      try {
        const postResult = await fetchPostById(id)
        if (postResult.isError) {
          setError(postResult.result)
          return
        }
        let postData = postResult.result

        setPost(postData)
        setComments(postData.comments)
        setCommentCount(postData.comments.length)

        const userResult = await fetchUserProfile(postData.author)
        if (userResult.isError) {
          setError(userResult.result)
          return
        }

        setUser(userResult.result)
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  function getState(comment) {
    return commentStates[comment.id]
  }

  function canDeleteComment(comment) {
    return comment.author?.username === userCache?.username || ownsPost || isMod
  }

  function canReportComment(comment) {
    return comment.author?.username !== userCache?.username
  }

  // HELPERS
  // what to show for each comment
  const STATUS_LABELS = {
    [STATE_BUSY_DELETING]: 'Deleting...',
    [STATE_DELETED]: 'Deleted',
    [STATE_REPORTING]: 'Reporting...',
    [STATE_REPORTED]: 'Reported',
  }

  
  function showDeleteOption(comment) {
    const state = getState(comment)
    return canDeleteComment(comment) && state !== STATE_BUSY_DELETING && state !== STATE_DELETED
  }

  function showReportOption(comment) {
    const state = getState(comment)
    const busyOrDone = [STATE_REPORTING, STATE_REPORTED, STATE_BUSY_DELETING, STATE_DELETED]
    return canReportComment(comment) && !busyOrDone.includes(state)
  }

  function deleteLabel(comment) {
    const mine = comment.author?.username === userCache?.username
    return mine || ownsPost ? 'Delete' : 'Delete (mod)'
  }


  async function reportComment(comment) {
    const reason = prompt('Why are you reporting this comment?')
    if (!reason?.trim()) return

    const comment_id = comment.id
    setCommentStates((prev) => ({ ...prev, [comment_id]: STATE_REPORTING }))

    const result = await fetchWithToken(`/api/posts/${comment.post}/report/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim(), comment_id }),
    })

    if (result.isError) {
      setCommentStates((prev) => ({ ...prev, [comment_id]: STATE_NORMAL }))
      return alert(errorMessage(result.result))
    }

    setCommentStates((prev) => ({ ...prev, [comment_id]: STATE_REPORTED }))
    alert(result.result?.detail ?? 'Thanks, this comment was reported.')
  }


  async function deleteComment(comment) {
    //  options = plain method: DELETE when author deleting their own post
    // change this to with message body when a mod act on it
    const options = { method: 'DELETE' }
    const mine = comment.author?.username === userCache?.username
    if (isMod && !mine) {
      // deletion confirmation prompt
      const message = askRemovalMessage(`Delete comment from @${comment.author.username}? This can't be undone.`)
      if (!message) return
      options.headers = { 'Content-Type': 'application/json' }
      options.body = JSON.stringify({ message })
    } else if (!confirm(`Delete comment from @${comment.author.username}? This can't be undone.`)) return


    const post_id = comment.post
    const comment_id = comment.id

    setCommentStates((prev) => {return {...prev, [comment_id]: STATE_BUSY_DELETING}})
    const result = await fetchWithToken(`/api/posts/${post_id}/comment/?comment_id=${comment_id}`, options)

    if (result.isError) { 
      // show the error without hiding the page
      setCommentStates((prev) => ({ ...prev, [comment_id]: STATE_NORMAL }))
      alert(errorMessage(result.result))
      return
    }

    setCommentStates((prev) => {return {...prev, [comment_id]: STATE_DELETED}})
    setCommentCount((count) => count - 1)
  }

  const MAX_CHARS = 500
  const remaining = MAX_CHARS - text.length

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    const result = await fetchWithToken(`/api/posts/${post.id}/comment/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed.slice(0, MAX_CHARS) }),
    })
    setSubmitting(false)

    if (result.isError) {
      console.error('Failed to post comment:', errorMessage(result.result))
      return
    }

    setComments((prev) => [...prev, result.result])
    setCommentCount((count) => count + 1)
    setText('')
  }

  const ownsPost = post?.author === userCache?.username

  // where a commenter's name/photo links to (same rule as PostCard)
  const profileLinkFor = (username) =>
    username === userCache?.username ? '/user-page' : `/user/${username}`

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24">
        <button
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home'))}
          className="mt-4 flex w-fit items-center gap-1 text-sm text-muted hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </button>

        { loading ? (
          <div className="py-16 text-center text-sm text-muted">Loading post...<WakingUpNote /></div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted">This post is from a private profile, doesn't exist or was deleted.</p>
        ) : (
          <>
            <div className="mt-3">
              <PostCard post={post} user={user} full onDeleted={() => navigate('/user-page')} />
            </div>

            <section className="mt-4 rounded-2xl border border-line bg-card p-5">
              <h2 className="text-sm font-semibold">
                Comments <span className="text-muted">({commentCount})</span>
              </h2>

              <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add a comment…"
                  aria-label="Add a comment"
                  className="min-w-0 min-h-10 w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                  maxLength={MAX_CHARS}
                  rows={3}
                  autoFocus
                />
                <div className='flex items-center gap-2'>
                  <button type="submit"
                    disabled={submitting}
                    className="h-8 w-20 rounded-lg bg-accent px-4 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-50"
                  >
                    Post
                  </button>
                  <span className={`text-xs ${remaining < 50 ? 'text-red-400' : 'text-muted'}`}>{remaining}</span>
                </div>
              </form>

              <ul className="mt-4 divide-y divide-line">
                {commentCount === 0 && (
                  <li className="py-6 text-center text-sm text-muted">No comments yet. Be the first.</li>
                )}
                {comments.map((comment) => (
                  <li key={comment.id}  className="flex gap-3 py-3">
                      {/* photo and name link to the commenter's profile */}
                      <Link to={profileLinkFor(comment.author.username)} className="shrink-0" tabIndex={-1} aria-hidden="true">
                        <Avatar name={getName(comment.author)} size="sm" accent={false} src={comment.author.profile_picture} />
                      </Link>
                      <div className="min-w-0 flex-1 text-sm">{/* min-w-0 lets long words wrap on phones */}
                          <div>
                            <Link to={profileLinkFor(comment.author.username)} className="font-bold hover:underline">{getName(comment.author)}</Link>{' '}
                            <span className="text-muted">@{comment.author.username} · {getTimeAgoString(comment.created_at)}</span>
                          </div>

                          {/* React escapes this text automatically, so comments can't inject HTML */}
                          <ExpandableComment
                            content={comment.content}
                            deleted={getState(comment) === STATE_DELETED}
                          />
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        {STATUS_LABELS[getState(comment)] && (
                          <span className="pt-1 text-xs text-muted">{STATUS_LABELS[getState(comment)]}</span>
                        )}

                        {(showDeleteOption(comment) || showReportOption(comment)) && (
                          <div className="relative" ref={openMenu === comment.id ? menuRef : null}>
                            <button
                              onClick={() => setOpenMenu(openMenu === comment.id ? null : comment.id)}
                              className="rounded-md px-1.5 py-0.5 text-muted hover:bg-white/5"
                              aria-label="Comment options"
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {openMenu === comment.id && (
                              <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-lg border border-line bg-field text-sm shadow-xl">
                                {showReportOption(comment) && (
                                  <button
                                    onClick={() => { setOpenMenu(null); reportComment(comment) }}
                                    className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5"
                                  >
                                    Report
                                  </button>
                                )}
                                {showDeleteOption(comment) && (
                                  <button
                                    onClick={() => { setOpenMenu(null); deleteComment(comment) }}
                                    className="block w-full px-3 py-2 text-left text-red-400 hover:bg-white/5"
                                  >
                                    {deleteLabel(comment)}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  )
}