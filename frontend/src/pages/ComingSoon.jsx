// Placeholder for pages that aren't built yet, so nav links don't lead to a blank screen.
export default function ComingSoon({ title }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">This page is coming soon.</p>
    </main>
  )
}
