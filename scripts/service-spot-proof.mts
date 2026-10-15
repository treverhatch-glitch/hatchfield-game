// In-play proof for size-appropriate fuel and bag spots.
// Real Vite client, ?playtest=1. A CRJ700 and a 737 are parked on a starter
// stand and beginServicing dispatches the legacy bowser and bag truck.
// The script only changes sim speed and the camera: it pauses the moment a
// truck's hose or belt is deployed, so the short dwell stays on screen.
// Servicing is held open until the bowser docks — the stand timer is shorter
// than the drive from the farm, and the clip is about the spot, not the timer.
//
//   01-small-crj-turn.mp4
//   02-large-b738-turn.mp4
//   03-small-default-zoom.png
//   04-large-default-zoom.png
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const out = process.env.SPOT_OUT ?? 'docs/devlog/media/service-spot-proof'
const work = process.env.SPOT_FRAMES ?? '/tmp/service-spot-frames'
mkdirSync(out, { recursive: true })

const server = await createServer({ server: { port: 45951, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
console.log('vite', base)

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))

async function finish(code: number) {
  await browser.close()
  await server.close()
  process.exit(code)
}

await page.goto(`${base}?playtest=1`, { waitUntil: 'networkidle' })
await page.evaluate('localStorage.clear()')
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('sandbox-toggle').uncheck().catch(() => {})
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site && window.__world)')
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) {
  await coach.click()
  await page.waitForFunction('!window.__hatch.showStarterKit()')
} else {
  await page.evaluate('window.__hatch.buildStarterKit()')
}
await page.evaluate(`(() => {
  const g = window.__hatch
  const w = window.__world
  g.setDayNightCycle(false)
  w.setDayNight({ hour: 11 })
  g.setView('apron')
  g.cameraCue = null
  g.camGoal = null
  g.scheduleAuto = false
  g.spawnCool = 1e9
  g.fuelBrand = 'apex'
  g.fuelLoads = 8
  g.closeNegotiationPanel && g.closeNegotiationPanel()
})()`)

const CELL = 22 * 0.45
const CENTER = 15.5
const worldOf = (c: number, r: number) => ({ x: (c - CENTER) * CELL, z: (r - CENTER) * CELL })

async function camera(p: Page, pivot: { x: number; z: number }, yaw: number, pitch: number, dist: number) {
  await p.evaluate(
    `(({ pivot, yaw, pitch, dist }) => {
      const g = window.__hatch
      const w = window.__world
      g.cameraCue = null
      g.camGoal = null
      g.viewCue = null
      w.followHeld = false
      w.pivot.set(pivot.x, 0, pivot.z)
      w.yaw = yaw
      w.pitch = pitch
      w.dist = dist
      w.placeCam()
    })(${JSON.stringify({ pivot, yaw, pitch, dist })})`,
  )
}

async function encode(dir: string, fps: number, file: string) {
  await new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/frame-%03d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
      { stdio: 'inherit' },
    )
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
  })
}

type Shot = {
  airframe: string
  phase: string
  hold: string | null
  hoses: number
  fuelOff: number | null
  bagOff: number | null
  apartM: number | null
  fuelYaw: number | null
  bagYaw: number | null
  fuelDraw: { x: number; y: number; heading: number } | null
  bagDraw: { x: number; y: number; heading: number } | null
  stand: { c: number; r: number }
  heading: number
}

