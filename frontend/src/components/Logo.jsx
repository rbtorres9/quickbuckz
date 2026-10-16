// The QuickBuckz pup: a dog curled into a "Q", head on the left, tail as the Q's tail.
// Uses the current text color, so set the color with a class like "text-accent".
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="QuickBuckz">
      <circle cx="28" cy="36" r="17" fill="none" stroke="currentColor" strokeWidth="8" />
      <path d="M41 49 Q48 56 55 50 Q58 47 56 44" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M22.5 15 L21 4 L13 12 Z" fill="currentColor" />
      <circle cx="16" cy="19" r="9.5" fill="currentColor" stroke="#0a0d14" strokeWidth="2.5" paintOrder="stroke" />
      <ellipse cx="7.5" cy="22" rx="6" ry="4.5" fill="currentColor" />
      <circle cx="16" cy="19" r="9.5" fill="currentColor" />
      <circle cx="2.5" cy="20.5" r="2" fill="#0a0d14" />
      <circle cx="14" cy="16.5" r="1.7" fill="#0a0d14" />
    </svg>
  )
}
