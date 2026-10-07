import { describe, expect, it } from 'vitest'
import { drawCursorOnBitmap } from './cursor-draw.ts'

const WIDTH = 40
const HEIGHT = 40

// 단색(회색) BGRA 비트맵
function bitmap(gray: number): Buffer {
  const bmp = Buffer.alloc(WIDTH * HEIGHT * 4, gray)
  for (let i = 3; i < bmp.length; i += 4) bmp[i] = 255
  return bmp
}

const pixel = (bmp: Buffer, x: number, y: number) => bmp[(y * WIDTH + x) * 4]

describe('drawCursorOnBitmap', () => {
  it('커서 좌상단은 검은 테두리, 안쪽은 흰색으로 그린다', () => {
    const bmp = bitmap(128)
    drawCursorOnBitmap(bmp, WIDTH, HEIGHT, 10, 10, 1)
    expect(pixel(bmp, 10, 10)).toBe(0) // 'B'
    expect(pixel(bmp, 11, 12)).toBe(255) // 'W' (3번째 줄 두 번째 칸)
  })

  it('커서 바깥 픽셀은 바뀌지 않는다', () => {
    const bmp = bitmap(128)
    drawCursorOnBitmap(bmp, WIDTH, HEIGHT, 10, 10, 1)
    expect(pixel(bmp, 0, 0)).toBe(128)
    expect(pixel(bmp, 39, 39)).toBe(128)
  })

  it('scaleFactor만큼 한 칸이 커진다', () => {
    const bmp = bitmap(128)
    drawCursorOnBitmap(bmp, WIDTH, HEIGHT, 4, 4, 2)
    expect(pixel(bmp, 4, 4)).toBe(0)
    expect(pixel(bmp, 5, 5)).toBe(0) // 첫 칸이 2x2
  })

  it('화면 밖으로 나가는 커서도 예외 없이 그려진다', () => {
    const bmp = bitmap(128)
    expect(() => drawCursorOnBitmap(bmp, WIDTH, HEIGHT, 38, 38, 1)).not.toThrow()
    expect(() => drawCursorOnBitmap(bmp, WIDTH, HEIGHT, -5, -5, 1)).not.toThrow()
  })

  it('알파 채널은 건드리지 않는다', () => {
    const bmp = bitmap(128)
    drawCursorOnBitmap(bmp, WIDTH, HEIGHT, 10, 10, 1)
    expect(bmp[(10 * WIDTH + 10) * 4 + 3]).toBe(255)
  })
})
