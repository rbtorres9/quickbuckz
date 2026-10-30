import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { getName } from '../utils/NameHandler.js'
import Avatar from './Avatar.jsx'

// Type a name or username to find people. Results link to their profile.
// Loads everyone from GET /api/profiles/ once, then filters as you type.
// TODO: switch to a backend search endpoint if the site gets big
export default function PeopleSearch() {
  const { fetchWithToken } = useAuthContext()
  const { userCache } = useCache()
  const [query, setQuery] = useState('')
  const [everyone, setEveryone] = useState(null) // null = not loaded yet
  const [error, setError] = useState(false)

  function handleChange(e) {
    setQuery(e.target.value)
    if (everyone || error) return
    setEveryone([]) // only load once
    fetchWithToken('/api/profiles/').then((result) => {
      if (result.isError) return setError(true)
      setEveryone(result.result.results ?? result.result)
    })
  }

  const q = query.trim().toLowerCase()
  const matches = !q || !everyone ? [] : everyone
    .filter((p) => p.username !== userCache?.username) // not yourself
    .filter((p) => `${p.username} ${getName(p)}`.toLowerCase().includes(q))
    .slice(0, 8)

  return (
    <div className="mt-4">
      <label className="flex items-center gap-2 rounded-lg border border-line bg-field px-3.5 py-2.5 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Search people by name or username"
          aria-label="Search people"
          className="w-full bg-transparent text-sm text-white placeholder:text-muted/70 outline-none"
        />
      </label>

      {q && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-card">
          {error ? (
            <p className="px-5 py-4 text-sm text-red-400">Couldn't load people. Try again later.</p>
          ) : everyone?.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Searching…</p>
          ) : matches.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No one matches "{query.trim()}".</p>
          ) : (
            <ul className="divide-y divide-line">
              {matches.map((person) => {
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
          )}
        </div>
      )}
    </div>
  )
}
