/**
 * Seamless interior plates from the Gemini 2048 references.
 *   npx tsx scripts/build-interior-textures.mts [source-dir]
 *
 * Writes full-resolution JPEGs. The game builds mipmaps on the GPU and
 * only downscales when texture quality is med or low.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { makeSeamless } from '../src/render/world/groundSeam.ts'
import { calmField, liftDarkPlanks, PALE_SAND, repairRim, shiftToward } from '../src/render/world/interiorGrade.ts'

const SIZE = 2048
const srcDir = process.argv[2] ?? '/tmp/gemini-src'
const outDir = 'public/art/textures/interiors'
mkdirSync(outDir, { recursive: true })

type Grade = 'calm' | 'plank' | 'sand' | 'rim'

const plates: { src: string; out: string; grade: Grade; also?: string; healEdge?: boolean }[] = [
  { src: 'gate_carpet.jpeg', out: 'gate_carpet.jpg', grade: 'calm', also: 'public/assets/pack1/tex_carpet_gate_navy.jpg' },
  { src: 'wall_panel_cream.jpeg', out: 'wall_panel_cream.jpg', grade: 'rim', also: 'public/assets/pack1/tex_wall_panel_cream_v1.jpg', healEdge: true },
  { src: 'brushed_steel.jpeg', out: 'brushed_steel.jpg', grade: 'rim', also: 'public/assets/pack1/tex_steel_brushed_v1.jpg' },
  { src: 'oak_veneer.jpeg', out: 'oak_veneer.jpg', grade: 'rim', also: 'public/assets/pack1/tex_wood_oak_v1.jpg' },
  { src: 'security_rubber.jpeg', out: 'security_rubber.jpg', grade: 'sand' },
  { src: 'shop_plank.jpeg', out: 'shop_plank.jpg', grade: 'plank', healEdge: true },
  { src: 'ceiling_baffle.jpeg', out: 'ceiling_baffle.jpg', grade: 'rim', also: 'public/assets/pack4/tex_ceiling_tiles.jpg' },
  { src: 'restroom_tile.jpeg', out: 'restroom_tile.jpg', grade: 'rim' },
]

function decode(path: string): Buffer {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], {
    maxBuffer: 64 * 1024 * 1024,
  })
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

function grade(kind: Grade, raw: Uint8Array): Uint8Array {
  if (kind === 'calm') return calmField(raw, SIZE, SIZE, 3, 0.42, 0.5)
  if (kind === 'sand') return shiftToward(repairRim(raw, SIZE, SIZE), SIZE, SIZE, 3, PALE_SAND)
  if (kind === 'plank') return liftDarkPlanks(repairRim(raw, SIZE, SIZE, 3, 160), SIZE, SIZE)
  return repairRim(raw, SIZE, SIZE)
}

for (const plate of plates) {
  const raw = decode(`${srcDir}/${plate.src}`)
  if (raw.length !== SIZE * SIZE * 3) throw new Error(`${plate.src} is ${raw.length} bytes, expected ${SIZE}² rgb`)
  let tiled = makeSeamless(grade(plate.grade, new Uint8Array(raw)), SIZE, SIZE, 3)
  if (plate.healEdge) tiled = repairRim(tiled, SIZE, SIZE, 3, 185)
  const dest = `${outDir}/${plate.out}`
  encode(tiled, dest)
  if (plate.also) copyFileSync(dest, plate.also)
  console.log(dest, plate.also ?? '')
}
