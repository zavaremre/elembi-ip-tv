import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root bulunamadı')

/* macOS hides its title bar rather than removing it, so the page owns the band
   the traffic lights sit in: it has to leave room for them and hand back a
   strip to drag the window by. Nowhere else does. */
document.documentElement.dataset.platform = window.elembi.app.platform

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
