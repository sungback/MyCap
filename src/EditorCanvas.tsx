import { useEffect, useRef, useState } from 'react'

type Point = { x: number; y: number }
type Tool = 'arrow' | 'rect' | 'text' | 'blur'

const STROKE_COLOR = '#ef4444'
const STROKE_WIDTH = 3

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  const headLength = 16
  const angle = Math.atan2(to.y - from.y, to.x - from.x)

  ctx.strokeStyle = STROKE_COLOR
  ctx.fillStyle = STROKE_COLOR
  ctx.lineWidth = STROKE_WIDTH
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6),
  )
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6),
  )
  ctx.closePath()
  ctx.fill()
}

function drawRect(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.strokeStyle = STROKE_COLOR
  ctx.lineWidth = STROKE_WIDTH
  ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y)
}

function normalizeRect(from: Point, to: Point) {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  }
}

function applyBlur(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  const rect = normalizeRect(from, to)
  if (rect.width < 2 || rect.height < 2) return

  const temp = document.createElement('canvas')
  temp.width = rect.width
  temp.height = rect.height
  const tempCtx = temp.getContext('2d')
  if (!tempCtx) return

  tempCtx.filter = 'blur(6px)'
  tempCtx.drawImage(
    ctx.canvas,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  )
  ctx.drawImage(temp, rect.x, rect.y)
}

export default function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<ImageData[]>([])
  const startPointRef = useRef<Point | null>(null)
  const snapshotRef = useRef<ImageData | null>(null)

  const [tool, setTool] = useState<Tool>('arrow')
  const [filePath, setFilePath] = useState('')
  const [saving, setSaving] = useState(false)
  const [textInput, setTextInput] = useState<{ left: number; top: number; imgX: number; imgY: number } | null>(
    null,
  )

  useEffect(() => {
    const unsubscribe = window.editorApi?.onInit(({ dataUrl, filePath }) => {
      setFilePath(filePath)
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
        historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
      }
      img.src = dataUrl
    })
    return () => unsubscribe?.()
  }, [])

  const getContext = () => canvasRef.current?.getContext('2d') ?? null

  const pushHistory = () => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (historyRef.current.length > 20) historyRef.current.shift()
  }

  const handleUndo = () => {
    const ctx = getContext()
    if (!ctx || historyRef.current.length <= 1) return
    historyRef.current.pop()
    const previous = historyRef.current[historyRef.current.length - 1]
    ctx.putImageData(previous, 0, 0)
  }

  const getImagePoint = (event: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
  }

  const handleMouseDown = (event: React.MouseEvent) => {
    if (tool === 'text') {
      const canvas = canvasRef.current!
      const containerRect = canvas.parentElement!.getBoundingClientRect()
      const point = getImagePoint(event)
      setTextInput({
        left: event.clientX - containerRect.left,
        top: event.clientY - containerRect.top,
        imgX: point.x,
        imgY: point.y,
      })
      return
    }

    const ctx = getContext()
    if (!ctx) return
    startPointRef.current = getImagePoint(event)
    snapshotRef.current = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    const ctx = getContext()
    const start = startPointRef.current
    const snapshot = snapshotRef.current
    if (!ctx || !start || !snapshot) return

    const current = getImagePoint(event)
    ctx.putImageData(snapshot, 0, 0)

    if (tool === 'rect') drawRect(ctx, start, current)
    else if (tool === 'arrow') drawArrow(ctx, start, current)
    else if (tool === 'blur') {
      ctx.save()
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = STROKE_COLOR
      ctx.lineWidth = 2
      const rect = normalizeRect(start, current)
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      ctx.restore()
    }
  }

  const handleMouseUp = (event: React.MouseEvent) => {
    const ctx = getContext()
    const start = startPointRef.current
    const snapshot = snapshotRef.current
    if (!ctx || !start || !snapshot) return

    const end = getImagePoint(event)
    ctx.putImageData(snapshot, 0, 0)

    if (tool === 'rect') drawRect(ctx, start, end)
    else if (tool === 'arrow') drawArrow(ctx, start, end)
    else if (tool === 'blur') applyBlur(ctx, start, end)

    startPointRef.current = null
    snapshotRef.current = null
    pushHistory()
  }

  const commitText = (value: string) => {
    const ctx = getContext()
    if (ctx && value.trim()) {
      ctx.fillStyle = STROKE_COLOR
      ctx.font = '28px system-ui, sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(value, textInput!.imgX, textInput!.imgY)
      pushHistory()
    }
    setTextInput(null)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    await window.editorApi?.save(canvas.toDataURL('image/png'))
    setSaving(false)
  }

  const handleClose = () => window.editorApi?.close()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #e5e7eb', alignItems: 'center' }}>
        {(
          [
            ['arrow', '화살표'],
            ['rect', '사각형'],
            ['text', '텍스트'],
            ['blur', '블러'],
          ] as [Tool, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTool(value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: tool === value ? '2px solid #2563eb' : '1px solid #d1d5db',
              background: tool === value ? '#eff6ff' : 'white',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
        <div style={{ width: 1, alignSelf: 'stretch', background: '#e5e7eb', margin: '0 4px' }} />
        <button onClick={handleUndo} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          실행 취소
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: 13 }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={handleClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          닫기
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'auto', background: '#f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ maxWidth: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', cursor: tool === 'text' ? 'text' : 'crosshair' }}
        />
        {textInput && (
          <input
            autoFocus
            style={{ position: 'absolute', left: textInput.left, top: textInput.top, fontSize: 16, border: '1px solid #2563eb', outline: 'none', padding: '2px 4px' }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitText((event.target as HTMLInputElement).value)
              if (event.key === 'Escape') setTextInput(null)
            }}
            onBlur={(event) => commitText(event.target.value)}
          />
        )}
      </div>

      <div style={{ padding: '4px 10px', fontSize: 11, color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>{filePath}</div>
    </div>
  )
}
