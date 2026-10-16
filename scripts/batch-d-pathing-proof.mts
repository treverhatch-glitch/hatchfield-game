/**
 * Rendered proof that service trucks stay on pavement.
 *   01-city-cargo-road-stop.mp4 — city cargo stops on the road beside the shed
 *   02-fuel-pavement-farm-stand.mp4 — bowser stays on taxi from the farm to the stand
 *   03-bag-tug-beside-belts.mp4 — tug drives the apron beside the belts
 *
 *   npx tsx scripts/batch-d-pathing-proof.mts
 * Frames are stepped at 12 fps. ffmpeg is given that rate, so the file plays at 12 fps.
 */
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { bowserPath, nearestPath, pathBeside, shedStops, tilesOf } from '../src/game/path.ts'
import type { Tile, Vec } from '../src/game/types.ts'

const out = 'docs/devlog/media/batch-d-pathing-fix'
const work = '/tmp/batch-d-pathing-proof'
rmSync(work, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
mkdirSync(work, { recursive: true })

const FPS = 12
const DT = 1 / FPS
const CELL = 22 * 0.45
const HALF = 15.5

const server = await createServer({ server: { port: 45348, strictPort: true }, logLevel: 'error' })
await server.listen()
const url = server.resolvedUrls!.local[0]
console.log('vite', url)

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))

async function finish(code: number) {
  await browser.close()
  await server.close()
  if (errors.length) console.error(errors.slice(0, 8).join('\n'))
  process.exit(code)
}

await page.addInitScript(() => localStorage.setItem('hatchfield-gfx', 'high'))
await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 })
await page.getByTestId('new-game').click({ timeout: 60000 })
await page.waitForSelector('[data-testid="start-pax"]', { timeout: 60000 })
await page.getByTestId('start-pax').click()
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site), null, {
  timeout: 60000,
})

await page.evaluate(() => {
  const g = (window as unknown as { __hatch: Hatch }).__hatch
  const w = (window as unknown as { __world: World }).__world
  g.buildStarterKit()
  g.setView('apron')
  g.speed = 0
  g.scheduleAuto = false
  g.spawnCool = 1e9
  g.offerCool = 1e9
  g.setDayNightCycle(false)
  w.setDayNight({ hour: 11 })
})
await page.waitForFunction(() => {
  const tiles = (window as unknown as { __hatch?: { tiles?: string[][] } }).__hatch?.tiles
  return Boolean(tiles?.some((row) => row.includes('bags')))
}, null, { timeout: 20000 })
await page.waitForTimeout(400)
const coach = page.getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.first().click()
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }',
})

await page.evaluate(() => {
  const w = (window as unknown as { __world: World }).__world
  const gl = w.renderer.render.bind(w.renderer)
  w.renderer.render = function (scene, camera) {
    const lock = (w as unknown as { __lock?: Lock }).__lock
    if (lock) {
      camera.position.set(lock.cx, lock.cy, lock.cz)
      camera.lookAt(lock.tx, lock.ty, lock.tz)
      camera.updateMatrixWorld()
    }
    return gl(scene, camera)
  }
})

type Hatch = {
  setView: (v: string) => void
  speed: number
  scheduleAuto: boolean
  spawnCool: number
  offerCool: number
  buildStarterKit: () => void
  setDayNightCycle: (on: boolean) => void
  tiles: string[][]
  trucks: { id: string; x: number; y: number; path: { c: number; r: number }[]; preDwell: number }[]
  spawnTruck: (
    kind: string,
    flight: null,
    path: { c: number; r: number }[],
    mission?: string,
    home?: { c: number; r: number },
  ) => void
  tick: (dt: number) => void
}
type World = {
  renderer: {
    render: (
      scene: unknown,
      camera: {
        position: { set: (x: number, y: number, z: number) => void }
        lookAt: (x: number, y: number, z: number) => void
        updateMatrixWorld: () => void
      },
    ) => void
  }
  setDayNight: (opts: { hour: number }) => void
}
type Lock = { cx: number; cy: number; cz: number; tx: number; ty: number; tz: number }

const rawTiles = await page.evaluate(() => (window as unknown as { __hatch: Hatch }).__hatch.tiles)
const tiles = rawTiles as Tile[][]
const shed = tilesOf(tiles, 'cargo')
const stops = shedStops(tiles, shed)
const cargoPath = nearestPath(tiles, { c: 17, r: 0 }, stops, 'truck', undefined, 'outside')
const fuelRoute = bowserPath(tiles, { c: 7, r: 5 }, [{ c: 11, r: 6 }])
const tugPath = pathBeside(tiles, tilesOf(tiles, 'bags')[0], [{ c: 11, r: 6 }])
const beltCells = new Set(tilesOf(tiles, 'belt').map((cell) => `${cell.c},${cell.r}`))

function fmt(path: Vec[] | null | undefined) {
  return path ? path.map((cell) => `${cell.c},${cell.r}:${tiles[cell.r][cell.c]}`).join(' ') : 'null'
}
console.log('cargo', fmt(cargoPath))
console.log('fuel', fmt(fuelRoute?.path), 'dock', fuelRoute?.dock)
console.log('tug', fmt(tugPath))

if (!cargoPath || tiles[cargoPath.at(-1)!.r][cargoPath.at(-1)!.c] !== 'road') {
  throw new Error('city cargo does not stop on a road')
}
if (cargoPath.some((cell) => tiles[cell.r][cell.c] === 'cargo')) throw new Error('city cargo enters the shed')
if (!fuelRoute || fuelRoute.path.some((cell) => cell.c === 7 && cell.r === 6)) {
  throw new Error('fuel route uses the grass gap south of the farm')
}
if (fuelRoute.path.some((cell) => !['road', 'taxi', 'stand'].includes(tiles[cell.r][cell.c]))) {
  throw new Error('fuel route leaves the pavement')
}
if (!tugPath || tugPath.some((cell) => tiles[cell.r][cell.c] === 'belt' || tiles[cell.r][cell.c] === 'bags')) {
  throw new Error('tug route uses a belt or the sort building')
}

