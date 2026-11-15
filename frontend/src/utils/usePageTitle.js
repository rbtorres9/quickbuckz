import { useEffect } from 'react'

// Sets the browser tab title, like "Home · QuickBuckz".
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · QuickBuckz` : 'QuickBuckz'
  }, [title])
}
