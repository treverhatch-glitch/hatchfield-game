/**
 * Rendered proof for the guard post and the bag sort.
 *   01-guard-fork-outside-vs-airside.mp4 — city road forks; an outside truck crosses the guard; an airside truck stays on the apron road
 *   02-bags-face-airside.mp4    — roller doors face the apron
 *   03-belts-terminal-sort-stands.mp4 — belts leave the sort for both stands
 *
 *   npx tsx scripts/batch-d-proof.mts
 * Frames are stepped at 12 fps. ffmpeg is given that rate, so the file plays at 12 fps.
 */
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'

const out = 'docs/devlog/media/batch-d-guard-bagsort'
const work = '/tmp/batch-d-proof'
rmSync(work, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
mkdirSync(work, { recursive: true })

const FPS = 12
const DT = 1 / FPS
const CELL = 22 * 0.45
const HALF = 15.5

const server = await createServer({ server: { port: 45342, strictPort: true }, logLevel: 'error' })
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
  g.demoBagParade()
  g.paxPerDay = 9000
})
await page.waitForTimeout(600)
const coach = page.getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.first().click()
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }',
})

await page.waitForFunction(() => {
  const w = (window as unknown as { __world?: { tilesGroup?: { children: { userData: { cellKey?: string } }[] } } }).__world
  return Boolean(w?.tilesGroup?.children.some((child) => child.userData.cellKey === '13,9'))
}, null, { timeout: 20000 })

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
  buildStarterKit: () => void
  setView: (v: string) => void
  speed: number
  scheduleAuto: boolean
  spawnCool: number
  offerCool: number
  setDayNightCycle: (on: boolean) => void
  demoBagParade: () => number
  paxPerDay: number
  tiles: string[][]
  trucks: { id: string; x: number; y: number; path: { c: number; r: number }[]; preDwell: number }[]
  spawnTruck: (kind: string, flight: null, path: { c: number; r: number }[], mission?: string) => void
  landsideView: () => { vehicles: { id: string; kind: string; c: number; r: number }[] }
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
  const n = Math.round(seconds * FPS)
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

async function sample() {
  return page.evaluate(() => {
    const g = (window as unknown as { __hatch: Hatch }).__hatch
    const mark = (window as unknown as { __proof?: { outsideId: string; internalId: string } }).__proof
    const outside = g.trucks.find((t) => t.id === mark?.outsideId) ?? null
    const internal = g.trucks.find((t) => t.id === mark?.internalId) ?? null
    const cars = g.landsideView().vehicles
    return {
      outside: outside ? { x: outside.x, y: outside.y } : null,
      internal: internal ? { x: internal.x, y: internal.y } : null,
      cars: cars.map((car) => ({ kind: car.kind, c: car.c, r: car.r })),
    }
  })
}

function encode(dir: string, file: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(FPS),
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
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
  })
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

const layout = await page.evaluate(() => {
  const g = (window as unknown as { __hatch: Hatch }).__hatch
  const w = (window as unknown as { __world: { tilesGroup: { children: { userData: { cellKey?: string }; rotation: { y: number } }[] } } }).__world
  const bags = w.tilesGroup.children.find((child) => child.userData.cellKey === '13,9')
  const tiles = g.tiles
  const belt: string[] = []
  let bagsAt = ''
  let guardAt = ''
  for (let r = 0; r < tiles.length; r++) {
    for (let c = 0; c < tiles[r].length; c++) {
      if (tiles[r][c] === 'belt') belt.push(`${c},${r}`)
      if (tiles[r][c] === 'bags') bagsAt = `${c},${r}`
      if (tiles[r][c] === 'guard') guardAt = `${c},${r}`
    }
  }
  const walk = new Set([
    'road', 'guard', 'taxi', 'stand', 'fuel', 'belt', 'bags', 'snack', 'fire', 'police', 'cargo',
    'hangar', 'deice', 'termbus', 'mover', 'xferbus', 'kitchen', 'depot', 'mro', 'nighthub', 'saf',
  ])
  const start = { c: 17, r: 0 }
  const queue = [start]
  const prev = new Map<string, string | null>([['17,0', null]])
  let goal: { c: number; r: number } | null = null
  for (let i = 0; i < queue.length && !goal; i++) {
    const cur = queue[i]
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { c: cur.c + dc, r: cur.r + dr }
      const key = `${next.c},${next.r}`
      if (prev.has(key) || !walk.has(tiles[next.r]?.[next.c])) continue
      prev.set(key, `${cur.c},${cur.r}`)
      if (tiles[next.r][next.c] === 'fuel') {
        goal = next
        break
      }
      queue.push(next)
    }
  }
  const path: { c: number; r: number }[] = []
  if (goal) {
    let walkKey: string | null = `${goal.c},${goal.r}`
    while (walkKey) {
      const [c, r] = walkKey.split(',').map(Number)
      path.push({ c, r })
      walkKey = prev.get(walkKey) ?? null
    }
    path.reverse()
  }
  return { bagYaw: bags?.rotation.y ?? null, bagsAt, guardAt, belt, path }
})
console.log('layout', layout)
if (layout.bagsAt !== '13,9' || layout.guardAt !== '16,2') throw new Error(`starter placement moved (${layout.guardAt})`)
if (layout.bagYaw === null || Math.abs(layout.bagYaw + Math.PI / 2) > 0.05) throw new Error(`bag yaw ${layout.bagYaw}`)
if (!layout.path.some((cell) => cell.c === 16 && cell.r === 2)) throw new Error('fuel path misses the guard')

