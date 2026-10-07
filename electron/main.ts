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

// 로그인 시 자동 실행으로 켜진 경우 창 없이 트레이로만 시작한다.
// (포터블/개발 모드는 실행 파일 경로가 일정하지 않아 등록하지 않는다)
// Windows는 조회 시에도 등록할 때와 같은 args가 필요하다.
const LOGIN_ITEM_ARGS = { args: ['--hidden'] }
const canAutoLaunch = app.isPackaged && !isPortable
const startHidden =
  process.argv.includes('--hidden') ||
  (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)

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

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadIncludeCursor(): boolean {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).includeCursor === true
  } catch {
    return false // 파일이 없거나 손상된 경우 기본값
  }
}

function setIncludeCursor(value: boolean) {
  includeCursor = value
  try {
    fs.writeFileSync(settingsPath, JSON.stringify({ includeCursor }))
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

let includeCursor = loadIncludeCursor()

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

// Windows: 주 모니터를 물리 픽셀 크기로 캡처한 뒤 실제 시스템 커서 핸들(색/모양/크기 그대로)을 DrawIconEx로 그린다.
const WIN_CURSOR_CAPTURE_PS = `
param([string]$out)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class MyCapCursor {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] public struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT pt; }
  [StructLayout(LayoutKind.Sequential)] public struct BITMAP { public int bmType; public int bmWidth; public int bmHeight; public int bmWidthBytes; public ushort bmPlanes; public ushort bmBitsPixel; public IntPtr bmBits; }
  [StructLayout(LayoutKind.Sequential)] public struct ICONINFO { public bool fIcon; public int xHotspot; public int yHotspot; public IntPtr hbmMask; public IntPtr hbmColor; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref CURSORINFO p);
  [DllImport("user32.dll")] public static extern bool GetIconInfo(IntPtr h, out ICONINFO i);
  [DllImport("user32.dll")] public static extern bool DrawIconEx(IntPtr hdc, int x, int y, IntPtr h, int w, int hh, int step, IntPtr br, int flags);
  [DllImport("gdi32.dll")] public static extern int GetObject(IntPtr h, int c, ref BITMAP b);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr o);
}
'@
[void][MyCapCursor]::SetProcessDPIAware()
$w = [MyCapCursor]::GetSystemMetrics(0)
$h = [MyCapCursor]::GetSystemMetrics(1)
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, (New-Object System.Drawing.Size $w, $h))
# 접근성 "포인터 크기" 설정(CursorBaseSize)이 곧 표시 크기. 캡처할 때마다 읽으므로 설정 변경이 바로 반영된다.
# (DPI 배율을 추가로 곱하면 이중 적용되어 125%에서 커 보인다.)
$target = 32
try { $target = [int](Get-ItemPropertyValue 'HKCU:\\Control Panel\\Cursors' -Name CursorBaseSize) } catch {}
$ci = New-Object MyCapCursor+CURSORINFO
$ci.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($ci)
if ([MyCapCursor]::GetCursorInfo([ref]$ci) -and ($ci.flags -band 1)) {
  $ii = New-Object MyCapCursor+ICONINFO
  if ([MyCapCursor]::GetIconInfo($ci.hCursor, [ref]$ii)) {
    $bm = New-Object MyCapCursor+BITMAP
    $src = $ii.hbmColor
    if ($src -eq [IntPtr]::Zero) { $src = $ii.hbmMask }
    [void][MyCapCursor]::GetObject($src, [System.Runtime.InteropServices.Marshal]::SizeOf($bm), [ref]$bm)
    $nat = $bm.bmWidth
    if ($nat -lt 1) { $nat = 32 }
    $size = [math]::Max($nat, $target)
    $k = $size / $nat
    $hdc = $g.GetHdc()
    [void][MyCapCursor]::DrawIconEx($hdc, $ci.pt.x - [int][math]::Round($ii.xHotspot * $k), $ci.pt.y - [int][math]::Round($ii.yHotspot * $k), $ci.hCursor, $size, $size, 0, [IntPtr]::Zero, 3)
    $g.ReleaseHdc($hdc)
    if ($ii.hbmMask -ne [IntPtr]::Zero) { [void][MyCapCursor]::DeleteObject($ii.hbmMask) }
    if ($ii.hbmColor -ne [IntPtr]::Zero) { [void][MyCapCursor]::DeleteObject($ii.hbmColor) }
  }
}
$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`

async function runPowerShellScript(script: string, args: string[]) {
  const ps1 = path.join(os.tmpdir(), `mycap-${process.pid}-${Date.now()}.ps1`)
  fs.writeFileSync(ps1, script)
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...args],
      { windowsHide: true },
    )
  } finally {
    fs.rmSync(ps1, { force: true })
  }
}

