import { Link } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import { useStore } from '../data/store.jsx'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import { useEffect, useMemo, useState } from 'react'

import { useApiContext } from '../context/ApiContext.jsx'

export default function Home() {
  const { profile, following } = useStore()
  const { fetchPosts } = useApiContext()
  const [posts, setPosts] = useState([])

  const sortFilterPosts = (posts) => {
    return [...posts]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  useEffect(() => {
    const fetchData = async () => {
      const result = await fetchPosts()

      if (!result.isError) {
        let newPosts = sortFilterPosts(result.result)
        setPosts(newPosts)
      } else {
        setPosts([])
      }
    }

    fetchData()
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="sr-only">Home</h1>

      <Link
        to="/post-creation"
        className="flex items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4 transition hover:border-accent/40"
      >
        <Avatar name={profile.name} src={profile.avatarUrl} />
        <span className="flex-1 text-sm text-muted">Share a trip, a tip, or a photo…</span>
        <ImagePlus size={18} className="text-muted" />
      </Link>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Latest from people you follow</h2>
        <Link to="/subscriptions" className="text-xs text-muted hover:text-accent">
          Following {following.length}
        </Link>
      </div>

      <div className="mt-3 space-y-4">
        {posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
            <p className="font-medium">Your feed is empty</p>
            <p className="mt-1 text-sm text-muted">Follow people to see their latest posts here.</p>
          </div>
        )}
      </div>
    </main>
  )
}
