/**
 * Production-build proof that a docked turnaround keeps the belt deck on the
 * cargo door, the bowser under the wing, and the crew outside the airframe.
 * ?playtest=1, 1280x720, 12 fps, yuv420p +faststart. The Vite asset hash is
 * in each filename.
 */
import { chromium, type Page } from 'playwright'
import { build, preview } from 'vite'
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const out = 'docs/devlog/media/turnaround-clearance'
const work = '/tmp/turnaround-clearance-frames'
mkdirSync(out, { recursive: true })

console.log('vite build')
await build({ logLevel: 'info' })
const assets = readdirSync('dist/assets')
const js = assets.find((name) => /^index-.*\.js$/.test(name))
if (!js) throw new Error(`no index bundle in dist/assets (${assets.slice(0, 8).join(', ')})`)
const hash = js.replace(/^index-/, '').replace(/\.js$/, '')
console.log('build hash', hash)

const server = await preview({ preview: { port: 45953, strictPort: false }, logLevel: 'error' })
const base = server.resolvedUrls!.local[0]
console.log('preview', base)

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

function encode(dir: string, file: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-framerate', '12', '-i', `${dir}/frame-%03d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
      { stdio: 'inherit' },
    )
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
  })
}

type Shot = {
  airframe: string
  stand: string
  phaseTime: number
  belt: boolean
  deck: number
  fuelOff: number | null
  bagOff: number | null
  belts: number
  crew: number
}

const shots: { id: string; kind: 'regional' | 'narrowbody'; c: number; r: number; heading: number; dist: number }[] = [
  { id: 'crj700', kind: 'regional', c: 11, r: 6, heading: 0.4, dist: 28 },
  { id: 'b738', kind: 'narrowbody', c: 11, r: 6, heading: 0.4, dist: 36 },
  { id: 'crj700', kind: 'regional', c: 11, r: 12, heading: 2.1, dist: 28 },
  { id: 'b738', kind: 'narrowbody', c: 11, r: 12, heading: 2.1, dist: 36 },
]

function parkJs(spec: (typeof shots)[number]) {
  return `(() => {
    const g = window.__hatch
    g.flights.length = 0
    g.trucks.length = 0
    g.people.length = 0
    g.speed = 0
    g.fuelBrand = 'apex'
    g.fuelLoads = 8
    g.scheduleAuto = false
    g.spawnCool = 1e9
    const stand = { c: ${spec.c}, r: ${spec.r} }
    const flight = {
      id: 'turn-${spec.id}-${spec.c}-${spec.r}',
      airline: 'northline',
      flightNo: 'NL100',
      airframeId: '${spec.id}',
      airframeName: '${spec.id}',
      pax: ${spec.kind === 'narrowbody' ? 160 : 70},
      cargo: false,
      craft: 'jet',
      kind: '${spec.kind}',
      phase: 'servicing',
      stand,
      x: stand.c,
      y: stand.r,
      z: 0.12,
      heading: ${spec.heading},
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
    const pin = (t) => {
      t.serviceFor = 80
      t.dwell = 40
    }
    window.__turn = { flightId: flight.id, ready: false, fuel: false, bag: false, log: [] }
    g.tick = (dt) => {
      const s = window.__turn
      if (s.ready) return
      tick(dt)
      const f = g.flights.find((x) => x.id === s.flightId)
      if (f && f.phase === 'servicing' && f.phaseTime > 6) f.phaseTime = 6
      if (!f) return
      const trucks = g.trucks.filter((t) => t.flightId === f.id)
      const fuel = trucks.find((t) => t.kind === 'fuel' && t.mission === 'fuel')
      const bag = trucks.find((t) => t.kind === 'bags' && (t.mission === 'unload' || t.mission === 'load'))
      if (!s.fuel && fuel && extOf(fuel) >= 0.45) {
        pin(fuel)
        s.fuel = true
      }
      if (!s.bag && bag && extOf(bag) >= 0.4) {
        pin(bag)
        s.bag = true
      }
      const now = performance.now()
      if (!s.last || now - s.last > 2000) {
        s.last = now
        s.log.push({
          phase: f.phase,
          phaseTime: +f.phaseTime.toFixed(1),
          trucks: trucks.map((t) => t.kind + ':' + t.mission + ' seg ' + t.seg + '/' + (t.path.length - 1) + ' dwell ' + (t.dwell || 0).toFixed(1) + ' ext ' + extOf(t).toFixed(2)),
        })
        if (s.log.length > 20) s.log.shift()
      }
      if (s.fuel && s.bag && fuel && bag && g.beltApronDraw(bag)) {
        pin(fuel)
        pin(bag)
        f.phase = 'deboard'
        f.phaseTime = 0
        g.people.length = 0
        s.ready = true
        g.speed = 0
      }
    }
    g.beginServicing(flight)
    g.people.length = 0
    g.speed = 8
    return flight.id
  })()`
}

