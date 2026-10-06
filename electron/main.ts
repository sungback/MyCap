import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  desktopCapturer,
  screen,
  clipboard,
  nativeImage,
  ClipboardItem,
  ipcMain,
  Notification,
  shell,
  type NativeImage,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { autoUpdater } from 'electron-updater'

const isPortable = Boolean(
  process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE,
)

let isManualUpdateCheck = false
let availableUpdateVersion: string | null = null
let availableZipUrl: string | null = null
let availableZipSha512: string | null = null
let stagedMacApp: string | null = null

function broadcastUpdateStatus(status: {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  version?: string
  percent?: number
  message?: string
}) {
  mainWindow?.webContents.send('update:status', status)
}

function setupAutoUpdater() {
  if (VITE_DEV_SERVER_URL || !app.isPackaged) {
    return
  }

  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => {
    broadcastUpdateStatus({ state: 'checking' })
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  if (isPortable) {
    autoUpdater.on('update-available', (info) => {
      broadcastUpdateStatus({
        state: 'available',
        version: info.version,
      })
      const notification = new Notification({
        title: '새 버전 출시 안내 (포터블)',
        body: `새 버전(v${info.version})이 있습니다.\n클릭하여 최신 버전을 다운로드하세요.`,
      })
      notification.on('click', () => {
        shell.openExternal('https://github.com/sungback/MyCap/releases/latest')
      })
      notification.show()
    })
  } else {
    autoUpdater.on('update-available', (info) => {
      availableUpdateVersion = info.version
      const zipFile = (info.files as any[])?.find((f) => f.url?.endsWith('-mac.zip'))
      const zipFileName = zipFile ? zipFile.url : `ScreenCaptureApp-${info.version}-arm64-mac.zip`
      availableZipUrl = `https://github.com/sungback/MyCap/releases/download/v${info.version}/${zipFileName}`
      availableZipSha512 = zipFile?.sha512 ?? null

      broadcastUpdateStatus({
        state: 'available',
        version: info.version,
      })
      const notification = new Notification({
        title: '새 버전 출시 안내',
        body: `새 버전(v${info.version})이 있습니다.\n앱에서 [업데이트 다운로드]를 클릭하여 업데이트를 진행하세요.`,
      })
      notification.on('click', () => {
        mainWindow?.show()
        mainWindow?.focus()
      })
      notification.show()
    })

    autoUpdater.on('download-progress', (progress) => {
      broadcastUpdateStatus({
        state: 'downloading',
        percent: Math.round(progress.percent),
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      broadcastUpdateStatus({
        state: 'downloaded',
        version: info.version,
      })
      const notification = new Notification({
        title: '새 업데이트 다운로드 완료',
        body: `v${info.version} 다운로드가 완료되었습니다.\n재설치를 진행하여 최신 버전을 적용하세요.`,
      })
      notification.on('click', () => {
        ;(app as any).isQuitting = true
        autoUpdater.quitAndInstall(true, true)
      })
      notification.show()
    })
  }

  autoUpdater.on('update-not-available', () => {
    broadcastUpdateStatus({
      state: 'up-to-date',
      version: app.getVersion(),
    })
    if (isManualUpdateCheck) {
      new Notification({
        title: '최신 버전',
        body: '현재 최신 버전을 사용 중입니다.',
      }).show()
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err)
    broadcastUpdateStatus({
      state: 'error',
      message: '업데이트 중 문제가 발생했습니다. 수동 다운로드를 이용할 수 있습니다.',
    })
    if (isManualUpdateCheck) {
      new Notification({
        title: '업데이트 오류',
        body: '업데이트 중 문제가 발생했습니다. 수동 다운로드를 이용해 주세요.',
      }).show()
    }
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Background update check failed:', err)
    })
  }, 3000)
}

function checkForUpdates(isManual = false) {
  if (VITE_DEV_SERVER_URL || !app.isPackaged) {
    broadcastUpdateStatus({
      state: 'up-to-date',
      version: app.getVersion(),
      message: '개발 모드에서는 최신 버전으로 처리됩니다.',
    })
    if (isManual) {
      new Notification({
        title: '업데이트 확인',
        body: '개발 모드에서는 업데이트를 확인할 수 없습니다.',
      }).show()
    }
    return
  }

  isManualUpdateCheck = isManual
  broadcastUpdateStatus({ state: 'checking' })
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Manual update check failed:', err)
    broadcastUpdateStatus({ state: 'error', message: err.message })
    if (isManual) {
      new Notification({
        title: '업데이트 확인 실패',
        body: '업데이트 확인 중 오류가 발생했습니다.',
      }).show()
    }
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const APP_ICON_PATH = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public', 'icon.png')
  : path.join(RENDERER_DIST, 'icon.png')

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let pickerWindow: BrowserWindow | null = null
let editorWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Prevent a second instance: without this, launching the app twice registers
// duplicate (and conflicting) global shortcuts across two separate processes,
// so capture and the editor window behave unpredictably depending on which
// instance's hotkey registration Windows honors.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  mainWindow?.show()
  mainWindow?.focus()
})

