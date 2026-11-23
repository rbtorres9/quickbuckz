import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { useIsMod } from '../utils/useIsMod.js'
import { useStore } from '../data/store.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

const saveClass = 'rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40'
const inputClass =
  'w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20'

export default function AccountSettings() {
  usePageTitle('Settings')
  const { siteTheme, setSiteTheme } = useStore()
  const isMod = useIsMod() // only mods and admins see the Moderator section
  const { logout, fetchWithToken } = useAuthContext()
  const { userCache, setUserCache } = useCache()
  const navigate = useNavigate()

  // Privacy: saved to the database right away
  const [privacyMsg, setPrivacyMsg] = useState('')
  async function setVisibility(visibility) {
    const old = userCache
    setUserCache({ ...userCache, visibility }) // show the change right away
    setPrivacyMsg('Saving…')
    const result = await fetchWithToken('/api/profile/me/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    })

    const data = result.result

    if (result.isError) {
      setUserCache(old) // put it back if saving failed
      return setPrivacyMsg(errorMessage(data))
    }
    setUserCache({ ...userCache, ...data })
    localStorage.setItem('user', JSON.stringify({ ...userCache, ...data }))
    setPrivacyMsg('Saved.')
  }

  const [ themeMsg, setThemeMsg ] = useState('')
  async function updateSiteTheme(newTheme) {
    const old = userCache
    setSiteTheme(newTheme)
    setUserCache({...userCache, theme: newTheme})
    setThemeMsg('Saving…')

    const result = await fetchWithToken('/api/profile/me/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme })
    })

    const data = result.result

    if (result.isError) {
      setUserCache(old)
      setSiteTheme(old?.theme ?? 'classic')
      return setThemeMsg(errorMessage(data))
    }

    setUserCache({ ...userCache, ...data })
    localStorage.setItem('user', JSON.stringify({ ...userCache, ...data }))
    setThemeMsg('Saved.')
  }

  // Email
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState(userCache?.email ?? '')
  const [emailMsg, setEmailMsg] = useState('')
  const [emailError, setEmailError] = useState('')
  const [fetchingEmail, setFetchingEmail] = useState(false)

  async function saveEmail(e) {
    e.preventDefault()

    setEmailError('')
    setEmailMsg('')
    
    const clean = email.trim().toLowerCase()
    setEmail(clean)

    setFetchingEmail(true)
    const result = await fetchWithToken('/api/profile/me/change-email/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, email: clean })
    })
    setFetchingEmail(false)

    if (result.isError) {
      setEmailError(errorMessage(result.result))
      return
    }

    setEmail('')
    setPassword('')
    setEmailMsg('Email saved.')
  }

  // Password
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [fetchingPassword, setFetchingPassword] = useState(false)

  async function savePassword(e) {
    e.preventDefault()

    setPasswordError('')
    setPasswordMsg('')

    if (next.length < 8) return setPasswordError('New password must be at least 8 characters.')
    if (next !== confirm) return setPasswordError('New passwords do not match.')
    if (next === current) return setPasswordError('New password must be different from your current one.')
    
    setFetchingPassword(true)
    const result = await fetchWithToken('/api/profile/me/change-password/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: current, new_password: next })
    })
    setFetchingPassword(false)

    if (result.isError) {
      setPasswordError(errorMessage(result.result))
      return
    }
    
    setCurrent('')
    setNext('')
    setConfirm('')
    setPasswordMsg('Password updated.')
  }

  // Deactivate: hides your profile, posts and comments. Logging in again brings everything back.
  const [deactivatePassword, setDeactivatePassword] = useState('')
  const [deactivateError, setDeactivateError] = useState('')
  const [deactivating, setDeactivating] = useState(false)

  async function deactivate(e) {
    e.preventDefault()
    setDeactivateError('')
    // window.confirm because `confirm` above is the confirm-password box
    if (!window.confirm('Deactivate your account? Your profile, posts and comments will be hidden until you log in again.')) return

    setDeactivating(true)
    const result = await fetchWithToken('/api/profile/me/deactivate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deactivatePassword }),
    })
    setDeactivating(false)

    if (result.isError) return setDeactivateError(errorMessage(result.result))
    // The old login stops working right away, so log out on this device too
    alert(result.result?.detail ?? 'Your account has been deactivated. Log in again to reactivate it.')
    logout()
    navigate('/login')
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>

      {/* Account */}
      <section className="space-y-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Account</h2>
        <div className="space-y-1">
          <p className="text-sm font-medium">Username</p>
          <p className="text-sm text-muted">@{userCache?.username} · usernames can't be changed</p>
        </div>
      </section>

      {/* Email */}
      <form onSubmit={saveEmail} className="space-y-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Change email</h2>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setEmailMsg('') }}
            className={inputClass}
            minLength={8}
          />
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
        {emailError && <p className="text-sm text-red-400 whitespace-pre-line">{emailError}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className={saveClass} disabled={fetchingEmail}>Save email</button>
          {emailMsg && <span className="text-sm text-accent">{emailMsg}</span>}
        </div>
      </form>
      
      {/* Password */}
      <form onSubmit={savePassword} className="space-y-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <label htmlFor="current" className="block text-sm font-medium">Current password</label>
          <input id="current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} minLength={8}/>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="next" className="block text-sm font-medium">New password</label>
          <input id="next" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} minLength={8}/>
          <p className="text-xs text-muted">At least 8 characters. Avoid common passwords.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-sm font-medium">Confirm new password</label>
          <input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} minLength={8}/>
        </div>
        {passwordError && <p className="text-sm text-red-400 whitespace-pre-line">{passwordError}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className={saveClass} disabled={fetchingPassword}>Update password</button>
          {passwordMsg && <span className="text-sm text-accent">{passwordMsg}</span>}
        </div>
      </form>

      {/* Site color */}
      <section className="space-y-3 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Appearance</h2>
        <ThemePicker label="How QuickBuckz looks to you" value={siteTheme} onChange={updateSiteTheme} />
        <p className="text-xs text-muted">Colors the site for you. Everyone who visits your profile sees it too.</p>
        {themeMsg && <p className={`text-sm ${themeMsg === 'Saved.' || themeMsg === 'Saving…' ? 'text-accent' : 'text-red-400'}`}>{themeMsg}</p>}
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
                checked={(userCache?.visibility ?? 'public') === option.value}
                onChange={() => setVisibility(option.value)}
                className="mt-1 accent-accent"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {privacyMsg && <p className={`text-sm ${privacyMsg === 'Saved.' || privacyMsg === 'Saving…' ? 'text-accent' : 'text-red-400'}`}>{privacyMsg}</p>}
        <Link to="/blocked" className="inline-block text-sm font-semibold text-accent hover:underline">Blocked users</Link>
      </section>

      {/* Moderator: only shows for mods and admins (set in the Django admin site) */}
      {isMod && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-6">
          <div className="flex-1">
            <h2 className="font-semibold">Moderator</h2>
            <p className="text-sm text-muted">Review reports and remove posts.</p>
          </div>
          <Link to="/mod" className={saveClass}>Open mod tools</Link>
        </section>
      )}

      {/* Log out */}
      <section className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-6">
        <div>
          <h2 className="font-semibold">Log out</h2>
          <p className="text-sm text-muted">Sign out of QuickBuckz on this device.</p>
        </div>
        <button
          onClick={() => { logout(true); navigate('/login') }} 
          className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-red-400/60 hover:text-red-300"
        >
          Log out
        </button>
      </section>

      {/* Deactivate account */}
      <form onSubmit={deactivate} className="space-y-4 rounded-2xl border border-red-400/30 bg-card p-6">
        <div>
          <h2 className="font-semibold">Deactivate account</h2>
          <p className="text-sm text-muted">
            Hides your profile, posts and comments from everyone. Nothing is deleted: log in again anytime to bring it all back.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="deactivate-password" className="block text-sm font-medium">Password</label>
          <input id="deactivate-password" type="password" required autoComplete="current-password" value={deactivatePassword} onChange={(e) => setDeactivatePassword(e.target.value)} className={inputClass} />
        </div>
        {deactivateError && <p className="text-sm text-red-400 whitespace-pre-line">{deactivateError}</p>}
        <button
          type="submit"
          disabled={deactivating}
          className="rounded-lg border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-40"
        >
          {deactivating ? 'Deactivating…' : 'Deactivate account'}
        </button>
      </form>
    </main>
  )
}
