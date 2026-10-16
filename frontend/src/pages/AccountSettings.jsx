import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useStore } from '../data/store.jsx'
import ThemePicker from '../components/ThemePicker.jsx'

const inputClass =
  'w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20'
const saveClass = 'rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover'

export default function AccountSettings() {
  const { profile, updateProfile, siteTheme, setSiteTheme } = useStore()
  const { logout } = useAuthContext()
  const navigate = useNavigate()

  // Email
  const [email, setEmail] = useState(profile.email)
  const [emailMsg, setEmailMsg] = useState('')

  function saveEmail(e) {
    e.preventDefault()
    // TODO: save the new email to the backend
    const clean = email.trim().toLowerCase()
    updateProfile({ email: clean })
    setEmail(clean)
    setEmailMsg('Email saved.')
  }

  // Password
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')

  function savePassword(e) {
    e.preventDefault()
    setPasswordMsg('')
    if (next.length < 8) return setPasswordError('New password must be at least 8 characters.')
    if (next !== confirm) return setPasswordError('New passwords do not match.')
    if (next === current) return setPasswordError('New password must be different from your current one.')
    // TODO: send to a change-password endpoint on the backend (it doesn't exist yet)
    setPasswordError('')
    setCurrent('')
    setNext('')
    setConfirm('')
    setPasswordMsg('Password updated.')
  }

  // Privacy
  function setVisibility(visibility) {
    // TODO: save with PATCH /api/profile/me/ (the backend already supports "visibility")
    updateProfile({ visibility })
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>

      {/* Account */}
      <form onSubmit={saveEmail} className="space-y-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Account</h2>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Username</p>
          <p className="text-sm text-muted">@{profile.handle} · usernames can't be changed</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailMsg('') }}
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className={saveClass}>Save email</button>
          {emailMsg && <span className="text-sm text-accent">{emailMsg}</span>}
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="space-y-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <label htmlFor="current" className="block text-sm font-medium">Current password</label>
          <input id="current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="next" className="block text-sm font-medium">New password</label>
          <input id="next" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          <p className="text-xs text-muted">At least 8 characters. Avoid common passwords.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-sm font-medium">Confirm new password</label>
          <input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
        {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className={saveClass}>Update password</button>
          {passwordMsg && <span className="text-sm text-accent">{passwordMsg}</span>}
        </div>
      </form>

      {/* Site color */}
      <section className="space-y-3 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Appearance</h2>
        <ThemePicker label="How QuickBuckz looks to you" value={siteTheme} onChange={setSiteTheme} />
        <p className="text-xs text-muted">Only you see this. Profiles still show in their owner's theme.</p>
      </section>

      {/* Privacy */}
      <section className="space-y-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Privacy</h2>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Who can see your profile?</legend>
          {[
            { value: 'public', label: 'Public', hint: 'Anyone can see your profile.' },
            { value: 'private', label: 'Private', hint: 'Your profile is hidden from other people.' },
          ].map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-white/5">
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={profile.visibility === option.value}
                onChange={() => setVisibility(option.value)}
                className="mt-1 accent-[#e6ff6b]"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      {/* Log out */}
      <section className="flex items-center justify-between rounded-2xl border border-line bg-card p-6">
        <div>
          <h2 className="font-semibold">Log out</h2>
          <p className="text-sm text-muted">Sign out of QuickBuckz on this device.</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300"
        >
          Log out
        </button>
      </section>
    </main>
  )
}
