import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useStore, sampleUser } from '../data/store.jsx'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'

export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { posts, viewer, addComment, deleteComment } = useStore()
  const [text, setText] = useState('')

  const post = posts.find((p) => p.id === Number(id))
  const ownsPost = viewer === 'owner' && post?.handle === sampleUser.handle

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    addComment(post.id, trimmed.slice(0, 500)) // cap length; the backend should enforce this too
    setText('')
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pb-24">
        <Link to="/user-page" className="mt-4 flex w-fit items-center gap-1 text-sm text-muted hover:text-white">
          <ArrowLeft size={16} /> Back to profile
        </Link>

        {!post ? (
          <p className="py-16 text-center text-sm text-muted">This post doesn't exist or was deleted.</p>
        ) : (
          <>
            <div className="mt-3">
              <PostCard post={post} full onDeleted={() => navigate('/user-page')} />
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
                <button className="rounded-lg bg-accent px-4 text-sm font-semibold text-page hover:bg-accent-hover">
                  Post
                </button>
              </form>

              <ul className="mt-4 divide-y divide-line">
                {post.comments.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted">No comments yet. Be the first.</li>
                )}
                {post.comments.map((c) => (
                  <li key={c.id} className="flex gap-3 py-3">
                    <Avatar name={c.name} size="sm" accent={false} />
                    <div className="flex-1 text-sm">
                      <div>
                        <b>{c.name}</b> <span className="text-muted">@{c.handle} · {c.time}</span>
                      </div>
                      {/* React escapes this text automatically, so comments can't inject HTML */}
                      <p className="mt-0.5 break-words">{c.text}</p>
                    </div>
                    {(c.mine || ownsPost) && (
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
