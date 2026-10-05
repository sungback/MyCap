import { useEffect, useState } from 'react'
import './App.css'

type UpdateState = {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  version?: string
  percent?: number
  message?: string
}

function App() {
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [versionInfo, setVersionInfo] = useState<{
    version: string
    isPortable: boolean
    platform?: string
  } | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateState>({ state: 'idle' })

  useEffect(() => {
    const unsubscribeCapture = window.captureApi?.onCaptureDone(({ filePath }) => {
      setLastCapture(filePath)
      setCapturing(false)
    })

    window.updateApi?.getInfo().then((info) => {
      if (info) setVersionInfo(info)
    })

    const unsubscribeUpdate = window.updateApi?.onStatusChange((status) => {
      setUpdateStatus(status)
    })

    return () => {
      unsubscribeCapture?.()
      unsubscribeUpdate?.()
    }
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

  const handleCheckUpdate = async () => {
    setUpdateStatus({ state: 'checking' })
    await window.updateApi?.checkForUpdates()
  }

  const handleRestart = async () => {
    await window.updateApi?.restartAndInstall()
  }

  const handleDownload = async () => {
    await window.updateApi?.openDownloadPage()
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
        <button type="button" className="capture-button full" onClick={handleCapture} disabled={capturing}>
          {capturing ? '캡처 중...' : '전체화면 캡처'}
        </button>
        <button type="button" className="capture-button region" onClick={handleRegionCapture}>
          영역 선택 캡처
        </button>
        <button type="button" className="capture-button window" onClick={handleWindowCapture}>
          창 캡처
        </button>
      </div>

      {lastCapture && (
        <div className="last-capture">
          <p>마지막 캡처 저장 위치:</p>
          <code>{lastCapture}</code>
        </div>
      )}

      <footer className="update-footer">
        <div className="version-row">
          <span className="version-info">
            v{versionInfo?.version || '0.0.3'}
            <span
              className={`version-pill ${
                versionInfo?.platform === 'darwin'
                  ? 'macos'
                  : versionInfo?.isPortable
                    ? 'portable'
                    : 'setup'
              }`}
            >
              {versionInfo?.platform === 'darwin'
                ? 'macOS'
                : versionInfo?.isPortable
                  ? '무설치'
                  : '설치형'}
            </span>
          </span>
          <button
            type="button"
            className="check-update-btn"
            onClick={handleCheckUpdate}
            disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
          >
            {updateStatus.state === 'checking' ? '확인 중...' : '업데이트 확인'}
          </button>
        </div>

        {updateStatus.state === 'up-to-date' && (
          <div className="update-message success">
            <span>✓ 최신 버전을 사용 중입니다.</span>
          </div>
        )}

        {updateStatus.state === 'available' && (
          <div className="update-message available">
            <span>새 버전(v{updateStatus.version})이 출시되었습니다!</span>
            {versionInfo?.isPortable ? (
              <button type="button" className="update-action-btn" onClick={handleDownload}>
                다운로드
              </button>
            ) : (
              <span className="update-sub">백그라운드에서 다운로드 중...</span>
            )}
          </div>
        )}

        {updateStatus.state === 'downloading' && (
          <div className="update-message downloading">
            <span>다운로드 중... {updateStatus.percent ? `${updateStatus.percent}%` : ''}</span>
          </div>
        )}

        {updateStatus.state === 'downloaded' && (
          <div className="update-message downloaded">
            <span>v{updateStatus.version} 준비 완료!</span>
            <button type="button" className="update-action-btn restart" onClick={handleRestart}>
              재시작하여 적용
            </button>
          </div>
        )}

        {updateStatus.state === 'error' && (
          <div className="update-message error">
            <span>{updateStatus.message || '업데이트 확인 중 오류가 발생했습니다.'}</span>
          </div>
        )}
      </footer>
    </main>
  )
}

export default App