const parkJs = (airframeId: string, kind: 'regional' | 'narrowbody') => `(() => {
  const g = window.__hatch
  g.flights.length = 0
  g.trucks.length = 0
  g.people.length = 0
  g.speed = 0
  g.fuelBrand = 'apex'
  g.fuelLoads = 8
  g.scheduleAuto = false
  g.spawnCool = 1e9
  const stand = { c: 11, r: 6 }
  const flight = {
    id: 'spot-${airframeId}',
    airline: 'northline',
    flightNo: 'NL100',
    airframeId: '${airframeId}',
    airframeName: '${airframeId}',
    pax: ${kind === 'narrowbody' ? 160 : 70},
    cargo: false,
    craft: 'jet',
    kind: '${kind}',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0.4,
    path: [stand],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: { landing: true, bags: false, bagsLoad: true, fuel: false, catering: true, bagDrop: true, mx: false, deiced: true },
    waitingOn: { bags: true, bagsLoad: false, fuel: true, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
    phaseTime: 0,
    ledger: [],
    bagStage: 'unload_aircraft',
    bagUnits: 12,
  }
  g.flights.push(flight)
  g.tick = Object.getPrototypeOf(g).tick.bind(g)
  const tick = g.tick.bind(g)
  const extOf = (t) => {
    const atStop = !t.returning && t.seg >= t.path.length - 1
    if (!atStop || !(t.dwell > 0)) return 0
    const total = t.serviceFor && t.serviceFor > 0 ? t.serviceFor : t.dwell
    const ramp = Math.max(0.5, Math.min(3, total * 0.2))
    const x = Math.min((total - t.dwell) / ramp, t.dwell / ramp)
    const u = x <= 0 ? 0 : x >= 1 ? 1 : x
    return u * u * (3 - 2 * u)
  }
  window.__spot = { flightId: flight.id, hold: null, bagFilmed: false, fuelFilmed: false, log: [] }
  g.tick = (dt) => {
    tick(dt)
    const s = window.__spot
    const f = g.flights.find((x) => x.id === s.flightId)
    if (!(s.fuelFilmed && s.bagFilmed) && f && f.phase === 'servicing' && f.phaseTime > 6) f.phaseTime = 6
    if (s.hold) return
    if (!f) return
    const trucks = g.trucks.filter((t) => t.flightId === f.id)
    const now = performance.now()
    if (!s.last || now - s.last > 2000) {
      s.last = now
      s.log.push({
        phase: f.phase,
        phaseTime: +f.phaseTime.toFixed(1),
        trucks: trucks.map((t) => t.kind + ':' + t.mission + ' seg ' + t.seg + '/' + (t.path.length - 1) + ' dwell ' + (t.dwell || 0).toFixed(1) + ' ext ' + extOf(t).toFixed(2)),
      })
      if (s.log.length > 40) s.log.shift()
    }
    const bag = trucks.find((t) => t.kind === 'bags' && (t.mission === 'unload' || t.mission === 'load') && extOf(t) >= 0.4)
    const fuel = trucks.find((t) => t.kind === 'fuel' && t.mission === 'fuel' && extOf(t) >= 0.5)
    // Hold the truck mid-job. Adding time to both clocks widens the deploy
    // ramp and drops the hose, so the dwell is reset to the middle of a long service.
    const pin = (t) => {
      t.serviceFor = 48
      t.dwell = 24
    }
    if (!s.bagFilmed && bag) {
      pin(bag)
      s.bagFilmed = true
      s.hold = 'bags'
      g.speed = 0
      return
    }
    if (!s.fuelFilmed && fuel) {
      pin(fuel)
      s.fuelFilmed = true
      s.hold = 'fuel'
      g.speed = 0
    }
  }
  g.beginServicing(flight)
  g.people.length = 0
  g.speed = 5
  return { trucks: g.trucks.filter((t) => t.flightId === flight.id).map((t) => t.kind + ':' + t.mission + '@' + t.path.length) }
})()`

