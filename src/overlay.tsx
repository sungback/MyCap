import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OverlaySelector from './OverlaySelector'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlaySelector />
  </StrictMode>,
)
