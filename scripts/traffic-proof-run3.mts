/**
 * Live proof clips for landside traffic. Production preview, ?playtest=1, 12 fps, 1280×720.
 * The game is paused and stepped 1/12 s per frame, so the file is the rendered scene at 1×.
 * Graphics stay on ultra. The commit that was built is burned into the frame and the file name.
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const sha = (process.env.PROOF_SHA ?? execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' })).trim()
const only = new Set((process.env.PROOF_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean))
const want = (name: string) => only.size === 0 || only.has(name)
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
  // Alerts, the roof beat, and a celebration dolly all move the lens during render.
  // Draw once with the sim, then draw again from the proof aim so the frame is that lens.
  const origRender = w.render.bind(w)
  w.render = (game) => {
    origRender(game)
    const aim = window.__aim
    if (!aim) return
    w.pivot.set(aim.x, 0, aim.z)
    w.yaw = aim.yaw
    w.pitch = aim.pitch
    w.dist = aim.dist
    w.placeCam()
    w.renderer.render(w.scene, w.camera)
  }
  window.__hold = false
  g.speed = 1
})()`)
log('warming')
for (let batch = 0; batch < 12; batch++) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    for (let i = 0; i < 200; i++) {
      if (g.offer) g.acceptOffer()
      window.__origTick(0.1)
    }
  })()`)
  log(`warm batch ${batch + 1}/12`)
}
for (let batch = 0; batch < 6; batch++) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    for (let i = 0; i < 80; i++) {
      if (g.offer) g.acceptOffer()
      window.__origTick(1)
    }
  })()`)
  log(`busy warm ${batch + 1}/6`)
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
  const url = (await page.evaluate(`(() => {
    const g = window.__hatch
    window.__hold = false
    g.speed = 1
    window.__origTick(1 / 12)
    g.speed = 0
    window.__hold = true
    g.camGoal = null
    g.cameraCue = null
    g.viewCue = null
    const w = window.__world
    if (window.__aim) {
      w.pivot.set(window.__aim.x, 0, window.__aim.z)
      w.yaw = window.__aim.yaw
      w.pitch = window.__aim.pitch
      w.dist = window.__aim.dist
    }
    w.placeCam()
    w.render(g)
    document.querySelectorAll('[data-testid="celebration-banner"],[data-testid="celebration-confetti"]').forEach((el) => { el.style.display = 'none' })
    return w.renderer.domElement.toDataURL('image/png')
  })()`)) as string
  const comma = url.indexOf(',')
  writeFileSync(`${dir}/frame-${String(i).padStart(3, '0')}.png`, Buffer.from(url.slice(comma + 1), 'base64'))
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
      window.__aim = { x: pivot.x, z: pivot.z, yaw, pitch, dist }
      g.camGoal = null
      g.cameraCue = null
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
    if (i % 12 === 0) {
      const h = list.find((c) => Math.abs(c.c - (at?.c ?? 0)) < 0.05 && Math.abs(c.r - (at?.r ?? 0)) < 0.05)
      console.log(name, i, list.length, at ? `${at.c.toFixed(2)},${at.r.toFixed(2)}` : 'hold', h ? `h=${h.heading.toFixed(2)} v=${h.speed.toFixed(1)} lane=${h.lane}` : '')
    }
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
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(fps),
        '-i',
        `${dir}/frame-%03d.png`,
        '-vf',
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='build ${sha}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.65:x=16:y=h-36`,
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

// Through-lane change: catch the nose as it starts to leave the road axis, not after it has straightened.
const laneOff = new Map<string, number>()
const lane = want('lane-change')
  ? await seek((list) => {
      let hit: Car | null = null
      for (const c of list) {
        const off = offAxis(c.heading)
        const prev = laneOff.get(c.id)
        laneOff.set(c.id, off)
        if (
          hit == null &&
          prev != null &&
          off > prev + 0.015 &&
          off > 0.1 &&
          c.r > 3 &&
          c.r < 9.5 &&
          c.lane <= 1 &&
          c.speed > 1.5 &&
          c.c > 16.7 &&
          c.c < 17.45
        ) {
          hit = c
        }
      }
      return hit
    }, 12 * 100)
  : null
console.log('lane trigger', lane)
if (want('lane-change')) {
  if (!lane) console.error('no lane change')
  else {
  const laneId = lane.id
  await record(
    'lane-change',
    12 * 6,
    (list) => {
      const car = list.find((c) => c.id === laneId)
      return car ? { c: car.c + 0.55, r: car.r } : { c: lane.c + 0.55, r: lane.r }
    },
    34,
    1.12,
    0.35,
  )
  }
}

// Leaving a stall: still on the hall side of the curb lane, nose already swung out, moving.
const pullOff = new Map<string, number>()
const pull = want('curb-pull-out')
  ? await seek((list) => {
      let hit: Car | null = null
      for (const c of list) {
        const off = offAxis(c.heading)
        const prev = pullOff.get(c.id)
        pullOff.set(c.id, off)
        if (
          hit == null &&
          prev != null &&
          off > prev + 0.015 &&
          off > 0.1 &&
          c.r > 3 &&
          c.r < 11 &&
          c.lane === 1 &&
          c.c < 16.72 &&
          c.c > 16.45 &&
          c.speed > 1
        ) {
          hit = c
        }
      }
      return hit
    }, 12 * 90)
  : null
console.log('pull trigger', pull)
if (want('curb-pull-out')) {
  if (!pull) throw new Error('no curb pull-out')
  const pullId = pull.id
  await record(
    'curb-pull-out',
    12 * 6,
    (list) => {
      const car = list.find((c) => c.id === pullId)
      return car ? { c: car.c + 0.2, r: car.r } : { c: pull.c + 0.2, r: pull.r }
    },
    30,
    1.08,
    0.22,
  )
}

const south = want('u-turn-south')
  ? await seek((list) => list.find((c) => c.r > 10.4 && Math.sin(c.heading) > 0.75 && c.speed > 0.8) ?? null, 12 * 70)
  : null
console.log('south trigger', south)
if (want('u-turn-south')) {
  if (!south) throw new Error('no south dead-end approach')
  let southId = south.id
  await record(
    'u-turn-south',
    12 * 8,
    (list) => {
      const car = list.find((c) => c.id === southId)
      if (car && car.r > 9) return { c: 17, r: Math.min(11.7, Math.max(10.2, car.r)) }
      const next = list.find((c) => c.r > 10.2 && c.speed > 0.5)
      if (next) southId = next.id
      return { c: 17, r: 11.4 }
    },
    32,
    1.15,
    0.4,
  )
}

const north = want('u-turn-north')
  ? await seek((list) => list.find((c) => c.r < 2.4 && c.r > -0.6 && c.speed > 0.8 && Math.sin(c.heading) < -0.6) ?? null, 12 * 40)
  : null
console.log('north trigger', north)
if (want('u-turn-north')) {
  if (!north) console.error('no north-end departure')
  else {
  let northId = north.id
  await record(
    'u-turn-north',
    12 * 8,
    (list) => {
      const car = list.find((c) => c.id === northId) ?? list.find((c) => c.r < 2.2 && c.speed > 0.4)
      if (car) northId = car.id
      const r = car ? Math.max(0.9, Math.min(2.2, car.r + 1.1)) : 1.4
      return { c: 17, r }
    },
    34,
    1.12,
    0.45,
  )
  }
}

if (want('busy-no-overlap')) {
  await record(
    'busy-no-overlap',
    12 * 8,
    (list) => {
      return { c: 17, r: 9 }
    },
    36,
    1.12,
    0.25,
  )
}

await browser.close()
console.log('proof sha', sha)