async function spawn(kind: string, path: Vec[], mission: string, home: Vec) {
  return page.evaluate(
    ({ kind, path, mission, home }) => {
      const g = (window as unknown as { __hatch: Hatch }).__hatch
      g.spawnTruck(kind, null, path, mission, home)
      const truck = g.trucks[g.trucks.length - 1]
      truck.preDwell = 0
      return truck.id
    },
    { kind, path, mission, home },
  )
}

const worldOf = (c: number, r: number) => ({ x: (c - HALF) * CELL, z: (r - HALF) * CELL })

async function aim(c: number, r: number, dx: number, dy: number, dz: number) {
  const at = worldOf(c, r)
  await page.evaluate(
    ({ at, dx, dy, dz }) => {
      ;(window as unknown as { __world: { __lock: Lock } }).__world.__lock = {
        cx: at.x + dx,
        cy: dy,
        cz: at.z + dz,
        tx: at.x,
        ty: 1.2,
        tz: at.z,
      }
    },
    { at, dx, dy, dz },
  )
}

async function paint() {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

async function step(seconds: number) {
  const n = Math.max(1, Math.round(seconds * FPS))
  await page.evaluate(
    ({ n, dt }) => {
      const g = (window as unknown as { __hatch: Hatch }).__hatch
      for (let i = 0; i < n; i++) {
        g.speed = 1
        g.tick(dt)
        g.speed = 0
      }
    },
    { n, dt: DT },
  )
}

async function pose(id: string) {
  return page.evaluate((id) => {
    const g = (window as unknown as { __hatch: Hatch }).__hatch
    const truck = g.trucks.find((row) => row.id === id)
    return truck ? { x: truck.x, y: truck.y } : null
  }, id)
}

function encode(dir: string, file: string) {
  const ff = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-start_number',
      '1',
      '-i',
      `${dir}/frame-%03d.png`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      file,
    ],
    { stdio: 'inherit' },
  )
  if (ff.status !== 0) throw new Error(`ffmpeg ${ff.status}`)
}

async function clip(dir: string, frames: number, place: (i: number) => Promise<void>) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < frames; i++) {
    await place(i)
    await paint()
    const name = String(i + 1).padStart(3, '0')
    await page.screenshot({ path: `${dir}/frame-${name}.png` })
    if (i % 24 === 0) console.log(dir, i)
  }
}

const cargoTrail: { x: number; y: number }[] = []
const fuelTrail: { x: number; y: number }[] = []
const tugTrail: { x: number; y: number }[] = []

const cargoId = await spawn('citycargo', cargoPath, 'city_shed', cargoPath[cargoPath.length - 1])
const cargoDir = `${work}/cargo`
await clip(cargoDir, FPS * 8, async () => {
  await aim(15.6, 2.4, 18, 26, 16)
  await step(DT)
  const now = await pose(cargoId)
  if (now) cargoTrail.push(now)
})

const fuelId = await spawn('fuel', fuelRoute.path, 'fuel', fuelRoute.dock)
const fuelDir = `${work}/fuel`
await clip(fuelDir, FPS * 6, async () => {
  await aim(9.2, 5.7, 14, 22, 12)
  await step(DT)
  const now = await pose(fuelId)
  if (now) fuelTrail.push(now)
})

const tugId = await spawn('bags', tugPath, 'unload', tugPath[0])
const tugDir = `${work}/tug`
await clip(tugDir, FPS * 6, async () => {
  await aim(12.6, 7.6, 6, 26, 14)
  await step(DT)
  const now = await pose(tugId)
  if (now) tugTrail.push(now)
})

const near = (trail: { x: number; y: number }[], c: number, r: number, pad = 0.4) =>
  trail.some((p) => Math.hypot(p.x - c, p.y - r) < pad)
const stoppedOnRoad = cargoTrail.some((p) => Math.hypot(p.x - 15, p.y - 2) < 0.35)
const enteredShed = near(cargoTrail, 15, 3)
const fuelOnGap = near(fuelTrail, 7, 6)
const fuelReachedStand = near(fuelTrail, 11, 6, 0.45)
const tugOnBelt = tugTrail.some((p) => beltCells.has(`${Math.round(p.x)},${Math.round(p.y)}`))
const tugLeftSort = tugTrail.some((p) => p.x < 13.2)
console.log(
  'cargo samples',
  cargoTrail.length,
  'stopped on road',
  stoppedOnRoad,
  'entered shed',
  enteredShed,
  'fuel samples',
  fuelTrail.length,
  'on gap',
  fuelOnGap,
  'at stand',
  fuelReachedStand,
  'tug samples',
  tugTrail.length,
  'on belt',
  tugOnBelt,
  'left sort',
  tugLeftSort,
)
if (!stoppedOnRoad || enteredShed) throw new Error('city cargo did not stop on the road beside the shed')
if (fuelOnGap || !fuelReachedStand) throw new Error('fuel truck left the pavement or missed the stand')
if (tugOnBelt || !tugLeftSort) throw new Error('bag tug rode a belt or never left the sort')

await encode(cargoDir, `${out}/01-city-cargo-road-stop.mp4`)
await encode(fuelDir, `${out}/02-fuel-pavement-farm-stand.mp4`)
await encode(tugDir, `${out}/03-bag-tug-beside-belts.mp4`)
console.log('proof written', out)
if (errors.length) {
  console.error(errors.join('\n'))
  await finish(1)
}
await finish(0)