const FULL_CAPTURE_SHORTCUT = 'CommandOrControl+Shift+S'
const REGION_CAPTURE_SHORTCUT = 'CommandOrControl+Shift+A'
const WINDOW_CAPTURE_SHORTCUT = 'CommandOrControl+Shift+W'

function loadPage(win: BrowserWindow, htmlFile: string) {
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(new URL(htmlFile, VITE_DEV_SERVER_URL).toString())
  } else {
    win.loadFile(path.join(RENDERER_DIST, htmlFile))
  }
}

function getSaveDir() {
  const dir = app.getPath('downloads')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function writeImageToClipboard(pngBuffer: Buffer) {
  await clipboard.write([
    new ClipboardItem({ 'image/png': new Blob([pngBuffer], { type: 'image/png' }) }),
  ])
}

/** Saves the capture, copies it to the clipboard, and opens the annotation editor. Returns the saved file path. */
async function finishCapture(image: NativeImage): Promise<string> {
  const pngBuffer = image.toPNG()
  await writeImageToClipboard(pngBuffer)

  const fileName = `capture-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
  const filePath = path.join(getSaveDir(), fileName)
  fs.writeFileSync(filePath, pngBuffer)

  mainWindow?.webContents.send('capture:done', { filePath })

  const notification = new Notification({
    title: '화면 캡처 완료',
    body: `클립보드에 복사됨\n${fileName}`,
  })
  notification.on('click', () => shell.showItemInFolder(filePath))
  notification.show()

  openEditorWindow(image, filePath)
  return filePath
}

async function getPrimaryDisplayScreenshot() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const scaleFactor = primaryDisplay.scaleFactor

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
    },
  })

  const primarySource =
    sources.find((s) => s.display_id === String(primaryDisplay.id)) ?? sources[0]

  return { primaryDisplay, image: primarySource?.thumbnail ?? null }
}

let includeCursor = false

const CURSOR_TEMPLATE = [
  'B...............',
  'BB..............',
  'BWB.............',
  'BWWB............',
  'BWWWB...........',
  'BWWWWB..........',
  'BWWWWWB.........',
  'BWWWWWWB........',
  'BWWWWWWWB.......',
  'BWWWWWWWWB......',
  'BWWWWWWWWWB.....',
  'BWWWWWWWWWWB....',
  'BWWWWWWBBBBBB...',
  'BWWWBWWB........',
  'BWWB..BWWB......',
  'BWB...BWWB......',
  'BB.....BWWB.....',
  'B......BWWB.....',
  '........BWWB....',
  '........BWWB....',
  '.........BBB....',
]

function drawCursorOnNativeImage(
  image: NativeImage,
  cursorX: number,
  cursorY: number,
  scaleFactor: number,
): NativeImage {
  const { width, height } = image.getSize()
  const bmp = image.toBitmap()

  const s = Math.max(1, Math.round(scaleFactor))
  const rows = CURSOR_TEMPLATE.length
  const cols = CURSOR_TEMPLATE[0].length

  const blendPixel = (px: number, py: number, r: number, g: number, b: number, alpha: number) => {
    if (px < 0 || px >= width || py < 0 || py >= height) return
    const idx = (py * width + px) * 4
    const invA = 1 - alpha
    bmp[idx] = Math.round(b * alpha + bmp[idx] * invA)
    bmp[idx + 1] = Math.round(g * alpha + bmp[idx + 1] * invA)
    bmp[idx + 2] = Math.round(r * alpha + bmp[idx + 2] * invA)
  }

  // Draw soft drop shadow offset
  const shadowOffsetX = s
  const shadowOffsetY = Math.max(1, Math.round(s * 1.5))
  for (let r = 0; r < rows; r++) {
    const row = CURSOR_TEMPLATE[r]
    for (let c = 0; c < cols; c++) {
      const char = row[c]
      if (char === 'B' || char === 'W') {
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            blendPixel(cursorX + c * s + dx + shadowOffsetX, cursorY + r * s + dy + shadowOffsetY, 0, 0, 0, 0.28)
          }
        }
      }
    }
  }

  // Draw cursor body
  for (let r = 0; r < rows; r++) {
    const row = CURSOR_TEMPLATE[r]
    for (let c = 0; c < cols; c++) {
      const char = row[c]
      if (char === 'B') {
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            blendPixel(cursorX + c * s + dx, cursorY + r * s + dy, 0, 0, 0, 1.0)
          }
        }
      } else if (char === 'W') {
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            blendPixel(cursorX + c * s + dx, cursorY + r * s + dy, 255, 255, 255, 1.0)
          }
        }
      }
    }
  }

  return nativeImage.createFromBitmap(bmp, { width, height })
}

function overlayCursorIfVisible(
  image: NativeImage,
  display: Electron.Display,
  cursorPoint: Electron.Point,
): NativeImage {
  // On Windows, desktopCapturer already captures the real system cursor natively
  // with custom shapes, colors, and accessibility sizes. Drawing a synthetic cursor
  // causes a duplicate cursor and must not be done.
  if (process.platform === 'win32') {
    return image
  }

  try {
    const { bounds, scaleFactor } = display
    if (
      cursorPoint.x < bounds.x ||
      cursorPoint.x >= bounds.x + bounds.width ||
      cursorPoint.y < bounds.y ||
      cursorPoint.y >= bounds.y + bounds.height
    ) {
      return image
    }

    const cursorX = Math.round((cursorPoint.x - bounds.x) * scaleFactor)
    const cursorY = Math.round((cursorPoint.y - bounds.y) * scaleFactor)

    return drawCursorOnNativeImage(image, cursorX, cursorY, scaleFactor)
  } catch (err) {
    console.error('Failed to overlay cursor:', err)
    return image
  }
}

async function captureFullScreen() {
  const cursorPoint = screen.getCursorScreenPoint()
  const { primaryDisplay, image } = await getPrimaryDisplayScreenshot()
  if (!image) {
    new Notification({ title: '캡처 실패', body: '캡처할 화면을 찾지 못했습니다.' }).show()
    return
  }
  let finalImage = image
  if (includeCursor) {
    finalImage = overlayCursorIfVisible(image, primaryDisplay, cursorPoint)
  }
  await finishCapture(finalImage)
}

type SelectionRect = { x: number; y: number; width: number; height: number }

function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close()
  overlayWindow = null
  ipcMain.removeAllListeners('overlay:complete')
  ipcMain.removeAllListeners('overlay:cancel')
}

async function startRegionCapture() {
  if (overlayWindow) return

  const cursorPoint = screen.getCursorScreenPoint()
  const { primaryDisplay, image } = await getPrimaryDisplayScreenshot()
  if (!image) {
    new Notification({ title: '캡처 실패', body: '캡처할 화면을 찾지 못했습니다.' }).show()
    return
  }

  let baseImage = image
  if (includeCursor) {
    baseImage = overlayCursorIfVisible(image, primaryDisplay, cursorPoint)
  }

  const { bounds, scaleFactor } = primaryDisplay

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.focus()

  const dataUrl = baseImage.toDataURL()

  overlayWindow.webContents.once('did-finish-load', () => {
    overlayWindow?.webContents.send('overlay:init', {
      dataUrl,
      width: bounds.width,
      height: bounds.height,
    })
  })

  loadPage(overlayWindow, 'overlay.html')

  ipcMain.once('overlay:complete', async (_event, rect: SelectionRect) => {
    closeOverlay()
    if (rect.width < 4 || rect.height < 4) return

    const pixelRect = {
      x: Math.round(rect.x * scaleFactor),
      y: Math.round(rect.y * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor),
    }
    const cropped = baseImage.crop(pixelRect)
    await finishCapture(cropped)
  })

  ipcMain.once('overlay:cancel', () => closeOverlay())

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

const OWN_WINDOW_TITLES = new Set(['화면 캡쳐', '창 선택', '캡처 편집'])

function closePicker() {
  if (pickerWindow && !pickerWindow.isDestroyed()) pickerWindow.close()
  pickerWindow = null
  ipcMain.removeAllListeners('picker:select')
  ipcMain.removeAllListeners('picker:cancel')
}

async function startWindowCapture() {
  if (pickerWindow) return

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 320, height: 200 },
  })

  const candidates = sources.filter((s) => s.name && !OWN_WINDOW_TITLES.has(s.name))

  if (candidates.length === 0) {
    new Notification({ title: '캡처할 창 없음', body: '열려 있는 다른 창을 찾지 못했습니다.' }).show()
    return
  }

  pickerWindow = new BrowserWindow({
    width: 640,
    height: 480,
    title: '창 선택',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  pickerWindow.focus()

  pickerWindow.webContents.once('did-finish-load', () => {
    pickerWindow?.webContents.send(
      'picker:init',
      candidates.map((s) => ({ id: s.id, name: s.name, thumbnailDataUrl: s.thumbnail.toDataURL() })),
    )
  })

  loadPage(pickerWindow, 'picker.html')

  ipcMain.once('picker:select', async (_event, sourceId: string) => {
    closePicker()

    const fullSources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 2560, height: 1600 },
    })
    const selected = fullSources.find((s) => s.id === sourceId)
    if (!selected) {
      new Notification({ title: '캡처 실패', body: '선택한 창을 다시 찾지 못했습니다.' }).show()
      return
    }
    await finishCapture(selected.thumbnail)
  })

  ipcMain.once('picker:cancel', () => closePicker())

  pickerWindow.on('closed', () => {
    pickerWindow = null
  })
}

function closeEditor() {
  if (editorWindow && !editorWindow.isDestroyed()) editorWindow.close()
  editorWindow = null
  ipcMain.removeHandler('editor:save')
  ipcMain.removeAllListeners('editor:close')
}

function openEditorWindow(image: NativeImage, filePath: string) {
  closeEditor()

  const { width, height } = image.getSize()
  const maxWidth = 1000
  const maxHeight = 800
  const scale = Math.min(1, maxWidth / width, maxHeight / height)

  editorWindow = new BrowserWindow({
    width: Math.max(480, Math.round(width * scale) + 48),
    height: Math.max(360, Math.round(height * scale) + 140),
    title: '캡처 편집',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Capture is usually triggered by a global shortcut while some other app has
  // OS focus. Windows can then show this window without giving it real
  // keyboard focus, so typed text silently goes to whatever was focused
  // before. Force focus now and again once content loads, so the text tool's
  // input reliably receives keystrokes.
  editorWindow.focus()

  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow?.webContents.send('editor:init', {
      dataUrl: image.toDataURL(),
      filePath,
    })
    editorWindow?.focus()
  })

  loadPage(editorWindow, 'editor.html')

  ipcMain.handle('editor:save', async (_event, payload: { dataUrl: string }) => {
    const base64 = payload.dataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    fs.writeFileSync(filePath, buffer)
    await writeImageToClipboard(buffer)

    new Notification({
      title: '편집 내용 저장 완료',
      body: `클립보드에 복사됨\n${path.basename(filePath)}`,
    }).show()
  })

  ipcMain.once('editor:close', () => closeEditor())

  editorWindow.on('closed', () => {
    editorWindow = null
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 580,
    resizable: false,
    autoHideMenuBar: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  loadPage(mainWindow, 'index.html')
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '전체화면 캡처', click: () => captureFullScreen() },
    { label: '영역 선택 캡처', click: () => startRegionCapture() },
    { label: '창 캡처', click: () => startWindowCapture() },
    { type: 'separator' },
    {
      label: '마우스 커서 포함',
      type: 'checkbox',
      checked: includeCursor,
      click: (menuItem) => {
        includeCursor = menuItem.checked
        updateTrayMenu()
        mainWindow?.webContents.send('capture:cursorChanged', includeCursor)
      },
    },
    { type: 'separator' },
    { label: '업데이트 확인', click: () => checkForUpdates(true) },
    { label: '창 열기', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        ;(app as any).isQuitting = true
        app.quit()
      },
    },
  ])
}

function updateTrayMenu() {
  if (!tray) return
  tray.setContextMenu(buildTrayMenu())
}

function createTray() {
  const icon = nativeImage.createFromPath(APP_ICON_PATH).resize({ width: 32, height: 32 })
  tray = new Tray(icon)
  tray.setToolTip('화면 캡쳐 앱')
  updateTrayMenu()
  tray.on('click', () => mainWindow?.show())
}

ipcMain.handle('capture:trigger', () => captureFullScreen())
ipcMain.handle('capture:triggerRegion', () => startRegionCapture())
ipcMain.handle('capture:triggerWindow', () => startWindowCapture())
ipcMain.handle('capture:getIncludeCursor', () => includeCursor)
ipcMain.handle('capture:setIncludeCursor', (_event, value: boolean) => {
  includeCursor = Boolean(value)
  updateTrayMenu()
  mainWindow?.webContents.send('capture:cursorChanged', includeCursor)
  return includeCursor
})

const execFileAsync = promisify(execFile)

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`다운로드 실패 (HTTP ${response.status})`)
  }

  const totalBytes = Number(response.headers.get('content-length')) || 0
  let receivedBytes = 0

  const source = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
  let lastReportedPercent = -1
  source.on('data', (chunk: Buffer) => {
    receivedBytes += chunk.length
    if (totalBytes <= 0) return
    const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
    if (percent !== lastReportedPercent) {
      lastReportedPercent = percent
      broadcastUpdateStatus({ state: 'downloading', percent })
    }
  })

  // pipeline: backpressure 처리 + 양쪽 스트림 오류를 reject로 전달
  await pipeline(source, fs.createWriteStream(destPath))
}

// macOS: zip을 받아 검증/압축 해제만 해 두고, 적용은 앱 종료 후 스크립트가 수행한다.
// (미서명 빌드라 Squirrel.Mac(ShipIt)을 쓸 수 없다)
async function stageMacUpdate(url: string, sha512: string | null): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mycap-update-'))
  try {
    const zipPath = path.join(dir, 'update.zip')
    await downloadFile(url, zipPath)

    if (sha512) {
      const actual = crypto.createHash('sha512').update(fs.readFileSync(zipPath)).digest('base64')
      if (actual !== sha512) throw new Error('다운로드 파일 해시가 일치하지 않습니다.')
    }

    const outDir = path.join(dir, 'out')
    await execFileAsync('/usr/bin/ditto', ['-x', '-k', zipPath, outDir])
    const appName = fs.readdirSync(outDir).find((n) => n.endsWith('.app'))
    if (!appName) throw new Error('압축 파일에서 앱을 찾을 수 없습니다.')
    return path.join(outDir, appName)
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true }) // 불완전한 파일 제거
    throw err
  }
}

function applyMacUpdate(): boolean {
  const target = path.resolve(app.getPath('exe'), '../../..')
  if (!stagedMacApp || !fs.existsSync(stagedMacApp) || !target.endsWith('.app')) return false
  try {
    fs.accessSync(path.dirname(target), fs.constants.W_OK)
  } catch {
    return false
  }

  // 앱이 종료될 때까지 기다린 뒤 교체하고 다시 실행한다. 복사 실패 시 기존 앱을 그대로 실행한다.
  const script =
    'while kill -0 "$1" 2>/dev/null; do sleep 0.5; done; ' +
    'ditto "$2" "$3.new" && rm -rf "$3" && mv "$3.new" "$3"; open "$3"'
  spawn('/bin/sh', ['-c', script, 'sh', String(process.pid), stagedMacApp, target], {
    detached: true,
    stdio: 'ignore',
  }).unref()
  ;(app as any).isQuitting = true
  app.quit()
  return true
}

ipcMain.handle('update:getInfo', () => ({
  version: app.getVersion(),
  isPortable,
  platform: process.platform,
}))
ipcMain.handle('update:check', () => checkForUpdates(true))
ipcMain.handle('update:startDownload', async () => {
  broadcastUpdateStatus({ state: 'downloading', percent: 0 })

  if (process.platform === 'darwin') {
    try {
      const version = availableUpdateVersion || app.getVersion()
      const url =
        availableZipUrl ||
        `https://github.com/sungback/MyCap/releases/download/v${version}/ScreenCaptureApp-${version}-arm64-mac.zip`

      stagedMacApp = await stageMacUpdate(url, availableZipSha512)

      broadcastUpdateStatus({
        state: 'downloaded',
        version,
      })

      const notification = new Notification({
        title: '업데이트 다운로드 완료',
        body: `v${version} 다운로드가 완료되었습니다.\n클릭하면 앱을 재시작하며 최신 버전이 적용됩니다.`,
      })
      notification.on('click', () => {
        applyMacUpdate()
      })
      notification.show()
    } catch (err: any) {
      console.error('macOS update download failed:', err)
      broadcastUpdateStatus({
        state: 'error',
        message: '업데이트 다운로드 중 오류가 발생했습니다. 수동 다운로드를 이용해 주세요.',
      })
    }
    return
  }

  try {
    await autoUpdater.downloadUpdate()
  } catch (err: any) {
    console.error('Download update failed:', err)
    broadcastUpdateStatus({
      state: 'error',
      message: '다운로드 중 문제가 발생했습니다. 수동 다운로드를 이용할 수 있습니다.',
    })
  }
})
ipcMain.handle('update:restart', async () => {
  if (process.platform === 'darwin') {
    if (!applyMacUpdate()) {
      // /Applications 쓰기 권한이 없는 등 자동 교체가 불가능한 경우
      shell.openExternal('https://github.com/sungback/MyCap/releases/latest')
    }
    return
  }
  ;(app as any).isQuitting = true
  autoUpdater.quitAndInstall(true, true)
})
ipcMain.handle('update:openDownloadPage', () => {
  shell.openExternal('https://github.com/sungback/MyCap/releases/latest')
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  setupAutoUpdater()

  globalShortcut.register(FULL_CAPTURE_SHORTCUT, () => {
    captureFullScreen()
  })
  globalShortcut.register(REGION_CAPTURE_SHORTCUT, () => {
    startRegionCapture()
  })
  globalShortcut.register(WINDOW_CAPTURE_SHORTCUT, () => {
    startWindowCapture()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // keep running in tray instead of quitting
  }
})
