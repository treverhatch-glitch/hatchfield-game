import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './ui/hud-chrome.css'
import './ui/layout/regions.css'
import './ui/menu/menu.css'
import { preloadCc0 } from './render/cc0/library'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// CC0 models (buses, fire truck, trees, terminal furniture, people) stream in after the
// first paint; until they land, and on any failure, the procedural meshes are drawn.
requestAnimationFrame(() => setTimeout(() => void preloadCc0(), 0))
