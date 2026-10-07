import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readSettings, writeSettings } from './settings.ts'

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mycap-settings-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('settings', () => {
  it('파일이 없으면 기본값', () => {
    expect(readSettings(file)).toEqual({ includeCursor: false })
  })

  it('저장한 값을 다시 읽는다', () => {
    writeSettings(file, { includeCursor: true })
    expect(readSettings(file)).toEqual({ includeCursor: true })
  })

  it('손상된 파일은 기본값', () => {
    fs.writeFileSync(file, '{not json')
    expect(readSettings(file)).toEqual({ includeCursor: false })
  })

  it('boolean이 아닌 값은 false로 취급', () => {
    fs.writeFileSync(file, JSON.stringify({ includeCursor: 'yes' }))
    expect(readSettings(file)).toEqual({ includeCursor: false })
  })

  it('저장 경로가 잘못돼도 예외를 던지지 않는다', () => {
    expect(() => writeSettings(path.join(dir, 'no', 'such', 'dir', 's.json'), { includeCursor: true })).not.toThrow()
  })
})
