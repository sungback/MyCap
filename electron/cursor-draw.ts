// macOS에서 screencapture -C가 실패했을 때 쓰는 합성 화살표 커서. 비트맵(BGRA)을 직접 수정한다.
// Windows에서는 이중 커서가 생기므로 사용하지 않는다. (AGENTS.md 참고)

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

const SHADOW_ALPHA = 0.28

/** BGRA 비트맵(width x height)의 (cursorX, cursorY)에 화살표 커서와 그림자를 그린다. 한 칸을 scale 픽셀로 확대한다. */
export function drawCursorOnBitmap(
  bmp: Buffer,
  width: number,
  height: number,
  cursorX: number,
  cursorY: number,
  scaleFactor: number,
): void {
  const scale = Math.max(1, Math.round(scaleFactor))

  const blendPixel = (px: number, py: number, gray: 0 | 255, alpha: number) => {
    if (px < 0 || px >= width || py < 0 || py >= height) return
    const idx = (py * width + px) * 4
    for (let channel = 0; channel < 3; channel++) {
      bmp[idx + channel] = Math.round(gray * alpha + bmp[idx + channel] * (1 - alpha))
    }
  }

  // 템플릿의 한 칸(scale x scale 픽셀)마다 draw를 호출한다.
  const forEachCell = (draw: (x: number, y: number, cell: string) => void, offsetX = 0, offsetY = 0) => {
    CURSOR_TEMPLATE.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '.') continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            draw(cursorX + c * scale + dx + offsetX, cursorY + r * scale + dy + offsetY, row[c])
          }
        }
      }
    })
  }

  // 그림자 → 본체(B: 검은 테두리, W: 흰 채우기) 순서
  forEachCell((x, y) => blendPixel(x, y, 0, SHADOW_ALPHA), scale, Math.max(1, Math.round(scale * 1.5)))
  forEachCell((x, y, cell) => blendPixel(x, y, cell === 'B' ? 0 : 255, 1))
}
