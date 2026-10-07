import { describe, expect, it } from 'vitest'
import { isBitmapMostlyBlack, isSelectableWindow, parseWindowHandle } from './capture-utils.ts'

// width x height 크기의 BGRA 비트맵을 한 가지 색으로 채운다.
function solidBitmap(pixels: number, bgr: [number, number, number]): Uint8Array {
  const bmp = new Uint8Array(pixels * 4)
  for (let i = 0; i < pixels; i++) bmp.set([...bgr, 255], i * 4)
  return bmp
}

describe('isBitmapMostlyBlack', () => {
  const PIXELS = 400 * 300

  it('완전히 검은 화면은 true', () => {
    expect(isBitmapMostlyBlack(solidBitmap(PIXELS, [0, 0, 0]))).toBe(true)
  })

  it('밝은 화면은 false', () => {
    expect(isBitmapMostlyBlack(solidBitmap(PIXELS, [200, 200, 200]))).toBe(false)
  })

  it('검은 화면에 흰 점 하나가 있어도 true (작업 관리자 사례)', () => {
    const bmp = solidBitmap(PIXELS, [0, 0, 0])
    bmp.set([255, 255, 255, 255], 0)
    expect(isBitmapMostlyBlack(bmp)).toBe(true)
  })

  it('거의 검지만 완전히 검지는 않은 어두운 UI(채널 3 이하)는 true, 4 이상은 false', () => {
    expect(isBitmapMostlyBlack(solidBitmap(PIXELS, [3, 3, 3]))).toBe(true)
    expect(isBitmapMostlyBlack(solidBitmap(PIXELS, [4, 4, 4]))).toBe(false)
  })

  it('빈 비트맵은 캡처 실패로 보고 true', () => {
    expect(isBitmapMostlyBlack(new Uint8Array(0))).toBe(true)
  })
})

describe('parseWindowHandle', () => {
  it('window:<핸들>:<번호> 형식에서 핸들을 뽑는다', () => {
    expect(parseWindowHandle('window:12345:0')).toBe('12345')
  })

  it('숫자가 아니거나 형식이 다르면 null', () => {
    expect(parseWindowHandle('screen:0:0')).toBe('0') // 형식만 보고 숫자 여부를 판단한다
    expect(parseWindowHandle('window:abc:0')).toBeNull()
    expect(parseWindowHandle('window')).toBeNull()
    expect(parseWindowHandle('')).toBeNull()
  })
})

describe('isSelectableWindow', () => {
  it('일반 창은 선택 가능', () => {
    expect(isSelectableWindow('작업 관리자')).toBe(true)
    expect(isSelectableWindow('메모장')).toBe(true)
  })

  it('이름 없는 창, 앱 자신의 창, 시스템 보조 창은 제외', () => {
    expect(isSelectableWindow('')).toBe(false)
    expect(isSelectableWindow('화면 캡쳐')).toBe(false)
    expect(isSelectableWindow('창 선택')).toBe(false)
    expect(isSelectableWindow('캡처 편집')).toBe(false)
    expect(isSelectableWindow('IME Indicator')).toBe(false)
    expect(isSelectableWindow('Status')).toBe(false)
  })

  it('이름이 정확히 같을 때만 제외한다', () => {
    expect(isSelectableWindow('Status - Chrome')).toBe(true)
  })
})