const beltOnly = process.env.BELT_ONLY === '1'
console.log('warming the curb')
if (!beltOnly) await step(18)
const warmed = await sample()
console.log('cars before the pass', warmed.cars.length)

if (!beltOnly) await page.evaluate(() => {
  const g = (window as unknown as { __hatch: Hatch }).__hatch
  const tiles = g.tiles
  const walk = new Set([
    'road', 'guard', 'taxi', 'stand', 'fuel', 'belt', 'bags', 'snack', 'fire', 'police', 'cargo',
    'hangar', 'deice', 'termbus', 'mover', 'xferbus', 'kitchen', 'depot', 'mro', 'nighthub', 'saf',
  ])
  const start = { c: 17, r: 0 }
  const queue = [start]
  const prev = new Map<string, string | null>([['17,0', null]])
  let goal: { c: number; r: number } | null = null
  for (let i = 0; i < queue.length && !goal; i++) {
    const cur = queue[i]
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { c: cur.c + dc, r: cur.r + dr }
      const key = `${next.c},${next.r}`
      if (prev.has(key) || !walk.has(tiles[next.r]?.[next.c])) continue
      prev.set(key, `${cur.c},${cur.r}`)
      if (tiles[next.r][next.c] === 'fuel') {
        goal = next
        break
      }
      queue.push(next)
    }
  }
  const path: { c: number; r: number }[] = []
  if (goal) {
    let walkKey: string | null = `${goal.c},${goal.r}`
    while (walkKey) {
      const [c, r] = walkKey.split(',').map(Number)
      path.push({ c, r })
      walkKey = prev.get(walkKey) ?? null
    }
    path.reverse()
  }
  g.spawnTruck('fuel', null, path, 'patrol')
  const outside = g.trucks[g.trucks.length - 1]
  outside.preDwell = 0
  const leg: { c: number; r: number }[] = []
  for (let c = 12; c <= 15; c++) leg.push({ c, r: 4 })
  for (let c = 14; c >= 12; c--) leg.push({ c, r: 4 })
  const apron: { c: number; r: number }[] = []
  for (let lap = 0; lap < 4; lap++) apron.push(...leg.slice(lap === 0 ? 0 : 1))
  if (apron.some((cell) => tiles[cell.r][cell.c] !== 'road')) throw new Error('apron shuttle left the internal road')
  g.spawnTruck('bags', null, apron, 'patrol')
  const internal = g.trucks[g.trucks.length - 1]
  internal.preDwell = 0
  ;(window as unknown as { __proof: { outsideId: string; internalId: string } }).__proof = {
    outsideId: outside.id,
    internalId: internal.id,
  }
})

const guardDir = `${work}/guard`
const bagDir = `${work}/bags`
if (!beltOnly) {
const outsideTrail: { x: number; y: number }[] = []
const internalTrail: { x: number; y: number }[] = []
const carOnPassenger: { kind: string; c: number; r: number }[] = []
let carOnGuard = false
await clip(guardDir, FPS * 10, async () => {
  await aim(16.2, 2.8, 26, 34, 30)
  await step(DT)
  const now = await sample()
  if (now.outside) outsideTrail.push(now.outside)
  if (now.internal) internalTrail.push(now.internal)
  for (const car of now.cars) {
    if (Math.abs(car.c - 17) < 0.85 && car.r >= 0 && car.r <= 8) carOnPassenger.push(car)
    if (Math.hypot(car.c - 16, car.r - 2) < 0.45) carOnGuard = true
  }
})

const throughPost = outsideTrail.some((p) => Math.hypot(p.x - 16, p.y - 2) < 0.35)
const ontoService = outsideTrail.some((p) => p.x < 15.2 && Math.abs(p.y - 2) < 0.6)
const internalMoved = internalTrail.some((p) => p.x > 13.4) && internalTrail.some((p) => p.x < 12.6)
const internalClear = internalTrail.every((p) => Math.hypot(p.x - 16, p.y - 2) > 0.8)
console.log(
  'outside',
  outsideTrail.length,
  'through post',
  throughPost,
  'on service road',
  ontoService,
  'internal',
  internalTrail.length,
  'moved',
  internalMoved,
  'clear of post',
  internalClear,
  'cars on passenger branch',
  carOnPassenger.length,
  'car on guard',
  carOnGuard,
)
if (!throughPost || !ontoService) throw new Error('outside truck did not pass the guard onto the service road')
if (!internalMoved || !internalClear) throw new Error('internal truck did not stay on the apron road')
if (carOnGuard) throw new Error('a passenger vehicle entered the guard')
if (!carOnPassenger.length) throw new Error('no passenger vehicle stayed on the curb branch')

await clip(bagDir, FPS * 4, async (i) => {
  const t = i / (FPS * 4)
  await aim(13, 9, -18 + t * 4, 8, 2 + t * 6)
})

}

const beltDir = `${work}/belts`
await clip(beltDir, FPS * 5, async (i) => {
  const t = i / (FPS * 5)
  // High enough to keep the hall, the sort, and both stand runs in one frame.
  await aim(12.3, 9.2 + (t - 0.5) * 1.2, -5, 42, 20)
})

if (!beltOnly) {
  await encode(guardDir, `${out}/01-guard-fork-outside-vs-airside.mp4`)
  await encode(bagDir, `${out}/02-bags-face-airside.mp4`)
}
await encode(beltDir, `${out}/03-belts-terminal-sort-stands.mp4`)

await page.screenshot({ path: `${work}/last.png` })
console.log('proof written', out)
if (errors.length) {
  console.error(errors.join('\n'))
  await finish(1)
}
await finish(0)
