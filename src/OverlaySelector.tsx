import { useEffect, useRef, useState } from 'react'

type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }

function toRect(start: Point, current: Point): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  }
}

export default function OverlaySelector() {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = window.overlayApi?.onInit(({ dataUrl, width, height }) => {
      setScreenshotUrl(dataUrl)
      setSize({ width, height })
    })
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.overlayApi?.cancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleMouseDown = (event: React.MouseEvent) => {
    const point = { x: event.clientX, y: event.clientY }
    setStart(point)
    setCurrent(point)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!start) return
    setCurrent({ x: event.clientX, y: event.clientY })
  }

  const handleMouseUp = () => {
    if (!start || !current) return
    const rect = toRect(start, current)
    window.overlayApi?.completeSelection(rect)
    setStart(null)
    setCurrent(null)
  }

  const rect = start && current ? toRect(start, current) : null

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        width: size.width || '100vw',
        height: size.height || '100vh',
        backgroundImage: screenshotUrl ? `url(${screenshotUrl})` : undefined,
        backgroundSize: '100% 100%',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          pointerEvents: 'none',
        }}
      >
        드래그하여 캡처할 영역을 선택하세요 · Esc로 취소
      </div>

      {rect && rect.width > 0 && rect.height > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
            border: '1px solid #2563eb',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              bottom: -24,
              left: 0,
              background: 'rgba(37, 99, 235, 0.9)',
              color: 'white',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {Math.round(rect.width)} x {Math.round(rect.height)}
          </span>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.25)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
