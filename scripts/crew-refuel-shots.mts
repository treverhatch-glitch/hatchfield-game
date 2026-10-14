/**
 * Close-ups of a stand refuel: crew step out, the hose connects, the bar fills.
 * Dev server only (`window.__hatch`). `npx vite --host 127.0.0.1 --port 5173`
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media'
const FRAMES = '/tmp/crew-refuel-frames'
mkdirSync(OUT, { recursive: true })
mkdirSync(FRAMES, { recursive: true })
const URL = process.env.CREW_URL ?? 'http://127.0.0.1:5173/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

function call(body: string) {
  return new Function(body) as () => unknown
}

const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'med')`))
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()

await page.evaluate(call(`window.__hatch.setSpeed(5)`))
const grounded = call(`
  const g = window.__hatch
  if (g.offer && g.signed.length === 0) g.acceptOffer()
  return g.flights.some((f) => f.stand && (f.phase === 'deboard' || f.phase === 'servicing' || f.phase === 'parked' || f.phase === 'board'))
`)
let ready = false
for (let i = 0; i < 90 && !ready; i++) {
  ready = Boolean(await page.evaluate(grounded))
  if (!ready) await page.waitForTimeout(400)
}
if (!ready) {
  console.log('no aircraft on stand')
  await browser.close()
  process.exit(1)
}
await page.evaluate(call(`window.__hatch.setSpeed(1)`))
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})

const holdCamera = call(`
  const g = window.__hatch
  const w = window.__world
  if (!w) return null
  if (!w.__crewWrapped) {
    const origPlace = w.placeCam.bind(w)
    w.placeCam = function () {
      const lock = w.__crewLock
      if (!lock) return origPlace()
      w.camera.position.set(lock.cx, lock.cy, lock.cz)
      w.camera.lookAt(lock.tx, lock.ty, lock.tz)
      w.camera.updateMatrixWorld()
    }
    const gl = w.renderer.render.bind(w.renderer)
    w.renderer.render = function (scene, camera) {
      if (w.__crewLock) w.placeCam()
      return gl(scene, camera)
    }
    w.__crewWrapped = true
  }
  const flight = g.flights.find((f) => f.stand)
  const truck = g.trucks.find((t) => t.kind === 'fuel' && !t.returning) || g.trucks.find((t) => t.kind === 'fuel')
  if (!flight || !truck) return null
  if (!w.__crewAimed && Math.hypot(truck.x - flight.x, truck.y - flight.y) > 2.2) return null
  const CELL = 22 * 0.45
  const HALF = 15.5
  const wx = (c) => (c - HALF) * CELL
  const wz = (r) => (r - HALF) * CELL
  const scene = g.crewScene()
  const crew = scene.people.filter((p) => p.service === 'fuel')
  let px = wx(truck.x)
  let pz = wz(truck.y)
  if (crew.length) {
    px = 0
    pz = 0
    for (const p of crew) {
      px += wx(p.c)
      pz += wz(p.r)
    }
    px /= crew.length
    pz /= crew.length
  }
  const acx = wx(flight.x)
  const acz = wz(flight.y)
  let dx = px - acx
  let dz = pz - acz
  const len = Math.hypot(dx, dz)
  if (len < 0.4) {
    dx = Math.cos(flight.heading + 1.2)
    dz = Math.sin(flight.heading + 1.2)
  } else {
    dx /= len
    dz /= len
  }
  // Side-on, low: looking across the wing, not down through it.
  let sx = -dz
  let sz = dx
  const away = (px - acx) * sx + (pz - acz) * sz
  if (away < 0) {
    sx = -sx
    sz = -sz
  }
  const camDist = crew.length ? 2.6 : 6
  w.__crewLock = {
    cx: px + sx * camDist,
    cy: crew.length ? 1.05 : 2.4,
    cz: pz + sz * camDist,
    tx: px,
    ty: 0.7,
    tz: pz,
  }
  w.goalTo = null
  w.placeCam()
  if (!w.__crewAimed) {
    w.__crewAimed = true
    g.speed = 0.16
  }
  const p = w.camera.position
  const stats = w.crewFigures ? w.crewFigures.stats : null
  return {
    cam: [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10],
    look: [Math.round(px * 10) / 10, Math.round(pz * 10) / 10],
    aircraft: [Math.round(acx * 10) / 10, Math.round(acz * 10) / 10],
    crew: crew.map((person) => [Math.round(wx(person.c) * 10) / 10, Math.round(wz(person.r) * 10) / 10]),
    dwell: Math.round(truck.dwell * 100) / 100,
    stats,
  }
`)

const fuelJob = call(`
  const g = window.__hatch
  const scene = g.crewScene()
  const job = scene.jobs.find((j) => j.service === 'fuel')
  if (!job) return null
  return { step: job.step, work: Math.round(job.work * 100) / 100, people: scene.people.length, props: scene.props.map((p) => p.kind) }
`)

const deadline = Date.now() + 180_000
let aimed = false
while (!aimed && Date.now() < deadline) {
  const held = await page.evaluate(holdCamera)
  aimed = Boolean(held)
  if (aimed) console.log('aimed', JSON.stringify(held))
  else await page.waitForTimeout(150)
}

let frames = 0
const seen: string[] = []
const shot = { walk: false, work: false, board: false }
let quiet = 0
let capturing = false
while (Date.now() < deadline && quiet < 6) {
  const job = (await page.evaluate(fuelJob)) as { step: string; work: number; people: number; props: string[] } | null
  if (!job) {
    if (capturing) quiet++
    await page.waitForTimeout(capturing ? 60 : 120)
    continue
  }
  quiet = 0
  capturing = true
  const held = await page.evaluate(holdCamera)
  if (!seen.length || seen[seen.length - 1] !== job.step) {
    seen.push(job.step)
    console.log('step', job.step, 'people', job.people, 'work', job.work, 'props', (job.props || []).join(','), JSON.stringify(held))
  }
  const file = `${FRAMES}/frame-${String(frames).padStart(3, '0')}.png`
  await page.locator('canvas.field').screenshot({ path: file })
  frames++
  if (job.people > 0 && job.step === 'walk' && !shot.walk) {
    shot.walk = true
    copyFileSync(file, `${OUT}/ISSUE-211-refuel-walk.png`)
  }
  if (job.step === 'work' && job.work > 0.35 && job.work < 0.7 && !shot.work) {
    shot.work = true
    copyFileSync(file, `${OUT}/ISSUE-211-refuel-pump.png`)
  }
  if ((job.step === 'disconnect' || job.step === 'board') && !shot.board) {
    shot.board = true
    copyFileSync(file, `${OUT}/ISSUE-211-refuel-disconnect.png`)
  }
  await page.waitForTimeout(80)
}

console.log('frames', frames, 'steps', seen.join('>'), 'shots', JSON.stringify(shot))
await browser.close()
if (!frames) process.exit(1)
