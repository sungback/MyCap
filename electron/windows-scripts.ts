// Windows 전용 PowerShell 스크립트 모음. main.ts에서 임시 .ps1 파일로 저장해 실행한다.

// Windows: 주 모니터를 물리 픽셀 크기로 캡처한 뒤 실제 시스템 커서 핸들(색/모양/크기 그대로)을 DrawIconEx로 그린다.
export const WIN_CURSOR_CAPTURE_PS = `
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

// Windows: 작업 관리자처럼 GPU로 그려지는 창은 desktopCapturer가 검은 화면을 주므로,
// PrintWindow(PW_RENDERFULLCONTENT)로 창 내용을 직접 받아 온다.
export const WIN_PRINT_WINDOW_PS = `
param([string]$hwnd, [string]$out, [string]$mode)
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

// 화면에서 창 영역을 직접 잘라 찍는 2차 보정. PrintWindow도 검게 나오는 창(WinUI/GPU 렌더링)용.
// 창을 맨 앞으로 가져온 뒤 보이는 프레임 영역(그림자 제외)만 캡처한다.
export const WIN_SCREEN_CROP_PS = `
param([string]$hwnd, [string]$out, [string]$mode)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class MyCapCrop {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left; public int top; public int right; public int bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
}
'@
[void][MyCapCrop]::SetProcessDPIAware()
$h = [IntPtr][long]$hwnd
if ([MyCapCrop]::IsIconic($h)) {
  if ($mode -eq 'preview') { exit 1 }  # 미리보기 때문에 최소화된 창을 복원하지는 않는다
  [void][MyCapCrop]::ShowWindow($h, 9)
}
[void][MyCapCrop]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 500
$r = New-Object MyCapCrop+RECT
if ([MyCapCrop]::DwmGetWindowAttribute($h, 9, [ref]$r, 16) -ne 0) {
  if (-not [MyCapCrop]::GetWindowRect($h, [ref]$r)) { exit 1 }
}
$w = $r.right - $r.left
$ht = $r.bottom - $r.top
if ($w -lt 1 -or $ht -lt 1) { exit 1 }
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.left, $r.top, 0, 0, (New-Object System.Drawing.Size $w, $ht))
$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`
