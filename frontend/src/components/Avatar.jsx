export default function Avatar({ name, src, size = 'md', accent = true }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2)
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs', lg: 'h-20 w-20 text-2xl border-4 border-page' }

  if (src) {
    return <img src={src} alt={name} className={`shrink-0 rounded-full object-cover ${sizes[size]}`} />
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizes[size]} ${
        accent ? 'bg-accent text-page' : 'bg-line text-white'
      }`}
    >
      {initials}
    </div>
  )
}
