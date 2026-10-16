import { useState } from 'react'
import { useStore } from '../data/store.jsx'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'

const tabs = [
  { id: 'posts', label: 'Posts' },
  { id: 'top', label: 'Top' },
  { id: 'likes', label: 'Likes' },
]

export default function UserPage() {
  const { posts, viewer, isFollowing, setIsFollowing, profile } = useStore()
  const [tab, setTab] = useState('posts')
  const [editing, setEditing] = useState(false)
  const isOwner = viewer === 'owner'

  const myPosts = posts.filter((p) => p.handle === profile.handle)
  const shown =
    tab === 'posts' ? myPosts
    : tab === 'top' ? [...myPosts].sort((a, b) => b.likes - a.likes)
    : posts.filter((p) => p.liked)

  let button
  if (isOwner) {
    button = (
      <button
        onClick={() => setEditing(true)}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-white/5"
      >
        Edit profile
      </button>
    )
  } else if (isFollowing) {
    button = (
      <button
        onClick={() => setIsFollowing(false)}
        className="mb-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300"
      >
        Following
      </button>
    )
  } else {
    button = (
      <button
        onClick={() => setIsFollowing(true)}
        className="mb-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover"
      >
        Follow
      </button>
    )
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className="mt-4 h-32 w-full rounded-2xl border border-line object-cover sm:h-40" />
        ) : (
          <div className="banner mt-4 h-32 rounded-2xl border border-line sm:h-40" />
        )}

        <div className="-mt-10 px-2 sm:px-4">
          <div className="flex items-end justify-between">
            <Avatar name={profile.name} src={profile.avatarUrl} size="lg" />
            {button}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{profile.name}</h1>
          <p className="text-sm text-muted">@{profile.handle}</p>
          {profile.bio && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">{profile.bio}</p>}
          <div className="mt-4 flex gap-5 text-sm">
            <span><b>{myPosts.length}</b> <span className="text-muted">Posts</span></span>
            <span><b>{profile.followers + (isFollowing ? 1 : 0)}</b> <span className="text-muted">Followers</span></span>
            <span><b>{profile.following}</b> <span className="text-muted">Following</span></span>
          </div>
        </div>

        <nav className="mt-6 flex border-b border-line text-sm font-medium">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 border-b-2 py-3 ${
                tab === t.id ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
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
            <p className="py-10 text-center text-sm text-muted">Nothing here yet.</p>
          )}
        </div>
      </main>

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </>
  )
}
