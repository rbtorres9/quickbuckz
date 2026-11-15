import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext.jsx'
import { useCache } from '../context/CacheContext.jsx'
import { errorMessage } from '../utils/errorMessage.js'
import { useIsMod } from '../utils/useIsMod.js'
import { useStore } from '../data/store.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { usePageTitle } from '../utils/usePageTitle.js'

const saveClass = 'rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:bg-accent-hover'

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
    setUserCache({...userCache, site_theme: newTheme})
    setThemeMsg('Saving…')

    const result = await fetchWithToken('/api/profile/me/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({site_theme: newTheme})
    })

    const data = result.result

    if (result.isError) {
      setUserCache(old)
      setSiteTheme(old.site_theme)
      return setThemeMsg(errorMessage(data))
    }

    setUserCache({ ...userCache, ...data })
    localStorage.setItem('user', JSON.stringify({ ...userCache, ...data }))
    setThemeMsg('Saved.')
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
        <div className="space-y-1">
          <p className="text-sm font-medium">Email</p>
          {/* TODO: show and change the email once the backend sends it and has a change-email endpoint */}
          <p className="text-sm text-muted">Changing your email is coming soon.</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Password</p>
          {/* TODO: a change-password form here once the backend has a change-password endpoint.
              For now, the forgot-password email (which works) is the way to set a new one. */}
          <p className="text-sm text-muted">
            Changing your password from here is coming soon. For now you can{' '}
            <Link to="/forgot" className="font-semibold text-accent hover:underline">reset it by email</Link>.
          </p>
        </div>
      </section>

      {/* Site color */}
      <section className="space-y-3 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-semibold">Appearance</h2>
        <ThemePicker label="How QuickBuckz looks to you" value={siteTheme} onChange={updateSiteTheme} />
        <p className="text-xs text-muted">Only you see this. Profiles still show in their owner's theme.</p>
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
                className="mt-1 accent-[#e6ff6b]"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {privacyMsg && <p className={`text-sm ${privacyMsg === 'Saved.' || privacyMsg === 'Saving…' ? 'text-accent' : 'text-red-400'}`}>{privacyMsg}</p>}
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
