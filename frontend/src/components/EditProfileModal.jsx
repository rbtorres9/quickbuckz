import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { useCache } from '../context/CacheContext.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import ThemePicker from './ThemePicker.jsx'
import { useStore } from '../data/store.jsx'
import { getTheme, themeVars } from '../data/themes.js'
import { errorMessage } from '../utils/errorMessage.js'

const MAX_NAME = 50
const MAX_BIO = 160
const MAX_IMAGE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default function EditProfileModal({ onClose }) {
  const { userCache, setUserCache } = useCache()
  const { fetchWithToken } = useAuthContext()
  const { profile, updateProfile } = useStore()
  const [firstName, setFirstName] = useState(userCache?.first_name ?? '')
  const [lastName, setLastName] = useState(userCache?.last_name ?? '')

  // The photo preview uses the name as you type it
  const userFullName = `${firstName} ${lastName}`.trim() || userCache?.username || '?'
  const [bio, setBio] = useState(userCache?.bio ?? '')
  const [profilePicture, setProfilePicture] = useState(userCache?.profile_picture)
  const [selectedProfilePicture, setSelectedProfilePicture] = useState(null)
  const [bannerUrl, setBannerUrl] = useState(userCache?.banner)
  const [selectedBanner, setSelectedBanner] = useState(null)
  const [leftPictureUrl, setLeftPictureUrl] = useState(null)
  const [selectedLeftPicture, setSelectedLeftPicture] = useState(null)
  const [rightPictureUrl, setRightPictureUrl] = useState(null)
  const [selectedRightPicture, setSelectedRightPicture] = useState(null)

  


  // Profile theme. Saved on this device for now: the backend has no theme field yet.
  const [theme, setTheme] = useState(profile.theme)
  const [flipLeft, setFlipLeft] = useState(false)
  const [tileLeft, setTileLeft] = useState(false)
  const [flipRight, setFlipRight] = useState(false)
  const [tileRight, setTileRight] = useState(false)

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const avatarInput = useRef(null)
  const bannerInput = useRef(null)
  const leftPictureInput = useRef(null)
  const rightPictureInput = useRef(null)
  const created = useRef([]) // preview URLs made while this editor was open

  // Close with the Escape key, and stop the page behind from scrolling
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && cancel()
    document.addEventListener('keydown', onKey)
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = oldOverflow
    }
  })

  function pickImage(e, setUrl, setFile) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Browser-side checks for a friendly message. The backend must check these too.
    if (!ALLOWED_TYPES.includes(file.type)) return setError('Photos must be JPG, PNG, WebP or GIF.')
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError(`Photos must be under ${MAX_IMAGE_MB} MB.`)
    setError('')
    const url = URL.createObjectURL(file)
    created.current.push(url)
    setUrl(url)
    if (setFile) setFile(file)
  }

  // Free memory for previews that won't be used
  const freeUnused = (keep) =>
    created.current.filter((u) => !keep.includes(u)).forEach((u) => URL.revokeObjectURL(u))

  function cancel() {
    freeUnused([])
    onClose()
  }

  async function save(e) {
    e.preventDefault()

    const trimmed = bio.trim()
    const formData = new FormData()
    formData.append('bio', trimmed)
    formData.append('first_name', firstName.trim())
    formData.append('last_name', lastName.trim())

    if (selectedProfilePicture) {
      formData.append('profile_picture', selectedProfilePicture)
    } else if (profilePicture === null) {
      formData.append('profile_picture', '')
    }

    if (selectedBanner) {
      formData.append('banner', selectedBanner)
    } else if (bannerUrl === null) {
      formData.append('banner', '')
    }

    formData.append('left_picture', selectedLeftPicture)
    formData.append('left_picture_flip', flipLeft)
    formData.append('left_picture_tile', tileLeft)

    formData.append('right_picture', selectedRightPicture)
    formData.append('right_picture_flip', flipRight)
    formData.append('right_picture_tile', tileRight)

    setSaving(true)
    const result = await fetchWithToken('/api/profile/me/', {
      method: 'PUT',
      body: formData
    })

    setSaving(false)

    const data = result.result

    if (!result.isError) {
      // Use what the server sent back, so photos point at their saved addresses
      setUserCache({ ...userCache, ...data })
      updateProfile({ theme }) // TODO: send the theme too, once the backend has a theme field
      freeUnused([])
      // The backend ignores names until first_name/last_name are writable there (see README).
      // If they didn't change, say so instead of closing like it worked.
      if ((data.first_name ?? '') !== firstName.trim() || (data.last_name ?? '') !== lastName.trim()) {
        return setError("Everything else saved, but your name can't be changed yet. The backend needs an update.")
      }
      onClose()
    }
    else {
      setError(errorMessage(result.result))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && cancel()}
    >
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        style={themeVars(theme)}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/60"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={cancel} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-white">
              <X size={18} />
            </button>
            <h2 className="font-semibold">Edit profile</h2>
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-page hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Live preview: banner + photo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => bannerInput.current?.click()}
            className="group relative block h-32 w-full sm:h-36"
            aria-label="Change banner"
          >
            {bannerUrl ? (
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: getTheme(theme).banner }} />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 transition group-hover:bg-black/50 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium">
                <Camera size={14} /> Change banner
              </span>
            </span>
          </button>
          {bannerUrl && (
            <button
              type="button"
              onClick={() => { setBannerUrl(null); setSelectedBanner(null) }}
              className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs hover:bg-black"
            >
              Remove
            </button>
          )}

          <div className="absolute -bottom-10 left-5">
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              className="group relative block rounded-full"
              aria-label="Change profile photo"
            >
              <Avatar name={userFullName} src={profilePicture} size="lg" />
              <span className="absolute inset-1 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                <Camera size={18} />
              </span>
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 pt-12">
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => avatarInput.current?.click()} className="font-medium text-accent hover:underline">
              Change photo
            </button>
            {profilePicture && (
              <button type="button" onClick={() => {
                setProfilePicture(null)
                setSelectedProfilePicture(null)
              }} className="text-muted hover:text-red-400">
                Remove photo
              </button>
            )}
          </div>

          <input ref={avatarInput} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={(e) => pickImage(e, setProfilePicture, setSelectedProfilePicture)} />
          <input ref={bannerInput} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={(e) => pickImage(e, setBannerUrl, setSelectedBanner)} />

          {/* Fields */}
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="block text-sm font-medium">First name</label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setError('') }}
                  maxLength={MAX_NAME}
                  autoComplete="given-name"
                  className="w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="block text-sm font-medium">Last name</label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setError('') }}
                  maxLength={MAX_NAME}
                  autoComplete="family-name"
                  className="w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            {/* <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <label htmlFor="displayName" className="font-medium">Display name</label>
                <span className="text-xs text-muted">{name.length}/{MAX_NAME}</span>
              </div>
              <input
                id="displayName"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                maxLength={MAX_NAME}
                className="w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
            </div> */}

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <label htmlFor="bio" className="font-medium">Bio</label>
                <span className={`text-xs ${MAX_BIO - bio.length < 20 ? 'text-red-400' : 'text-muted'}`}>{bio.length}/{MAX_BIO}</span>
              </div>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={MAX_BIO}
                rows={3}
                placeholder="Tell people about yourself"
                className="w-full resize-none rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <ThemePicker label="Profile theme" value={theme} onChange={setTheme} />
            {/* <p className="text-xs text-muted">Everyone who visits your profile sees this theme.</p>

            <p className="text-xs text-muted">Your username stays <span className="text-white">@{userCache?.username ?? ""}</span>.</p> */}
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <div className="relative grid grid-cols-2 px-5 pb-5">
          <div className='relative'>
            <button
              type="button"
              onClick={() => {leftPictureInput.current?.click()}}
              className="group relative block h-32 w-40% sm:h-60"
              aria-label="Change left-side image"
            >
              { leftPictureUrl ? (
                <img src={leftPictureUrl} alt="" className="h-full w-full object-cover rounded-lg border border-line" />
              ) : (
                <img src="side-picture-placeholder.png" alt="" className="h-full w-full object-cover rounded-lg border border-line" />
              )}

              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 transition group-hover:bg-black/50 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium">
                  <Camera size={14} /> Change left side image
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {setLeftPictureUrl(null); setSelectedLeftPicture(null)}}
              className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs hover:bg-black"
            >
              Remove
            </button>

            <div className="grid grid-cols-2">
              <label className="flex items-center justify-center gap-1 rounded-lg border border-line px-4 py-2 text-sm text-center font-semibold hover:border-accent hover:text-accent">
                <input
                  type="checkbox"
                  id="flip"
                  name="flip"
                  className="accent-accent"
                  checked={flipLeft}
                  onChange={(e) => setFlipLeft(e.target.checked)}
                />
                <span>Flip</span>
              </label>

              <label className="flex items-center justify-center gap-1 rounded-lg border border-line px-4 py-2 text-sm text-center font-semibold hover:border-accent hover:text-accent">
                <input
                  type="checkbox"
                  id="tile"
                  name="tile"
                  className="accent-accent"
                  checked={tileLeft}
                  onChange={(e) => setTileLeft(e.target.checked)}
                />
                <span>Tile</span>
              </label>
            </div>
          </div>

          <div className='relative'>
            <button
              type="button"
              onClick={() => {rightPictureInput.current?.click()}}
              className="group relative block h-32 w-40% sm:h-60"
              aria-label="Change right side image"
            >
              { rightPictureUrl ? (
                <img src={rightPictureUrl} alt="" className="h-full w-full object-cover rounded-lg border border-line" />
              ) : (
                <img src="side-picture-placeholder.png" alt="" className="h-full w-full object-cover rounded-lg border border-line" />
              )}

              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 transition group-hover:bg-black/50 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium">
                  <Camera size={14} /> Change right side image
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {setRightPictureUrl(null); setSelectedRightPicture(null)}}
              className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs hover:bg-black"
            >
              Remove
            </button>

            <div className="grid grid-cols-2">
              <label className="flex items-center justify-center gap-1 rounded-lg border border-line px-4 py-2 text-sm text-center font-semibold hover:border-accent hover:text-accent">
                <input
                  type="checkbox"
                  id="flip"
                  name="flip"
                  className="accent-accent"
                  checked={flipRight}
                  onChange={(e) => setFlipRight(e.target.checked)}
                />
                <span>Flip</span>
              </label>

              <label className="flex items-center justify-center gap-1 rounded-lg border border-line px-4 py-2 text-sm text-center font-semibold hover:border-accent hover:text-accent">
                <input
                  type="checkbox"
                  id="tile"
                  name="tile"
                  className="accent-accent"
                  checked={tileRight}
                  onChange={(e) => setTileRight(e.target.checked)}
                />
                <span>Tile</span>
              </label>
            </div>
          </div>
          
          <input ref={leftPictureInput} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={(e) => pickImage(e, setLeftPictureUrl, setSelectedLeftPicture)} />
          <input ref={rightPictureInput} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={(e) => pickImage(e, setRightPictureUrl, setSelectedRightPicture)} />
        </div>
      </form>
    </div>
  )
}
