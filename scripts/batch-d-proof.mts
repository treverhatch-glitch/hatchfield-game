/**
 * Rendered proof for the guard post and the bag sort.
 *   01-guard-truck-vs-cars.mp4  — fuel truck crosses the guard; passenger cars stay on the public road
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
  trucks: { id: string; x: number; y: number; path: { c: number; r: number }[] }[]
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
    const truck = g.trucks.find((t) => t.path[0]?.c === 17 && t.path[0]?.r === 0) ?? g.trucks[0] ?? null
    const cars = g.landsideView().vehicles
    return {
      truck: truck ? { x: truck.x, y: truck.y } : null,
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
if (layout.bagsAt !== '13,9' || layout.guardAt !== '16,4') throw new Error('starter placement moved')
if (layout.bagYaw === null || Math.abs(layout.bagYaw + Math.PI / 2) > 0.05) throw new Error(`bag yaw ${layout.bagYaw}`)
if (!layout.path.some((cell) => cell.c === 16 && cell.r === 4)) throw new Error('fuel path misses the guard')

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
  const truck = g.trucks[g.trucks.length - 1]
  truck.preDwell = 0
})

const guardDir = `${work}/guard`
const bagDir = `${work}/bags`
if (!beltOnly) {
const truckTrail: { x: number; y: number }[] = []
const carNearJunction: { kind: string; c: number; r: number }[] = []
let carOnGuard = false
await clip(guardDir, FPS * 10, async () => {
  await aim(16.4, 4.2, 14, 16, 12)
  await step(DT)
  const now = await sample()
  if (now.truck) truckTrail.push(now.truck)
  for (const car of now.cars) {
    if (Math.abs(car.c - 17) < 0.85 && Math.abs(car.r - 4) < 1.6) carNearJunction.push(car)
    if (Math.hypot(car.c - 16, car.r - 4) < 0.45) carOnGuard = true
  }
})

const crossed = truckTrail.some((p) => p.x < 15.2 && Math.abs(p.y - 4) < 0.6)
console.log('truck samples', truckTrail.length, 'crossed service road', crossed, 'cars at junction', carNearJunction.length, 'car on guard', carOnGuard)
if (!crossed) throw new Error('fuel truck never reached the airside service road')
if (carOnGuard) throw new Error('a passenger vehicle entered the guard')
if (!carNearJunction.length) throw new Error('no passenger vehicle passed the junction on the public road')

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
  await encode(guardDir, `${out}/01-guard-truck-vs-cars.mp4`)
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
