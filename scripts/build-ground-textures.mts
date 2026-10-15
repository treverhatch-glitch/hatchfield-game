/**
 * Build full-res seamless ground plates from the Gemini references.
 *   npx tsx scripts/build-ground-textures.mts [source-dir]
 * Writes 2048² JPEGs. The game downscales only through texture quality.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { makeSeamless } from '../src/render/world/groundSeam.ts'
import { paintMarkings } from '../src/render/world/raster.ts'

const SIZE = 2048
const srcDir = process.argv[2] ?? '/cursor/stores/bot/art/gemini/textures'
const outDir = 'public/art/textures/ground'
mkdirSync(outDir, { recursive: true })

const plates: { out: string; file: string }[] = [
  { out: 'grass.jpg', file: 'airport_grass.jpeg' },
  { out: 'tarmac.jpg', file: 'asphalt_road.jpeg' },
  { out: 'concrete.jpg', file: 'apron_concrete.jpeg' },
]

function decode(path: string): Buffer {
  const run = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  if (run.status !== 0) throw new Error(`${path}: ${run.stderr.toString()}`)
  return run.stdout
}

function encode(rgb: Uint8Array, dest: string) {
  const run = spawnSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${SIZE}x${SIZE}`, '-i', 'pipe:0', '-q:v', '2', dest],
    { input: Buffer.from(rgb), maxBuffer: 32 * 1024 * 1024 },
  )
  if (run.status !== 0) throw new Error(`${dest}: ${run.stderr.toString()}`)
}

function rgbaToRgb(rgba: Uint8Array): Uint8Array {
  const rgb = new Uint8Array((rgba.length / 4) * 3)
  const n = rgba.length / 4
  for (let i = 0; i < n; i++) {
    rgb[i * 3] = rgba[i * 4]
    rgb[i * 3 + 1] = rgba[i * 4 + 1]
    rgb[i * 3 + 2] = rgba[i * 4 + 2]
  }
  return rgb
}

for (const plate of plates) {
  const raw = decode(`${srcDir}/${plate.file}`)
  if (raw.length !== SIZE * SIZE * 3) throw new Error(`${plate.file} is ${raw.length} bytes, expected ${SIZE}² rgb`)
  const tiled = makeSeamless(new Uint8Array(raw), SIZE, SIZE, 3)
  const dest = `${outDir}/${plate.out}`
  encode(tiled, dest)
  console.log(dest, tiled.length)
}

const paint = paintMarkings(SIZE)
encode(rgbaToRgb(paint.data), `${outDir}/markings.jpg`)
console.log(`${outDir}/markings.jpg`)
