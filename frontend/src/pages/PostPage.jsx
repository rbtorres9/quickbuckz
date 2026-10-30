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

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchPostById(id)
        if (result.isError) {
          setError(result.result)
          return
        }
        setPost(result.result)

        const userResult = await fetchUserProfile(result.result.author)
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

  const ownsPost = post?.author === userCache?.handle

  async function deleteComment(post_id, comment_id) {

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

    setPost((prev) => ({ ...prev, comments: [...prev.comments, result.result] }))
    setText('')
  }


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
                Comments <span className="text-muted">({post.comments.length})</span>
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
                {post.comments.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted">No comments yet. Be the first.</li>
                )}
                {post.comments.map((c) => (
                  <li key={c.id} className="flex gap-3 py-3">
                    <Avatar name={getName(c.author)} size="sm" accent={false} src={c.author.profile_picture} />
                    <div className="flex-1 text-sm">
                      <div>
                        <b>{getName(c.author)}</b> <span className="text-muted">@{c.author.username} · {getTimeAgoString(c.created_at)}</span>
                      </div>
                      {/* React escapes this text automatically, so comments can't inject HTML */}
                      <p className="mt-0.5 break-words">{c.content}</p>
                    </div>
                    {((c.author?.username === userCache?.username) || ownsPost) && (
                      <button
                        onClick={() => deleteComment(post.id, c.id)}
                        className="self-start text-xs text-muted hover:text-red-400"
                      >
                        Delete
                      </button>
                    )}
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
