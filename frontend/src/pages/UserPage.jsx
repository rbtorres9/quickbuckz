import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore, sampleUsers } from '../data/store.jsx'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'

// /user-page shows your own profile; /user/:handle shows anyone's.
export default function UserPage() {
  const { handle } = useParams()
  const { posts, viewer, isFollowing, setIsFollowing, profile, following, toggleFollowUser } = useStore()
  const [tab, setTab] = useState('posts')
  const [editing, setEditing] = useState(false)

  const isSelf = !handle || handle === profile.handle
  // TODO: load other users' profiles from the backend database
  const person = isSelf ? profile : sampleUsers[handle]

  if (!person) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">User not found</h1>
        <p className="mt-2 text-sm text-muted">There's no one here with the username @{handle}.</p>
        <Link to="/subscriptions" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">
          Back to Following
        </Link>
      </main>
    )
  }

  const canEdit = isSelf && viewer === 'owner'
  // Your own profile: "visitor" view uses the demo follow. Anyone else: your real following list.
  const followed = isSelf ? isFollowing : following.includes(person.handle)
  const toggleFollow = () => (isSelf ? setIsFollowing(!isFollowing) : toggleFollowUser(person.handle))

  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'top', label: 'Top' },
    ...(isSelf ? [{ id: 'likes', label: 'Likes' }] : []), // likes are private to you
  ]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'posts'

  const theirPosts = posts.filter((p) => p.handle === person.handle)
  const shown =
    activeTab === 'posts' ? theirPosts
    : activeTab === 'top' ? [...theirPosts].sort((a, b) => b.likes - a.likes)
    : posts.filter((p) => p.liked)

  let button
  if (canEdit) {
    button = (
      <button
        onClick={() => setEditing(true)}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5"
      >
        Edit profile
      </button>
    )
  } else if (followed) {
    button = (
      <button
        onClick={toggleFollow}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300"
      >
        Following
      </button>
    )
  } else {
    button = (
      <button
        onClick={toggleFollow}
        className="mb-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover"
      >
        Follow
      </button>
    )
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24">
        {person.bannerUrl ? (
          <img src={person.bannerUrl} alt="" className="mt-4 h-32 w-full rounded-2xl border border-line object-cover sm:h-40" />
        ) : (
          <div className="banner mt-4 h-32 rounded-2xl border border-line sm:h-40" />
        )}

        <div className="-mt-10 px-2 sm:px-4">
          <div className="flex items-end justify-between">
            <Avatar name={person.name} src={person.avatarUrl} size="lg" />
            {button}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{person.name}</h1>
          <p className="text-sm text-muted">@{person.handle}</p>
          {person.bio && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">{person.bio}</p>}
          <div className="mt-4 flex gap-5 text-sm">
            <span><b>{theirPosts.length}</b> <span className="text-muted">Posts</span></span>
            <span><b>{person.followers + (followed ? 1 : 0)}</b> <span className="text-muted">Followers</span></span>
            {isSelf ? (
              <Link to="/subscriptions" className="hover:underline">
                <b>{following.length}</b> <span className="text-muted">Following</span>
              </Link>
            ) : (
              <span><b>{person.following}</b> <span className="text-muted">Following</span></span>
            )}
          </div>
        </div>

        <nav className="mt-6 flex border-b border-line text-sm font-medium">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 border-b-2 py-3 ${
                activeTab === t.id ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-4 space-y-4">
          {shown.length ? (
            shown.map((p) => <PostCard key={p.id} post={p} />)
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              {isSelf ? 'Nothing here yet.' : `${person.name} hasn't posted yet.`}
            </p>
          )}
        </div>
      </main>

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </>
  )
}
