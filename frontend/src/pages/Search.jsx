import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { getName } from '../utils/NameHandler.js'
import { errorMessage } from '../utils/errorMessage.js'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'

// /search?q=... finds people (name or username) and posts (text or author).
// Loads everyone and all posts once, then filters as you type.
// TODO: switch to a backend search endpoint if the site gets big
export default function Search() {
  const { fetchWithToken } = useAuthContext()
  const { userCache } = useCache()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [people, setPeople] = useState(null) // null = still loading
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchWithToken('/api/profiles/'), fetchWithToken('/api/posts')]).then(([peopleResult, postsResult]) => {
      if (peopleResult.isError || postsResult.isError) {
        return setError(errorMessage(peopleResult.isError ? peopleResult.result : postsResult.result))
      }
      setPeople(peopleResult.result.results ?? peopleResult.result)
      setPosts(postsResult.result.results ?? postsResult.result)
    })
  }, [])

  // Keep the search in the address bar so Back and shared links work
  const setQuery = (q) => setParams(q ? { q } : {}, { replace: true })

  const q = query.trim().toLowerCase()
  const has = (text) => (text ?? '').toLowerCase().includes(q)

  const peopleFound = !q || !people ? [] : people
    .filter((p) => p.username !== userCache?.username)
    .filter((p) => has(p.username) || has(getName(p)))
    .slice(0, 6)

  const postsFound = !q || !posts ? [] : posts
    .filter((p) => has(p.content) || has(p.author))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 30)

  const loading = q && !error && (!people || !posts)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>

      <label className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-field px-3.5 py-3 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        <SearchIcon size={18} className="shrink-0 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people and posts"
          aria-label="Search people and posts"
          autoFocus
          className="w-full bg-transparent text-sm text-white placeholder:text-muted/70 outline-none"
        />
      </label>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!q ? (
        <p className="mt-10 text-center text-sm text-muted">Find people by name or username, or posts by what they say.</p>
      ) : loading ? (
        <p className="mt-10 text-center text-sm text-muted">Searching…</p>
      ) : peopleFound.length === 0 && postsFound.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">Nothing matches "{query.trim()}".</p>
      ) : (
        <>
          {peopleFound.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-muted">People</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                {peopleFound.map((person) => {
                  const name = getName(person) || person.username
                  return (
                    <li key={person.username}>
                      <Link to={`/user/${person.username}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5">
                        <Avatar name={name} src={person.profile_picture} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{name}</p>
                          <p className="truncate text-sm text-muted">@{person.username}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {postsFound.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-muted">Posts</h2>
              <div className="mt-2 space-y-4">
                {postsFound.map((post) => <PostCard key={post.id} post={post} />)}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
