/**
 * Close-ups of bridge, stair, and bus boarding, plus the ramp crews.
 * Dev server only. `npx vite --host 127.0.0.1 --port 5173`
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media'
const FRAMES = '/tmp/boarding-frames'
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
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})

const holdCamera = call(`
  const g = window.__hatch
  const w = window.__world
  if (!w) return null
  if (!w.__boardWrapped) {
    const origPlace = w.placeCam.bind(w)
    w.placeCam = function () {
      const lock = w.__boardLock
      if (!lock) return origPlace()
      w.camera.position.set(lock.cx, lock.cy, lock.cz)
      w.camera.lookAt(lock.tx, lock.ty, lock.tz)
      w.camera.updateMatrixWorld()
    }
    const gl = w.renderer.render.bind(w.renderer)
    w.renderer.render = function (scene, camera) {
      if (w.__boardLock) w.placeCam()
      return gl(scene, camera)
    }
    w.__boardWrapped = true
  }
  const incoming = g.flights.find((f) => f.stand && (f.phase === 'approach' || f.phase === 'landing' || f.phase === 'taxi_in'))
  if (incoming && !w.__boardSlow) g.speed = 1
  const flight = g.flights.find((f) => f.stand && (f.phase === 'deboard' || f.phase === 'board' || f.phase === 'pushback' || f.phase === 'servicing'))
  if (!flight) return incoming ? { wait: true } : null
  const CELL = 22 * 0.45
  const HALF = 15.5
  const scene = g.crewScene()
  const focus = scene.people.filter((p) => p.role === 'pax' || p.role === 'walker' || p.service === 'cleaning' || p.service === 'gpu' || p.service === 'pushback')
  let px = (flight.x - HALF) * CELL
  let pz = (flight.y - HALF) * CELL
  if (focus.length) {
    px = 0
    pz = 0
    for (const person of focus) {
      px += (person.c - HALF) * CELL
      pz += (person.r - HALF) * CELL
    }
    px /= focus.length
    pz /= focus.length
  }
  const heading = flight.heading || 0
  const side = Math.cos(heading + 1.4)
  const forward = Math.sin(heading + 1.4)
  w.__boardLock = { cx: px + side * 3.2, cy: 1.7, cz: pz + forward * 3.2, tx: px, ty: 1.1, tz: pz }
  w.goalTo = null
  w.placeCam()
  if (!w.__boardSlow) {
    w.__boardSlow = true
    g.speed = 0.55
  }
  const extend = g.bridgeExtend(flight.id)
  const mode = g.standPaxMode(flight.stand)
  return {
    phase: flight.phase,
    mode,
    extend: Math.round(extend * 100) / 100,
    pax: scene.people.filter((p) => p.role === 'pax').length,
    walker: scene.people.some((p) => p.role === 'walker'),
    clean: scene.people.some((p) => p.service === 'cleaning'),
    gpu: scene.people.some((p) => p.service === 'gpu'),
    stairs: scene.props.some((p) => p.kind === 'stairs'),
    lift: scene.props.some((p) => p.kind === 'lift'),
    bags: scene.props.filter((p) => p.kind === 'bag').length,
  }
`)

const shot: Record<string, boolean> = {}
function want(name: string, ok: boolean, file: string) {
  if (!ok || shot[name]) return
  shot[name] = true
  copyFileSync(file, `${OUT}/ISSUE-221-${name}.png`)
  console.log('shot', name)
}

if (process.env.BOARD_FOCUS === 'stairs') {
  await page.evaluate(call(`
    const g = window.__hatch
    g.standAccess['11,6'] = 'remote'
    g.standAccess['11,12'] = 'remote'
  `))
}
await page.evaluate(call(`window.__hatch.setSpeed(5)`))
const grounded = call(`
  const g = window.__hatch
  if (g.offer && g.signed.length === 0) g.acceptOffer()
  return g.flights.some((f) => f.stand)
`)
for (let i = 0; i < 80; i++) {
  if (await page.evaluate(grounded)) break
  await page.waitForTimeout(400)
}
const deadline = Date.now() + 160_000
let frames = 0
let quiet = 0
while (Date.now() < deadline && quiet < 40 && frames < 48) {
  const info = (await page.evaluate(holdCamera)) as {
    phase: string
    mode: string
    extend: number
    pax: number
    walker: boolean
    clean: boolean
    gpu: boolean
    stairs: boolean
    lift: boolean
    bags: number
  } | null
  if (!info || (info as { wait?: boolean }).wait) {
    if (!info) quiet++
    await page.waitForTimeout(200)
    continue
  }
  quiet = 0
  const file = `${FRAMES}/frame-${String(frames).padStart(3, '0')}.png`
  await page.locator('canvas.field').screenshot({ path: file })
  frames++
  if (frames === 1 || frames % 6 === 0) console.log(frames, JSON.stringify(info))
  want('bridge-extend', info.mode === 'jetway' && info.extend > 0.15 && info.extend < 0.85 && info.pax === 0, file)
  want('bridge-walk', info.mode === 'jetway' && info.pax > 0, file)
  want('stairs', info.mode === 'walk' && info.pax > 0 && info.stairs, file)
  want('bus', info.mode === 'bus' && (info.pax > 0 || info.stairs), file)
  want('cleaning', info.clean, file)
  want('pushback', info.walker, file)
  want('catering-lift', info.lift, file)
  want('bags', info.bags >= 2, file)
  if (process.env.BOARD_FOCUS !== 'stairs' && shot['bridge-walk'] && !shot.__remote) {
    shot.__remote = true
    await page.evaluate(call(`
      const g = window.__hatch
      g.standAccess['11,6'] = 'remote'
      g.standAccess['11,12'] = 'remote'
      g.tiles[4][8] = 'termbus'
      g.speed = 5
      if (window.__world) window.__world.__boardSlow = false
    `))
    console.log('switched stands to remote with a bus depot')
  }
  await page.waitForTimeout(90)
}

console.log('frames', frames, 'shots', JSON.stringify(shot))
await browser.close()
if (!frames) process.exit(1)
