import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    const unsubscribe = window.captureApi?.onCaptureDone(({ filePath }) => {
      setLastCapture(filePath)
      setCapturing(false)
    })
    return () => unsubscribe?.()
  }, [])

  const handleCapture = async () => {
    setCapturing(true)
    await window.captureApi?.triggerCapture()
  }

  const handleRegionCapture = async () => {
    await window.captureApi?.triggerRegionCapture()
  }

  const handleWindowCapture = async () => {
    await window.captureApi?.triggerWindowCapture()
  }

  return (
    <main className="capture-app">
      <h1>화면 캡쳐</h1>
      <p className="hint">
        전체화면 <kbd>Ctrl/Cmd+Shift+S</kbd> · 영역 선택 <kbd>Ctrl/Cmd+Shift+A</kbd> · 창 캡처{' '}
        <kbd>Ctrl/Cmd+Shift+W</kbd>
        <br />
        캡처 결과는 클립보드에 자동 복사되고, 편집 창에서 화살표·사각형·텍스트·블러를 추가할 수 있습니다.
      </p>

      <div className="button-row">
        <button type="button" className="capture-button" onClick={handleCapture} disabled={capturing}>
          {capturing ? '캡처 중...' : '전체화면 캡처'}
        </button>
        <button type="button" className="capture-button secondary" onClick={handleRegionCapture}>
          영역 선택 캡처
        </button>
        <button type="button" className="capture-button secondary" onClick={handleWindowCapture}>
          창 캡처
        </button>
      </div>

      {lastCapture && (
        <div className="last-capture">
          <p>마지막 캡처 저장 위치:</p>
          <code>{lastCapture}</code>
        </div>
      )}
    </main>
  )
}

export default App
