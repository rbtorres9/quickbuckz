// Theme packs. "classic" is the site's default look.
export const themes = [
  {
    id: 'classic', name: 'Classic', accent: '#e6ff6b',
    banner: 'radial-gradient(circle at 20% 30%, #2d6a7f 0%, transparent 55%), radial-gradient(circle at 80% 70%, #5a4a2a 0%, transparent 50%), #111723',
  },
  { id: 'aurora', name: 'Aurora', accent: '#5eead4', banner: 'linear-gradient(160deg, #052e2b 0%, #0f766e 45%, #34d399 80%, #a7f3d0 100%)' },
  { id: 'sunset', name: 'Sunset', accent: '#fdba74', banner: 'linear-gradient(135deg, #3b0a2a 0%, #be185d 45%, #fb923c 85%)' },
  { id: 'glacier', name: 'Glacier', accent: '#93c5fd', banner: 'linear-gradient(160deg, #0b1d3a 0%, #1e40af 40%, #60a5fa 75%, #e0f2fe 100%)' },
  { id: 'midnight', name: 'Midnight', accent: '#c4b5fd', banner: 'linear-gradient(135deg, #0b0820 0%, #3b1d74 50%, #7c3aed 90%)' },
]

export const getTheme = (id) => themes.find((t) => t.id === id) || themes[0]

// Put this on an element's style to recolor everything inside it
// (every bg-accent, text-accent, border-accent... uses these variables).
export function themeVars(id) {
  const accent = getTheme(id).accent
  return { '--color-accent': accent, '--color-accent-hover': `color-mix(in srgb, ${accent} 88%, black)` }
}
