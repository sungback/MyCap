import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EditorCanvas from './EditorCanvas'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorCanvas />
  </StrictMode>,
)
