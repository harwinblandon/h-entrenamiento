import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_NAME, TAGLINE } from './brand'
import { App } from './ui/App'
import { requestPersistentStorage } from './db/storage'
import { applyFont, storedFont } from './ui/appearance'
import './styles.css'

document.title = `${APP_NAME} · ${TAGLINE}`
applyFont(storedFont())
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
