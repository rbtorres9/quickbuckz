import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemePicker from '../components/ThemePicker.jsx'
import { themeVars } from '../data/themes.js'

const fields = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Last name', autoComplete: 'family-name' },
  { name: 'username', label: 'Username', autoComplete: 'username' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
]

export default function CreateAccount() {
  const [form, setForm] = useState(
    Object.fromEntries(fields.map((f) => [f.name, '']))
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [slow, setSlow] = useState(false) // taking a while? (the server may be waking up)
  // Profile theme. TODO: send it to the backend once the profile has a theme field
  const [theme, setTheme] = useState('classic')
  const navigate = useNavigate()

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password != form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    try {
      // USE THE OTHER COMMENTED SECTION ONCE THE USER MODEL HAS UPDATED
      const {username, email, password} = form
      const response = await fetch("https://quickbuckz.onrender.com/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password
        }),
      });

      /*
      const {email, firstName, lastName, username, password} = form
      const response = await fetch("https://quickbuckz.onrender.com/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      */
      
      // ERR: This runs when certain fields are invalid such as the username which is unhelpful
      if (!response.ok) {
        let errorDetails = `${response.status} Error`

        try {
          let errors = []
          const errorJson = await response.json()
          
          for (const [key, value] of Object.entries(errorJson)) {
            if (Array.isArray(value)) {
              for (const err of value)
                errors.push(err)
            }
          }

          errorDetails = errors.join("\n")
        }
        catch {
          /* Leave empty for now */
        }

        throw new Error(errorDetails);
      }

      // const data = await response.json();

      navigate("/login")
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40 sm:p-10" style={themeVars(theme)}>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Create your account</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {fields.map(({ name, label, type = 'text', autoComplete }) => (
            <div key={name} className="space-y-1.5">
              <label htmlFor={name} className="block text-sm font-medium">
                {label}
              </label>
              <input
                id={name}
                name={name}
                type={type}
                placeholder={label}
                autoComplete={autoComplete}
                required
                value={form[name]}
                onChange={handleChange}
                className="w-full rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm text-white placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
            </div>
          ))}

          <ThemePicker label="Pick a profile theme" value={theme} onChange={setTheme} />
          <p className="-mt-2 text-xs text-muted">You can change it anytime in Edit profile.</p>

          {error && <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-page transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-page border-t-transparent" aria-hidden="true" />}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-center text-xs text-muted" aria-live="polite">
            {slow && 'Waking up the server… this can take up to a minute.'}
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
