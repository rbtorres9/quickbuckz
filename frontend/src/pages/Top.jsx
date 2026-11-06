import { useState, useEffect, useCallback } from 'react'
import PostCard from '../components/PostCard.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getTimeDiffSecs } from '../utils/DateTimeUtils.js'
import Logo from '../components/Logo.jsx'

const DAY = 24 * 60 * 60

const timeOptions = [
  { value: 'day', label: 'Today', ms: DAY },
  { value: 'week', label: 'This week', ms: 7 * DAY },
  { value: 'month', label: 'This month', ms: 30 * DAY },
  { value: 'all', label: 'All time', ms: Infinity },
]

const typeOptions = [
  { value: 'all', label: 'All posts' },
  { value: 'photos', label: 'Photos' },
  { value: 'text', label: 'Text only' },
]

const sortMethodOptions = [
  { value: 'likes', label: 'Likes' },
  { value: 'comments', label: 'Comments'},
  { value: 'recency', label: 'Recency'}
]

const hasPhoto = (p) => Boolean(p.image)

function Pills({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="w-12 text-xs font-medium text-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            value === o.value ? 'border-accent bg-accent text-page font-semibold' : 'border-line text-muted hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Top() {
  const { fetchPosts } = useAuthContext()

  const [time, setTime] = useState('week')
  const [type, setType] = useState('all')
  const [sortMethod, setSortMethod] = useState('likes')

  const [error, setError] = useState(null)
  const [ filtering, setFiltering ] = useState(true)
  const [ loading, setLoading ] = useState(true)

  const [ posts, setPosts ] = useState([])
  const [ feed, setFeed ] = useState([])

  const range = timeOptions.find((o) => o.value === time).ms

  useEffect(() => {
    if (loading)
      return
    
    setFeed(
        [...posts]
          .filter((p) => getTimeDiffSecs(p.created_at) < range)
          .filter((p) => type === 'all' || (type === 'photos' ? hasPhoto(p) : !hasPhoto(p)))
          .sort((a, b) =>
            (sortMethod === 'likes' && b.likes_count - a.likes_count) ||
            (sortMethod === 'comments' && b.comments_count - a.comments_count) ||
            (sortMethod === 'recency' && b.created_at - a.created_at)
          )
          .slice(0, 20)
    )

    setFiltering(false)
  }, [posts, time, type, sortMethod, loading])

  useEffect(() => {
    const fetchData = async () => {
      const result = await fetchPosts()

      if (!result.isError) {
        setPosts(result.result)
      } else {
        setError(result.result)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Top posts</h1>
      <p className="mt-1 text-sm text-muted">The most-liked posts on QuickBuckz.</p>

      <div className="mt-5 space-y-3 rounded-2xl border border-line bg-card p-4">
        <Pills label="When" options={timeOptions} value={time} onChange={setTime} />
        <Pills label="Type" options={typeOptions} value={type} onChange={setType} />
        <Pills label="Sort" options={sortMethodOptions} value={sortMethod} onChange={setSortMethod} />
      </div>

      {
        filtering || loading ? (
          <>
            <p className="font-medium text-center mt-3">Loading posts...</p>
            <div className="relative mt-7 h-14">
              <div className='dog-run'>
                <Logo size={56} className={`text-accent ${'animate-bounce'}`} />
              </div>
            </div>
          </>
        ) : error ? (
          <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
            <p className="font-medium">Error fetching posts</p>
          </div>
        ) : feed.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No posts match these filters.</p>
        ) : <div className="mt-5 space-y-4">
          {feed.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      }
    </main>
  )
}
