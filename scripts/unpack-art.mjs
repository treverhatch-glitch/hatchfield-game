// Unpack committed base64 art packs into public/art at build time. Node only, no Python,
// nothing runs in the browser. Idempotent: files already on disk with the right size are kept.
// Never throws: a missing or bad pack only warns and the game falls back to flat colours.
//
// Two pack shapes are understood:
//   <dir>/_b64/MANIFEST.json  [{ path, b64, nbytes }]   one .b64 text file per image
//   <dir>/_b64/pack*.json     { "name.jpg": "<base64>" } images land next to _b64/
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PACK_DIRS = ['public/art/textures/buildings/_b64', 'public/art/refs/airlines/_b64']

function writeIfNeeded(file, data) {
  if (existsSync(file) && statSync(file).size === data.length) return false
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, data)
  return true
}

function unpackManifest(root, dir, warn) {
  let n = 0
  for (const item of JSON.parse(readFileSync(join(dir, 'MANIFEST.json'), 'utf8'))) {
    try {
      const out = join(root, item.path)
      if (existsSync(out) && statSync(out).size === item.nbytes) continue
      const data = Buffer.from(readFileSync(join(dir, item.b64), 'utf8'), 'base64')
      if (data.length !== item.nbytes) throw new Error('size mismatch')
      if (writeIfNeeded(out, data)) n++
    } catch (e) {
      warn(`skipped ${item.path}: ${e.message}`)
    }
  }
  return n
}

function unpackJsonPacks(dir, warn) {
  let n = 0
  for (const name of readdirSync(dir).filter((f) => /^pack.*\.json$/.test(f)).sort()) {
    try {
      for (const [file, b64] of Object.entries(JSON.parse(readFileSync(join(dir, name), 'utf8')))) {
        if (writeIfNeeded(join(dir, '..', file), Buffer.from(b64, 'base64'))) n++
      }
    } catch (e) {
      warn(`skipped ${name}: ${e.message}`)
    }
  }
  return n
}

/** Returns the number of files written. `root` is the repo root. */
export function unpackArt(root = '.', { dirs = PACK_DIRS, log = console.log, warn = console.warn } = {}) {
  let total = 0
  for (const rel of dirs) {
    const dir = join(root, rel)
    const w = (m) => warn(`[art] ${m}`)
    try {
      if (!existsSync(dir)) continue
      if (existsSync(join(dir, 'MANIFEST.json'))) total += unpackManifest(root, dir, w)
      total += unpackJsonPacks(dir, w)
    } catch (e) {
      w(`unpack skipped for ${rel}: ${e.message}`)
    }
  }
  if (total) log(`[art] unpacked ${total} file(s)`)
  return total
}

if (process.argv[1] === fileURLToPath(import.meta.url)) unpackArt('.')
