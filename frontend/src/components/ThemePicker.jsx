import { themes } from '../data/themes.js'

// A row of theme choices. Used in Create account, Edit profile and Settings.
export default function ThemePicker({ value, onChange, label = 'Theme' }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={value === t.id}
            aria-label={t.name}
            className="overflow-hidden rounded-lg border-2 bg-field text-left"
            style={{ borderColor: value === t.id ? t.accent : '#222a38' }}
          >
            <span className="block h-7" style={{ background: t.banner }} />
            <span className="block truncate px-1 py-1 text-center text-[11px] font-medium">{t.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