const sampleJs = `(() => {
  const g = window.__hatch
  const w = window.__world
  const s = window.__spot
  const f = g.flights.find((x) => x.id === s.flightId)
  const trucks = g.trucks.filter((t) => f && t.flightId === f.id)
  const fuel = trucks.find((t) => t.kind === 'fuel' && t.mission === 'fuel')
  const bag = trucks.find((t) => t.kind === 'bags' && (t.mission === 'unload' || t.mission === 'load'))
  const fuelDraw = fuel ? g.truckApronDraw(fuel) : null
  const bagDraw = bag ? g.truckApronDraw(bag) : null
  const ang = (a, b) => {
    let d = a - b
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return Math.abs(d)
  }
  let hoses = 0
  w.scene.traverse((o) => { if (o.name && String(o.name).startsWith('hose:')) hoses += 1 })
  const stand = f && f.stand ? f.stand : { c: 11, r: 6 }
  const off = (draw) => draw ? Math.hypot(draw.x - stand.c, draw.y - stand.r) : null
  const fuelOff = off(fuelDraw)
  const bagOff = off(bagDraw)
  const apartM = fuelDraw && bagDraw ? Math.hypot(fuelDraw.x - bagDraw.x, fuelDraw.y - bagDraw.y) * 22 : null
  const shot = {
    airframe: f ? f.airframeId : '?',
    phase: f ? f.phase : 'gone',
    hold: s.hold,
    hoses,
    fuelOff: fuelOff == null ? null : +fuelOff.toFixed(3),
    bagOff: bagOff == null ? null : +bagOff.toFixed(3),
    apartM: apartM == null ? null : +apartM.toFixed(2),
    fuelYaw: fuelDraw && f ? +ang(fuelDraw.heading, f.heading).toFixed(3) : null,
    bagYaw: bagDraw && f ? +ang(bagDraw.heading, f.heading).toFixed(3) : null,
    fuelDraw,
    bagDraw,
    stand,
    heading: f ? f.heading : 0,
  }
  let el = document.getElementById('spot-readout')
  if (!el) {
    el = document.createElement('div')
    el.id = 'spot-readout'
    el.style.cssText = 'position:fixed;left:50%;top:148px;transform:translateX(-50%);z-index:99999;pointer-events:none;font:600 13px ui-monospace,monospace;color:#e8f4ff;background:rgba(8,16,28,.78);padding:5px 10px;border-radius:6px;white-space:nowrap'
    document.body.appendChild(el)
  }
  const who = s.hold === 'bags' ? 'bag truck at cargo door' : s.hold === 'fuel' ? 'bowser at fuel port' : 'turnaround'
  el.textContent = shot.airframe + ' ' + shot.phase + ' · ' + who + ' · off stand fuel ' + (shot.fuelOff ?? '—') + ' bags ' + (shot.bagOff ?? '—') + ' · hose ' + hoses + (shot.apartM != null ? ' · apart ' + shot.apartM.toFixed(1) + ' m' : '')
  return shot
})()`

async function aim(draw: { x: number; y: number } | null, flight: { x: number; y: number; heading: number }, toward: number) {
  const craft = worldOf(flight.x, flight.y)
  const truck = draw ? worldOf(draw.x, draw.y) : craft
  const vx = truck.x - craft.x
  const vz = truck.z - craft.z
  const yaw = Math.hypot(vx, vz) > 0.4 ? Math.atan2(vx, vz) : Math.atan2(-Math.sin(flight.heading), Math.cos(flight.heading))
  const pivot = {
    x: craft.x + (truck.x - craft.x) * toward,
    z: craft.z + (truck.z - craft.z) * toward,
  }
  return { pivot, yaw }
}

async function grab(dir: string, i: number): Promise<Shot> {
  await page.waitForTimeout(70)
  const shot = (await page.evaluate(sampleJs)) as Shot
  await page.screenshot({ path: `${dir}/frame-${String(i).padStart(3, '0')}.png` })
  return shot
}

const flights: { id: string; kind: 'regional' | 'narrowbody'; clip: string; still: string; closeDist: number }[] = [
  { id: 'crj700', kind: 'regional', clip: '01-small-crj-turn.mp4', still: '03-small-default-zoom.png', closeDist: 26 },
  { id: 'b738', kind: 'narrowbody', clip: '02-large-b738-turn.mp4', still: '04-large-default-zoom.png', closeDist: 34 },
]

const report: Record<string, unknown> = { errors }
const broken: string[] = []

