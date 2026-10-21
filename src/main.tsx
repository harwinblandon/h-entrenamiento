import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_NAME, TAGLINE } from './brand'
import { App } from './ui/App'
import './styles.css'

document.title = `${APP_NAME} · ${TAGLINE}`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
