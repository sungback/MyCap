import fs from 'node:fs'

// 앱 설정(userData/settings.json). 파일이 없거나 손상되면 기본값을 쓴다.
export type Settings = { includeCursor: boolean }

export function readSettings(filePath: string): Settings {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return { includeCursor: parsed.includeCursor === true }
  } catch {
    return { includeCursor: false }
  }
}

export function writeSettings(filePath: string, settings: Settings): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}
