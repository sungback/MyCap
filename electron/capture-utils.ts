// 캡처 관련 순수 로직(Electron 의존 없음). 단위 테스트 대상이다.

const BYTES_PER_PIXEL = 4 // BGRA
const SAMPLE_EVERY_N_PIXELS = 97
const BLACK_MAX_CHANNEL = 3
const MIN_LIT_RATIO = 0.01

/**
 * BGRA 비트맵을 듬성듬성 샘플링해서 밝은 픽셀이 1% 미만이면 "검은 화면"으로 본다.
 * 검은 화면에 흰 점이 하나 찍히는 경우가 있어 "하나라도 밝으면 정상"으로 판단하지 않는다.
 */
export function isBitmapMostlyBlack(bmp: Uint8Array): boolean {
  const step = BYTES_PER_PIXEL * SAMPLE_EVERY_N_PIXELS
  let total = 0
  let lit = 0
  for (let i = 0; i + 2 < bmp.length; i += step) {
    total++
    if (bmp[i] > BLACK_MAX_CHANNEL || bmp[i + 1] > BLACK_MAX_CHANNEL || bmp[i + 2] > BLACK_MAX_CHANNEL) {
      lit++
    }
  }
  return total === 0 || lit / total < MIN_LIT_RATIO
}

/** desktopCapturer 소스 ID("window:12345:0")에서 창 핸들(숫자 문자열)을 뽑는다. 형식이 다르면 null. */
export function parseWindowHandle(sourceId: string): string | null {
  const handle = sourceId.split(':')[1]
  return handle !== undefined && /^\d+$/.test(handle) ? handle : null
}

const OWN_WINDOW_TITLES = new Set(['화면 캡쳐', '창 선택', '캡처 편집'])
// 사용자가 캡처할 일이 없는 시스템 보조 창(입력기 표시 등). 이름이 정확히 일치할 때만 제외한다.
const SYSTEM_HELPER_WINDOW_TITLES = new Set(['IME Indicator', 'Status'])

/** 창 선택 목록에 보여 줄 창인지 판단한다. (이름이 없는 창, 앱 자신의 창, 시스템 보조 창은 제외) */
export function isSelectableWindow(name: string): boolean {
  return name !== '' && !OWN_WINDOW_TITLES.has(name) && !SYSTEM_HELPER_WINDOW_TITLES.has(name)
}
