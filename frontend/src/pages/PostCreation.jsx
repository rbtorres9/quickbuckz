import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { useCache } from '../context/CacheContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import { errorMessage } from '../utils/errorMessage.js'

const MAX_CHARS = 500
const MAX_IMAGE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default function PostCreation() {
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const { userCache } = useCache()
  const { fetchWithToken } = useAuthContext()
  const userFullName = `${userCache?.first_name ?? ''} ${userCache?.last_name ?? ''}`.trim() || userCache?.username || '?'

  const [text, setText] = useState('')
  const [image, setImage] = useState(null) // { file, url }
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)

  // Free the preview's memory when the photo is removed or the page closes
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url)
  }, [image])

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets you re-pick the same file after removing it
    if (!file) return

    // Browser-side checks for a quick, friendly message.
    // The backend must check these again, since anyone can bypass the browser.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Photos must be JPG, PNG, WebP or GIF.')
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Photos must be under ${MAX_IMAGE_MB} MB.`)
      return
    }
    setError('')
    setImage({ file, url: URL.createObjectURL(file) })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !image) {
      setError('Write something or add a photo.')
      return
    }

    if (trimmed.length > MAX_CHARS) {
      setError(`Posts must be under ${MAX_CHARS} characters.`)
      return
    }

    // Photos have to be sent as a real file upload, so use FormData (not JSON)
    const formData = new FormData()
    formData.append('content', trimmed)
    if (image) formData.append('image', image.file)

    setPosting(true)
    const data = await fetchWithToken('/api/posts/', { method: 'POST', body: formData })
    setPosting(false)

    if (Object.hasOwn(data, 'error')) {
      setError(errorMessage(data.error))
      return
    }
    navigate('/user-page') // see the new post on your profile
  }

  const remaining = MAX_CHARS - text.length
  const canPost = (text.trim() || image) && !posting

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">New post</h1>

      <form onSubmit={handleSubmit} className="mt-5 rounded-2xl border border-line bg-card p-5">
        <div className="flex gap-3">
          <Avatar name={userFullName} src={userCache?.profile_picture} />
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError('') }}
            maxLength={MAX_CHARS}
            rows={5}
            placeholder="Share a trip, a tip, or a photo…"
            className="flex-1 resize-none bg-transparent pt-1.5 text-sm leading-relaxed text-white placeholder:text-muted/70 outline-none"
            autoFocus
          />
        </div>

        {image && (
          <div className="relative mt-4">
            <img src={image.url} alt="Preview of your photo" className="max-h-96 w-full rounded-xl bg-black/30 object-contain" />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="Remove photo"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-white"
            >
              <ImagePlus size={18} /> {image ? 'Change photo' : 'Add photo'}
            </button>
            <span className={`text-xs ${remaining < 50 ? 'text-red-400' : 'text-muted'}`}>{remaining}</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canPost}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-page transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}
