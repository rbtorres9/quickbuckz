import { Link } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { useStore } from '../data/store.jsx'

export default function TopBar() {
  const { viewer, setViewer } = useStore()
  const pill = (value, label) => (
    <button
      onClick={() => setViewer(value)}
      className={`rounded-full border px-3 py-1 ${
        viewer === value ? 'border-accent text-accent' : 'border-line text-muted hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link to="/user-page" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-page">
            <Plane size={16} strokeWidth={2.5} />
          </span>
          <span className="hidden sm:inline">Adored Vacation</span>
        </Link>
        {/* Demo toggle. Delete once real logins exist. */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Viewing as:</span>
          {pill('visitor', 'Visitor')}
          {pill('owner', 'Owner')}
        </div>
      </div>
    </header>
  )
}