const sampleJs = `(() => {
  const g = window.__hatch
  const w = window.__world
  const s = window.__turn
  const f = g.flights.find((x) => x.id === s.flightId)
  const trucks = g.trucks.filter((t) => f && t.flightId === f.id)
  const fuel = trucks.find((t) => t.kind === 'fuel' && t.mission === 'fuel')
  const bag = trucks.find((t) => t.kind === 'bags' && (t.mission === 'unload' || t.mission === 'load'))
  const fuelDraw = fuel ? g.truckApronDraw(fuel) : null
  const bagDraw = bag ? g.truckApronDraw(bag) : null
  const belt = bag ? g.beltApronDraw(bag) : null
  const stand = f && f.stand ? f.stand : { c: 0, r: 0 }
  const off = (draw) => draw ? Math.hypot(draw.x - stand.c, draw.y - stand.r) : null
  let belts = 0
  let crew = 0
  w.scene.traverse((o) => {
    const name = o.name || ''
    if (name.includes('belt_loader')) belts += 1
    if (name === 'live-turnaround') crew += o.children.length
  })
  const shot = {
    airframe: f ? f.airframeId : '?',
    stand: stand.c + ',' + stand.r,
    phaseTime: f ? +f.phaseTime.toFixed(2) : 0,
    belt: Boolean(belt),
    deck: belt ? +belt.deck.toFixed(3) : 0,
    fuelOff: off(fuelDraw),
    bagOff: off(bagDraw),
    belts,
    crew,
  }
  let el = document.getElementById('turn-readout')
  if (!el) {
    el = document.createElement('div')
    el.id = 'turn-readout'
    el.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99999;pointer-events:none;font:600 13px ui-monospace,monospace;color:#e8f4ff;background:rgba(8,16,28,.72);padding:4px 8px;border-radius:6px'
    document.body.appendChild(el)
  }
  el.textContent = shot.airframe + ' stand ' + shot.stand + ' · belt deck ' + shot.deck.toFixed(2) + ' · trucks on stand'
  return shot
})()`

const report: Record<string, unknown> = { hash, errors }
const broken: string[] = []

for (const spec of shots) {
  const key = `${spec.id}-${spec.c}-${spec.r}`
  console.log('park', key)
  await page.evaluate(parkJs(spec))
  try {
    await page.waitForFunction('window.__turn && window.__turn.ready', null, { timeout: 120_000, polling: 100 })
  } catch (err) {
    console.error('never docked', key, JSON.stringify(await page.evaluate('window.__turn'), null, 2))
    throw err
  }
  await page.waitForTimeout(400)
  const dir = `${work}/${key}`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const pivot = worldOf(spec.c, spec.r)
  const samples: Shot[] = []
  const frames = 12 * 8
  for (let i = 0; i < frames; i++) {
    const u = i / (frames - 1)
    await camera(page, pivot, spec.heading + 0.4 + u * 1.35, 0.62 - u * 0.12, spec.dist)
    const rise = Math.min(1, i / 24)
    await page.evaluate(`(() => {
      const g = window.__hatch
      const f = g.flights.find((x) => x.id === window.__turn.flightId)
      if (f) f.phaseTime = ${(i / 12).toFixed(4)} * 1.6
      const trucks = g.trucks.filter((t) => f && t.flightId === f.id)
      const fuel = trucks.find((t) => t.kind === 'fuel' && t.mission === 'fuel')
      const bag = trucks.find((t) => t.kind === 'bags' && (t.mission === 'unload' || t.mission === 'load'))
      if (fuel) { fuel.serviceFor = 80; fuel.dwell = 40 }
      if (bag) { bag.serviceFor = 80; bag.dwell = ${rise < 1 ? (80 - rise * 3).toFixed(3) : '50'} }
    })()`)
    await page.waitForTimeout(40)
    const shot = (await page.evaluate(sampleJs)) as Shot
    samples.push(shot)
    await page.screenshot({ path: `${dir}/frame-${String(i).padStart(3, '0')}.png` })
  }
  const file = `${out}/${key}-${hash}.mp4`
  const still = `${out}/${key}-${hash}.png`
  await encode(dir, file)
  const mid = `${dir}/frame-${String(40).padStart(3, '0')}.png`
  copyFileSync(mid, still)
  const beltFrames = samples.filter((s) => s.belt && s.deck > 0.05 && (s.fuelOff ?? 0) > 0.15 && (s.bagOff ?? 0) > 0.15)
  report[key] = {
    frames: samples.length,
    beltFrames: beltFrames.length,
    deck: samples[40]?.deck,
    belts: samples[40]?.belts,
    fuelOff: samples[40]?.fuelOff,
    bagOff: samples[40]?.bagOff,
    file,
    still,
  }
  console.log(key, report[key])
  if (beltFrames.length < frames * 0.9) broken.push(`${key} trucks left the stand`)
  if (!samples.some((s) => s.deck > 0.05)) broken.push(`${key} belt deck flat`)
  if (!samples.some((s) => (s.belts ?? 0) > 0)) broken.push(`${key} belt mesh missing`)
}

writeFileSync(`${out}/report-${hash}.json`, JSON.stringify({ ...report, broken }, null, 2))
if (errors.length) console.error('page errors', errors)
if (broken.length || errors.length) {
  console.error(broken)
  await finish(1)
}
console.log('proof ok', hash)
await finish(0)
