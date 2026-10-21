import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_NAME, TAGLINE } from './brand'
import { App } from './ui/App'
import { applyFont, storedFont } from './ui/appearance'
import './styles.css'

document.title = `${APP_NAME} · ${TAGLINE}`
applyFont(storedFont())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
