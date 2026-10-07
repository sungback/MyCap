// 업데이트 관련 순수 로직(Electron 의존 없음). 단위 테스트 대상이다.

const RELEASE_DOWNLOAD_BASE = 'https://github.com/sungback/MyCap/releases/download'

export type UpdateFile = { url?: string; sha512?: string }

/** latest-mac.yml의 files 목록에서 macOS 업데이트 zip의 다운로드 주소와 sha512를 고른다. 없으면 관례적인 파일명으로 추정한다. */
export function pickMacZip(
  files: UpdateFile[] | undefined,
  version: string,
): { url: string; sha512: string | null } {
  const zip = files?.find((f) => f.url?.endsWith('-mac.zip'))
  const fileName = zip?.url ?? `ScreenCaptureApp-${version}-arm64-mac.zip`
  return { url: `${RELEASE_DOWNLOAD_BASE}/v${version}/${fileName}`, sha512: zip?.sha512 ?? null }
}
