import { describe, expect, it } from 'vitest'
import { pickMacZip } from './update-utils.ts'

describe('pickMacZip', () => {
  const files = [
    { url: 'ScreenCaptureApp-0.0.31-arm64-mac.zip', sha512: 'ZIPHASH' },
    { url: 'ScreenCaptureApp-0.0.31-arm64.dmg', sha512: 'DMGHASH' },
  ]

  it('files 목록에서 mac zip과 sha512를 고른다 (dmg는 무시)', () => {
    expect(pickMacZip(files, '0.0.31')).toEqual({
      url: 'https://github.com/sungback/MyCap/releases/download/v0.0.31/ScreenCaptureApp-0.0.31-arm64-mac.zip',
      sha512: 'ZIPHASH',
    })
  })

  it('목록이 없거나 zip이 없으면 관례적인 파일명으로 추정하고 해시는 null', () => {
    const expected = {
      url: 'https://github.com/sungback/MyCap/releases/download/v0.0.31/ScreenCaptureApp-0.0.31-arm64-mac.zip',
      sha512: null,
    }
    expect(pickMacZip(undefined, '0.0.31')).toEqual(expected)
    expect(pickMacZip([files[1]], '0.0.31')).toEqual(expected)
  })
})
