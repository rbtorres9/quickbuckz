import { useEffect } from 'react'
import { X } from 'lucide-react'

// Full-screen photo. Closes with Escape, the X, or a click outside the photo.
export default function PhotoViewer({ post, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
    >
      <button
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X size={22} />
      </button>
      <img src={post.imageUrl} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
    </div>
  )
}
