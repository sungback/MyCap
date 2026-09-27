import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WindowPicker from './WindowPicker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WindowPicker />
  </StrictMode>,
)
