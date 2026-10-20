import { useState, useEffect } from 'react'
import { useStore } from '../data/store.jsx'
import PostCard from '../components/PostCard.jsx'
import { useApiContext } from '../context/ApiContext.jsx'
import { getTimeDiffSecs } from '../utils/DateTimeUtils.js'

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
  const { fetchPosts } = useApiContext()
  const [ posts, setPosts ] = useState([])
  const [time, setTime] = useState('week')
  const [type, setType] = useState('all')

  const range = timeOptions.find((o) => o.value === time).ms

  /*
  // Most-liked posts that match the filters. TODO: get this ranking from the backend
  const top = posts
    .filter((p) => Date.now() - p.createdAt < range)
    .filter((p) => type === 'all' || (type === 'photos' ? hasPhoto(p) : !hasPhoto(p)))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 20)
  
    const [posts, setPosts] = useState([])
  */

  useEffect(() => {
    const fetchData = async () => {
      const result = await fetchPosts()

      if (!result.isError) {
        setPosts(result.result)
      } else {
        setPosts([])
      }
    }

    fetchData()
  }, [])
    
  const top = [...posts]
      .filter((p) => getTimeDiffSecs(p.created_at) < range)
      .filter((p) => type === 'all' || (type === 'photos' ? hasPhoto(p) : !hasPhoto(p)))
      .sort((a, b) => b.likes_count - a.likes_count)
      .slice(0, 20)

  console.log(posts, top)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Top posts</h1>
      <p className="mt-1 text-sm text-muted">The most-liked posts on QuickBuckz.</p>

      <div className="mt-5 space-y-3 rounded-2xl border border-line bg-card p-4">
        <Pills label="When" options={timeOptions} value={time} onChange={setTime} />
        <Pills label="Type" options={typeOptions} value={type} onChange={setType} />
      </div>

      <div className="mt-5 space-y-4">
        {top.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {top.length === 0 && <p className="py-10 text-center text-sm text-muted">No posts match these filters.</p>}
    </main>
  )
}
