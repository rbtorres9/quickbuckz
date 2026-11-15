import { Link } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import { useEffect, useState } from 'react'
import Logo from '../components/Logo.jsx'

import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { getName } from '../utils/NameHandler.js'
import WakingUpNote from '../components/WakingUpNote.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

export default function Home() {
  usePageTitle('Home')
  const { fetchWithToken, fetchPosts } = useAuthContext()
  const { userCache } = useCache()
  const [ posts, setPosts ] = useState([])
  const [ error, setError ] = useState(null)
  const [ loading, setLoading ] = useState(true)

  // Only people you follow (and you), newest first
  const sortFilterPosts = (posts, followed) => {
    return posts
      .filter((p) => followed.includes(p.author) || p.author === userCache?.username)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  useEffect(() => {
    const fetchData = async () => {
      // Load posts and the list of people you follow at the same time
      const [result, followingResult] = await Promise.all([
        fetchPosts(),
        fetchWithToken('/api/profile/me/following/'),
      ])

      if (result.isError || followingResult.isError) {
        setError(result.isError ? result.result : followingResult.result)
      } else {
        const list = followingResult.result.results ?? followingResult.result
        setPosts(sortFilterPosts(result.result, list.map((person) => person.username)))
      }

      setLoading(false)
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
        <Avatar name={getName(userCache) || userCache?.username || '?'} src={userCache?.profile_picture} />
        <span className="flex-1 text-sm text-muted">Share a trip, a tip, or a photo…</span>
        <ImagePlus size={18} className="text-muted" />
      </Link>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Latest from people you follow</h2>
        <Link to="/subscriptions" className="text-xs text-muted hover:text-accent">
          Following {userCache?.following_count ?? 0}
        </Link>
      </div>

      <div className="mt-3 space-y-4">
        {
          loading ? (
            <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <p className="font-medium">Loading posts...</p>
              <WakingUpNote />
              <div className="relative mt-7 h-14">
                <div className='dog-run'>
                  <Logo size={56} className={`text-accent ${'animate-bounce'}`} />
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <p className="font-medium">Error fetching posts</p>
            </div>
          ) : posts.length > 0 ? (
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