// 실제 커서가 포함된 이미지를 만들어 주는 외부 명령을 실행한다. 크기가 다르거나 실패하면 null.
async function captureWithRealCursor(
  image: NativeImage,
  run: (outPath: string) => Promise<unknown>,
): Promise<NativeImage | null> {
  const tmp = path.join(os.tmpdir(), `mycap-cursor-${process.pid}.png`)
  try {
    await run(tmp)
    const real = nativeImage.createFromPath(tmp)
    const a = real.getSize()
    const b = image.getSize()
    return a.width === b.width && a.height === b.height ? real : null
  } catch (err) {
    console.error('Real cursor capture failed:', err)
    return null
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

async function overlayCursorIfVisible(
  image: NativeImage,
  display: Electron.Display,
  cursorPoint: Electron.Point,
): Promise<NativeImage> {
  // desktopCapturer는 환경에 따라 커서를 빼므로, 두 OS 모두 실제 커서가 담긴 이미지로 교체한다.
  // 이미지를 통째로 교체하므로 커서가 이중으로 그려지지 않는다. 실패하면 Windows는 원본을 그대로 쓴다.
  if (process.platform === 'win32') {
    const real = await captureWithRealCursor(image, (out) =>
      runPowerShellScript(WIN_CURSOR_CAPTURE_PS, [out]),
    )
    return real ?? image
  }

  // macOS: 실제 커서(색/크기 포함)를 그려 주는 screencapture -C 결과를 쓴다. 실패하면 아래 합성 커서로 대체한다.
  if (process.platform === 'darwin') {
    const real = await captureWithRealCursor(image, (out) =>
      execFileAsync('/usr/sbin/screencapture', ['-C', '-x', out]),
    )
    if (real) return real
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
    finalImage = await overlayCursorIfVisible(image, primaryDisplay, cursorPoint)
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
    baseImage = await overlayCursorIfVisible(image, primaryDisplay, cursorPoint)
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

// Windows: 작업 관리자처럼 GPU로 그려지는 창은 desktopCapturer가 검은 화면을 주므로,
// PrintWindow(PW_RENDERFULLCONTENT)로 창 내용을 직접 받아 온다.
const WIN_PRINT_WINDOW_PS = `
param([string]$hwnd, [string]$out)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class MyCapWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left; public int top; public int right; public int bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
}
'@
[void][MyCapWin]::SetProcessDPIAware()
$h = [IntPtr][long]$hwnd
$r = New-Object MyCapWin+RECT
if (-not [MyCapWin]::GetWindowRect($h, [ref]$r)) { exit 1 }
$w = $r.right - $r.left
$ht = $r.bottom - $r.top
if ($w -lt 1 -or $ht -lt 1) { exit 1 }
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [MyCapWin]::PrintWindow($h, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
if (-not $ok) { exit 1 }
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`

// 샘플링해서 거의 전부 검은색이면 캡처 실패로 본다.
function isMostlyBlack(image: NativeImage): boolean {
  const bmp = image.toBitmap()
  const step = 4 * 97
  for (let i = 0; i < bmp.length; i += step) {
    if (bmp[i] > 3 || bmp[i + 1] > 3 || bmp[i + 2] > 3) return false
  }
  return true
}

async function recoverBlackWindowCapture(image: NativeImage, sourceId: string): Promise<NativeImage> {
  if (process.platform !== 'win32' || !isMostlyBlack(image)) return image
  const hwnd = sourceId.split(':')[1]
  if (!/^\d+$/.test(hwnd ?? '')) return image
  const out = path.join(os.tmpdir(), `mycap-window-${process.pid}.png`)
  try {
    await runPowerShellScript(WIN_PRINT_WINDOW_PS, [hwnd, out])
    const printed = nativeImage.createFromPath(out)
    return printed.isEmpty() || isMostlyBlack(printed) ? image : printed
  } catch (err) {
    console.error('PrintWindow capture failed:', err)
    return image
  } finally {
    fs.rmSync(out, { force: true })
  }
}

const OWN_WINDOW_TITLES = new Set(['화면 캡쳐', '창 선택', '캡처 편집'])
// 사용자가 캡처할 일이 없는 시스템 보조 창(입력기 표시 등). 이름이 정확히 일치할 때만 제외한다.
const SYSTEM_HELPER_WINDOW_TITLES = new Set(['IME Indicator', 'Status'])

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

  const candidates = sources.filter(
    (s) => s.name && !OWN_WINDOW_TITLES.has(s.name) && !SYSTEM_HELPER_WINDOW_TITLES.has(s.name),
  )

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
    await finishCapture(await recoverBlackWindowCapture(selected.thumbnail, sourceId))
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
    show: !startHidden,
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
        setIncludeCursor(menuItem.checked)
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
  // macOS: 메뉴 막대 색에 맞춰 자동으로 흑백 처리되는 템플릿 이미지(trayTemplate@2x.png 자동 선택)를 쓴다.
  const icon =
    process.platform === 'darwin'
      ? nativeImage.createFromPath(path.join(path.dirname(APP_ICON_PATH), 'trayTemplate.png'))
      : nativeImage.createFromPath(APP_ICON_PATH).resize({ width: 32, height: 32 })
  if (process.platform === 'darwin') icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('화면 캡쳐 앱')
  updateTrayMenu()
  tray.on('click', () => mainWindow?.show())
}

ipcMain.handle('capture:trigger', () => captureFullScreen())
ipcMain.handle('capture:triggerRegion', () => startRegionCapture())
ipcMain.handle('capture:triggerWindow', () => startWindowCapture())
ipcMain.handle('capture:getIncludeCursor', () => includeCursor)
ipcMain.handle('app:getOpenAtLogin', () => canAutoLaunch && app.getLoginItemSettings(LOGIN_ITEM_ARGS).openAtLogin)
ipcMain.handle('app:setOpenAtLogin', (_event, value: boolean) => {
  if (!canAutoLaunch) return false
  app.setLoginItemSettings({ openAtLogin: Boolean(value), ...LOGIN_ITEM_ARGS })
  return app.getLoginItemSettings(LOGIN_ITEM_ARGS).openAtLogin
})
ipcMain.handle('capture:setIncludeCursor', (_event, value: boolean) => {
  setIncludeCursor(Boolean(value))
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
  canAutoLaunch,
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
