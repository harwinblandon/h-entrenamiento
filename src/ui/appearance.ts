export interface FontOption {
  id: string
  label: string
  description: string
  family: string
}

/** Tipografías sin remates, de trazo redondeado; se cargan en index.html. */
export const FONT_OPTIONS: FontOption[] = [
  { id: 'outfit', label: 'Outfit', description: 'Geométrica y limpia', family: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
  { id: 'sora', label: 'Sora', description: 'Moderna, un poco más ancha', family: "'Sora', 'Segoe UI', system-ui, sans-serif" },
  { id: 'lexend', label: 'Lexend', description: 'Muy legible, pensada para leer con facilidad', family: "'Lexend', 'Segoe UI', system-ui, sans-serif" },
  { id: 'nunito', label: 'Nunito', description: 'Terminaciones redondeadas, más suave', family: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
]

const KEY = 'app.font'

export function storedFont(): string {
  try {
    return localStorage.getItem(KEY) ?? FONT_OPTIONS[0].id
  } catch {
    return FONT_OPTIONS[0].id
  }
}

export function applyFont(id: string) {
  const font = FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0]
  document.documentElement.style.setProperty('--font-display', font.family)
  document.documentElement.style.setProperty('--font-body', font.family)
  try {
    localStorage.setItem(KEY, font.id)
  } catch {
    // Sin almacenamiento: la elección dura solo esta sesión.
  }
}
