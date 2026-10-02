import { Link } from 'react-router-dom'

export default function CreateAccount() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card px-8 py-6 text-center">
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted">Account creation will be available here soon.</p>
        <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
