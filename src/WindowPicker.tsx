import { useEffect, useState } from 'react'

type WindowSource = { id: string; name: string; thumbnailDataUrl: string }

export default function WindowPicker() {
  const [sources, setSources] = useState<WindowSource[]>([])

  useEffect(() => {
    const unsubscribe = window.pickerApi?.onInit(setSources)
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.pickerApi?.cancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '1rem',
        boxSizing: 'border-box',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem' }}>캡처할 창을 선택하세요</h2>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {sources.map((source) => (
          <button
            key={source.id}
            onClick={() => window.pickerApi?.select(source.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: 8,
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <img
              src={source.thumbnailDataUrl}
              alt={source.name}
              style={{ width: '100%', height: 100, objectFit: 'contain', background: '#f3f4f6' }}
            />
            <span
              style={{
                fontSize: 12,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
              }}
            >
              {source.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
