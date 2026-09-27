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
import { fileURLToPath } from 'node:url'

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
  const dir = path.join(app.getPath('pictures'), 'ScreenCaptureApp')
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

async function captureFullScreen() {
  const { image } = await getPrimaryDisplayScreenshot()
  if (!image) {
    new Notification({ title: '캡처 실패', body: '캡처할 화면을 찾지 못했습니다.' }).show()
    return
  }
  await finishCapture(image)
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

  const { primaryDisplay, image } = await getPrimaryDisplayScreenshot()
  if (!image) {
    new Notification({ title: '캡처 실패', body: '캡처할 화면을 찾지 못했습니다.' }).show()
    return
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

  const dataUrl = image.toDataURL()

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
    const cropped = image.crop(pixelRect)
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

  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow?.webContents.send('editor:init', {
      dataUrl: image.toDataURL(),
      filePath,
    })
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
    width: 420,
    height: 400,
    resizable: false,
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

function createTray() {
  const icon = nativeImage.createFromPath(APP_ICON_PATH).resize({ width: 32, height: 32 })
  tray = new Tray(icon)
  tray.setToolTip('화면 캡쳐 앱')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '전체화면 캡처', click: () => captureFullScreen() },
      { label: '영역 선택 캡처', click: () => startRegionCapture() },
      { label: '창 캡처', click: () => startWindowCapture() },
      { type: 'separator' },
      { label: '창 열기', click: () => mainWindow?.show() },
      { type: 'separator' },
      {
        label: '종료',
        click: () => {
          ;(app as any).isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => mainWindow?.show())
}

ipcMain.handle('capture:trigger', () => captureFullScreen())
ipcMain.handle('capture:triggerRegion', () => startRegionCapture())
ipcMain.handle('capture:triggerWindow', () => startWindowCapture())

app.whenReady().then(() => {
  createWindow()
  createTray()

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
