/**
 * Live proof clips for landside traffic. Production preview, ?playtest=1, 12 fps, 1280×720.
 * The game is paused and stepped 1/12 s per frame, so the file is the rendered scene at 1×.
 * Graphics stay on ultra. The commit that was built is burned into the frame and the file name.
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const sha = (process.env.PROOF_SHA ?? execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' })).trim()
const base = process.env.PROOF_BASE ?? 'http://127.0.0.1:45217'
const outDir = 'docs/devlog/media/traffic-proof-run3'
const artDir = '/opt/cursor/artifacts'
const framesRoot = '/tmp/traffic-proof-run3'
mkdirSync(outDir, { recursive: true })
mkdirSync(artDir, { recursive: true })

const CELL = 22 * 0.45
const cell = (c: number, r: number) => ({ x: (c - 31 / 2) * CELL, z: (r - 31 / 2) * CELL })

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
page.on('pageerror', (err) => console.error('pageerror', err.message))

const log = (line: string) => {
  console.log(line)
}
log('open')
await page.goto(`${base}/?playtest=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.evaluate(`(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'ultra')
  localStorage.setItem('hatchfield-texture-quality', 'high')
  localStorage.setItem('hatchfield-aircraft-quality', 'high')
})()`)
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.getByTestId('sandbox-toggle').uncheck().catch(() => {})
await page.getByTestId('new-game').click({ timeout: 60_000 })
await page.getByTestId('start-pax').scrollIntoViewIfNeeded()
log('buying plot')
await page.getByTestId('start-pax').click({ timeout: 180_000 })
await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site && window.__world)', null, { timeout: 180_000 })
log('in play')
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
  g.setView && g.setView('apron')
  g.setDayNightCycle(false)
  w.setGraphicsQuality('ultra')
  w.setDayNight({ hour: 12 })
  const orig = g.tick.bind(g)
  g.tick = (dt) => { if (window.__hold) return; return orig(dt) }
  window.__origTick = orig
  window.__hold = false
  g.speed = 1
})()`)
log('warming')
for (let batch = 0; batch < 11; batch++) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    for (let i = 0; i < 200; i++) {
      if (g.offer) g.acceptOffer()
      window.__origTick(0.1)
    }
  })()`)
  log(`warm batch ${batch + 1}/11`)
}
await page.evaluate(`(() => {
  const g = window.__hatch
  g.speed = 0
  window.__hold = true
  const chip = document.createElement('div')
  chip.id = 'proof-sha'
  chip.textContent = 'build ${sha}'
  chip.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;pointer-events:none;font:600 14px ui-monospace,monospace;color:#f4f7fb;background:rgba(8,16,28,.82);padding:4px 8px;border-radius:4px'
  document.body.appendChild(chip)
})()`)

const warmed = await page.evaluate(`(() => {
  const v = window.__hatch.landsideView().vehicles
  return { n: v.length, sample: v.slice(0, 6).map((c) => ({ id: c.id, kind: c.kind, c: +c.c.toFixed(2), r: +c.r.toFixed(2), h: +c.heading.toFixed(2), lane: c.lane, state: c.state, speed: +c.speed.toFixed(2) })) }
})()`)
console.log('warm', JSON.stringify(warmed))

async function shot(dir: string, i: number) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    window.__hold = false
    g.speed = 1
    window.__origTick(1 / 12)
    g.speed = 0
    window.__hold = true
    const w = window.__world
    w.placeCam()
  })()`)
  await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
  await page.screenshot({ path: `${dir}/frame-${String(i).padStart(3, '0')}.png` })
}

async function aim(c: number, r: number, dist: number, pitch: number, yaw: number) {
  const pivot = cell(c, r)
  await page.evaluate(
    `(({ pivot, yaw, pitch, dist }) => {
      const g = window.__hatch
      const w = window.__world
      g.cameraCue = null
      g.camGoal = null
      w.pivot.set(pivot.x, 0, pivot.z)
      w.yaw = yaw
      w.pitch = pitch
      w.dist = dist
      w.placeCam()
    })(${JSON.stringify({ pivot, yaw, pitch, dist })})`,
  )
}

interface Car {
  id: string
  kind: string
  c: number
  r: number
  heading: number
  lane: number
  state: string
  speed: number
}

async function cars(): Promise<Car[]> {
  return (await page.evaluate(`window.__hatch.landsideView().vehicles.map((c) => ({ id: c.id, kind: c.kind, c: c.c, r: c.r, heading: c.heading, lane: c.lane, state: c.state, speed: c.speed }))`)) as Car[]
}

function offAxis(h: number): number {
  return Math.acos(Math.min(1, Math.abs(Math.sin(h))))
}

async function seek(pred: (list: Car[]) => Car | null, limit: number): Promise<Car | null> {
  for (let i = 0; i < limit; i++) {
    const list = await cars()
    const hit = pred(list)
    if (hit) return hit
    await page.evaluate(`(() => { window.__hold = false; window.__hatch.speed = 1; window.__origTick(1/12); window.__hatch.speed = 0; window.__hold = true })()`)
  }
  return null
}

async function record(name: string, frames: number, follow: (list: Car[]) => { c: number; r: number } | null, dist: number, pitch: number, yaw: number) {
  const dir = `${framesRoot}/${name}`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < frames; i++) {
    const list = await cars()
    const at = follow(list)
    if (at) await aim(at.c, at.r, dist, pitch, yaw)
    await shot(dir, i)
    if (i % 24 === 0) console.log(name, i, list.length, at ? `${at.c.toFixed(1)},${at.r.toFixed(1)}` : 'hold')
  }
  const file = `${outDir}/${name}-${sha}.mp4`
  await encode(dir, 12, file)
  await encode(dir, 12, `${artDir}/${name}-${sha}.mp4`)
  console.log('wrote', file)
}

function encode(dir: string, fps: number, file: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/frame-%03d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
      { stdio: 'inherit' },
    )
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
  })
}

// Lane change: catch the frame the nose leaves the road axis, then follow that car.
const lane = await seek((list) => list.find((c) => c.r > 2 && c.r < 10.5 && c.speed > 1.2 && offAxis(c.heading) > 0.22) ?? null, 12 * 40)
console.log('lane trigger', lane)
if (!lane) throw new Error('no lane change')
let laneId = lane.id
await record(
  'lane-change',
  12 * 8,
  (list) => {
    const car = list.find((c) => c.id === laneId) ?? list.find((c) => c.r > 2 && c.r < 10.5 && offAxis(c.heading) > 0.18)
    if (car) laneId = car.id
    return car ? { c: car.c, r: car.r } : null
  },
  22,
  0.62,
  0.55,
)

const pull = await seek(
  (list) => list.find((c) => c.r > 6 && c.r < 11 && c.c < 16.7 && c.speed > 0.4 && offAxis(c.heading) > 0.28) ?? null,
  12 * 50,
)
console.log('pull trigger', pull)
if (!pull) throw new Error('no curb pull-out')
let pullId = pull.id
await record(
  'curb-pull-out',
  12 * 8,
  (list) => {
    const car = list.find((c) => c.id === pullId) ?? list.find((c) => c.c < 16.75 && offAxis(c.heading) > 0.2)
    if (car) pullId = car.id
    return car ? { c: car.c, r: car.r } : null
  },
  20,
  0.62,
  0.7,
)

const south = await seek((list) => list.find((c) => c.r > 10.6 && Math.sin(c.heading) > 0.8 && c.speed > 0.8) ?? null, 12 * 60)
console.log('south trigger', south)
if (!south) throw new Error('no south dead-end approach')
let southId = south.id
await record(
  'u-turn-south',
  12 * 10,
  (list) => {
    const car = list.find((c) => c.id === southId)
    if (car && car.r > 8) return { c: 17, r: Math.min(12.2, car.r) }
    const next = list.find((c) => c.r > 10.4)
    if (next) southId = next.id
    return { c: 17, r: 11.6 }
  },
  28,
  0.58,
  0.85,
)

const north = await seek((list) => list.find((c) => c.r < 2.2 && c.r > -0.2 && Math.sin(c.heading) < -0.8 && c.speed > 0.8) ?? null, 12 * 40)
console.log('north trigger', north)
if (!north) throw new Error('no north-end departure')
await record(
  'u-turn-north',
  12 * 10,
  () => ({ c: 17, r: 1.2 }),
  30,
  0.58,
  Math.PI - 0.85,
)

await record(
  'busy-no-overlap',
  12 * 8,
  () => ({ c: 17, r: 6 }),
  42,
  0.7,
  0.4,
)

await browser.close()
console.log('proof sha', sha)
