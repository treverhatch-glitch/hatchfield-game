// @ts-nocheck -- plain .mjs build script, outside the tsc project
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { unpackArt } from '../../scripts/unpack-art.mjs'

const bytes = Buffer.from('hello art')
let root = ''

function fixture() {
  root = mkdtempSync(join(tmpdir(), 'art-'))
  const tex = join(root, 'public/art/textures/buildings/_b64')
  mkdirSync(tex, { recursive: true })
  writeFileSync(join(tex, 'a.b64'), bytes.toString('base64'))
  writeFileSync(
    join(tex, 'MANIFEST.json'),
    JSON.stringify([{ path: 'public/art/textures/buildings/a.jpg', b64: 'a.b64', nbytes: bytes.length }]),
  )
  const air = join(root, 'public/art/refs/airlines/_b64')
  mkdirSync(air, { recursive: true })
  writeFileSync(join(air, 'pack0.json'), JSON.stringify({ 'x.jpg': bytes.toString('base64') }))
}

afterEach(() => root && rmSync(root, { recursive: true, force: true }))

describe('unpackArt', () => {
  const quiet = { log: () => {}, warn: () => {} }

  it('writes manifest and json-pack files, then is a no-op', () => {
    fixture()
    expect(unpackArt(root, quiet)).toBe(2)
    expect(readFileSync(join(root, 'public/art/textures/buildings/a.jpg'))).toEqual(bytes)
    expect(statSync(join(root, 'public/art/refs/airlines/x.jpg')).size).toBe(bytes.length)
    expect(unpackArt(root, quiet)).toBe(0)
  })

  it('restores a truncated file', () => {
    fixture()
    unpackArt(root, quiet)
    writeFileSync(join(root, 'public/art/textures/buildings/a.jpg'), 'x')
    expect(unpackArt(root, quiet)).toBe(1)
  })

  it('warns instead of throwing on a corrupt pack', () => {
    fixture()
    writeFileSync(join(root, 'public/art/refs/airlines/_b64/pack0.json'), '{bad')
    const warns: string[] = []
    expect(() => unpackArt(root, { log: () => {}, warn: (m: string) => warns.push(m) })).not.toThrow()
    expect(warns.length).toBeGreaterThan(0)
  })

  it('does nothing when there are no packs', () => {
    root = mkdtempSync(join(tmpdir(), 'art-'))
    expect(unpackArt(root, quiet)).toBe(0)
  })
})