for (const spec of flights) {
  const spawned = await page.evaluate(parkJs(spec.id, spec.kind))
  console.log('spawned', spec.id, spawned)
  try {
    await page.waitForFunction('window.__spot && window.__spot.hold', null, { timeout: 90_000, polling: 80 })
  } catch (err) {
    console.error('never docked', spec.id, JSON.stringify(await page.evaluate('window.__spot'), null, 2))
    throw err
  }
  const dir = `${work}/${spec.id}`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const frames: Shot[] = []
  let n = 0
  const flightPos = () =>
    page.evaluate('(() => { const f = window.__hatch.flights.find((x) => x.id === window.__spot.flightId); return { x: f.x, y: f.y, heading: f.heading } })()') as Promise<{
      x: number
      y: number
      heading: number
    }>

  // The bowser's path is shorter, so it docks first. Its dwell is extended in
  // the page so it stays put while the bag truck finishes the longer drive.
  const filmed = new Set<string>()
  let fuelAim = { pivot: worldOf(11, 6), yaw: 0.4 }
  while (filmed.size < 2) {
    const hold = (await page.evaluate('window.__spot.hold')) as string
    if (hold !== 'bags' && hold !== 'fuel') {
      await page.waitForFunction('window.__spot.hold === "bags" || window.__spot.hold === "fuel"', null, { timeout: 90_000, polling: 80 })
      continue
    }
    let shot = (await page.evaluate(sampleJs)) as Shot
    if (hold === 'fuel') {
      for (let i = 0; i < 8 && shot.hoses < 1; i++) {
        await page.waitForTimeout(120)
        shot = (await page.evaluate(sampleJs)) as Shot
      }
    }
    const draw = hold === 'bags' ? shot.bagDraw : shot.fuelDraw
    const pos = await flightPos()
    const view = await aim(draw, pos, filmed.size === 0 ? 0.58 : 0.45)
    if (hold === 'fuel') fuelAim = view
    const dist = spec.closeDist + (filmed.size === 0 ? 0 : 10)
    const closeAt = n
    for (let i = 0; i < 12; i++) {
      const u = i / 11
      await camera(page, view.pivot, view.yaw - 0.65 + u * 1.2, 0.56, dist)
      frames.push(await grab(dir, n++))
    }
    if (hold === 'fuel') copyFileSync(`${dir}/frame-${String(closeAt + 5).padStart(3, '0')}.png`, `${out}/${spec.id}-fuel-close.png`)
    filmed.add(hold)
    if (filmed.size < 2) await page.evaluate('window.__spot.hold = null; window.__hatch.speed = 5')
  }
  const pos = await flightPos()
  const widePivot = worldOf(pos.x, pos.y)
  for (let i = 0; i < 8; i++) {
    const u = i / 7
    const dist = spec.closeDist + 10 + (88 - spec.closeDist - 10) * u
    await camera(page, widePivot, fuelAim.yaw - 0.15, 0.58 + u * 0.12, dist)
    frames.push(await grab(dir, n++))
  }
  copyFileSync(`${dir}/frame-${String(n - 1).padStart(3, '0')}.png`, `${out}/${spec.still}`)
  await encode(dir, 3, `${out}/${spec.clip}`)
  const fuelFrames = frames.filter((s) => s.hold === 'fuel')
  const bagFrames = frames.filter((s) => s.hold === 'bags')
  report[spec.id] = {
    spawned,
    bagFrames: bagFrames.length,
    fuelFrames: fuelFrames.length,
    fuel: fuelFrames[Math.min(6, fuelFrames.length - 1)] ?? null,
    bags: bagFrames[0] ?? null,
    log: await page.evaluate('window.__spot.log'),
  }
  console.log(spec.id, 'fuel', report[spec.id] && (report[spec.id] as { fuel: Shot | null }).fuel)
  const fuelPose = frames.find((s) => s.fuelOff != null && s.fuelOff > 0) ?? null
  const bagPose = frames.find((s) => s.bagOff != null && s.bagOff > 0) ?? null
  if (!fuelPose || fuelPose.fuelOff == null || fuelPose.fuelOff < 0.15) broken.push(`${spec.id} fuel on stand cell`)
  if (frames.some((s) => s.fuelOff != null && s.fuelOff > 0.15 && s.hoses < 1)) broken.push(`${spec.id} hose missing`)
  if (!bagPose || bagPose.bagOff == null || bagPose.bagOff < 0.15) broken.push(`${spec.id} bags on stand cell`)
  const together = frames.find((s) => s.apartM != null && s.fuelOff != null && s.bagOff != null)
  if (!together || together.apartM == null) broken.push(`${spec.id} trucks never share a frame`)
  else if (together.apartM < 7.5) broken.push(`${spec.id} trucks share a spot (${together.apartM} m)`)
  if (!fuelFrames.length) broken.push(`${spec.id} no fuel frames`)
  if (!bagFrames.length) broken.push(`${spec.id} no bag frames`)
}

writeFileSync(`${out}/proof-log.json`, JSON.stringify({ ...report, broken, errors }, null, 2))
console.log('wrote', out, 'broken', [...new Set(broken)], 'pageerrors', errors)
await finish(broken.length || errors.length ? 1 : 0)
