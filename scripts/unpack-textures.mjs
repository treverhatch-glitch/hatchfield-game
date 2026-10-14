// Unpack base64 building textures (see public/art/textures/buildings/_b64/README.md).
// Never fails the build: missing or bad data only warns; the game falls back to plain colours.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const dir = 'public/art/textures/buildings/_b64'
try {
  const manifest = join(dir, 'MANIFEST.json')
  if (!existsSync(manifest)) {
    console.warn('[textures] no _b64 manifest; using plain colours')
  } else {
    let n = 0
    for (const item of JSON.parse(readFileSync(manifest, 'utf8'))) {
      try {
        if (existsSync(item.path) && statSync(item.path).size === item.nbytes) continue
        const data = Buffer.from(readFileSync(join(dir, item.b64), 'utf8'), 'base64')
        if (data.length !== item.nbytes) throw new Error('size mismatch')
        mkdirSync(dirname(item.path), { recursive: true })
        writeFileSync(item.path, data)
        n++
      } catch (e) {
        console.warn(`[textures] skipped ${item.path}: ${e.message}`)
      }
    }
    if (n) console.log(`[textures] unpacked ${n}`)
  }
} catch (e) {
  console.warn(`[textures] unpack skipped: ${e.message}`)
}
