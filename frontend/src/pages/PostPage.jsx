import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCache } from '../context/CacheContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { getName } from '../utils/NameHandler.js'
import { getTimeAgoString } from '../utils/DateTimeUtils.js'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'

export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchPostById, fetchUserProfile } = useAuthContext()
  const { userCache } = useCache()
  const { fetchWithToken } = useAuthContext()
  const [ submitting, setSubmitting ] = useState(false)

  const [ post, setPost ] = useState(null)
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
    return comment.author?.username === userCache?.username || ownsPost
  }

  function canReportComment(comment) {
    return !(canDeleteComment(comment))
  }

  async function reportComment(comment) {
    // TODO: Fill this function
    return
  }

  async function deleteComment(comment) {
    const post_id = comment.post
    const comment_id = comment.id

    setCommentStates((prev) => {return {...prev, [comment_id]: STATE_BUSY_DELETING}})
    const result = await fetchWithToken(`/api/posts/${post_id}/comment/?comment_id=${comment_id}`, { method: "DELETE" })

    if (result.isError) {
      setCommentStates((prev) => {return {...prev, [comment_id]: STATE_NORMAL}})
      setError(result.result)
      console.error(`Failed to delete comment id: ${comment_id}`)
      return
    }

    setCommentStates((prev) => {return {...prev, [comment_id]: STATE_DELETED}})
    setCommentCount((count) => count - 1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    const result = await fetchWithToken(`/api/posts/${post.id}/comment/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed.slice(0, 500) }),
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

  const ownsPost = post?.author === userCache?.handle

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
          <p className="py-16 text-center text-sm text-muted">Loading post...</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted">This post doesn't exist or was deleted.</p>
        ) : (
          <>
            <div className="mt-3">
              <PostCard post={post} user={user} full onDeleted={() => navigate('/user-page')} />
            </div>

            <section className="mt-4 rounded-2xl border border-line bg-card p-5">
              <h2 className="text-sm font-semibold">
                Comments <span className="text-muted">({commentCount})</span>
              </h2>

              <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={500}
                  placeholder="Add a comment…"
                  className="flex-1 rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
                <button type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-accent px-4 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-50"
                >
                  Post
                </button>
              </form>

              <ul className="mt-4 divide-y divide-line">
                {commentCount === 0 && (
                  <li className="py-6 text-center text-sm text-muted">No comments yet. Be the first.</li>
                )}
                {comments.map((comment) => (
                  <li key={comment.id}  className="flex gap-3 py-3">
                      <Avatar name={getName(comment.author)} size="sm" accent={false} src={comment.author.profile_picture} />
                      <div className="flex-1 text-sm">
                          <div>
                          <b>{getName(comment.author)}</b> <span className="text-muted">@{comment.author.username} · {getTimeAgoString(comment.created_at)}</span>
                          </div>
                          {/* React escapes this text automatically, so comments can't inject HTML */}
                          <p className={`mt-0.5 break-words ${getState(comment) === STATE_DELETED ? 'line-through text-white/50' : ''}`}>{comment.content}</p>
                      </div>

                      {(canDeleteComment(comment)) && (
                          getState(comment) === STATE_BUSY_DELETING ? (
                              <span className="self-start text-xs text-muted">
                                  Deleting...
                              </span>
                          ) : getState(comment) === STATE_DELETED ? (
                            <span className="self-start text-xs text-muted">
                                  Deleted
                              </span>
                          ) : (
                          <button
                              onClick={() => deleteComment(comment)}
                              className="self-start text-xs text-red-400 hover:underline"
                          >
                          Delete
                          </button>
                          )
                      )}

                      {
                        (canReportComment(comment)) && (
                          <button
                              onClick={() => reportComment(comment)}
                              className="self-start text-xs text-red-400 hover:underline"
                          >Report</button>
                        )
                      }
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
