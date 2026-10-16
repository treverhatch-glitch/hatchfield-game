/**
 * Live proof that a curb vehicle carries a real passenger.
 * Production preview, ?playtest=1, 12 fps, 1280×720. The sim is stepped 1/12 s
 * per frame. Frames are read from the rendered landside meshes, then encoded
 * H.264 yuv420p +faststart. The build hash is in the file name.
 *
 *   PROOF_BASE=http://127.0.0.1:45217 npx tsx scripts/curb-trip-proof.mts
 */
import { execSync, spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const sha = (process.env.PROOF_SHA ?? execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' })).trim()
const base = process.env.PROOF_BASE ?? 'http://127.0.0.1:45217'
const outDir = 'docs/devlog/media/curb-trips'
const artDir = '/opt/cursor/artifacts'
const framesRoot = '/tmp/curb-trip-proof'
const CELL = 22 * 0.45
mkdirSync(outDir, { recursive: true })
mkdirSync(artDir, { recursive: true })

const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find((path) => {
  try {
    execSync(`test -x ${path}`)
    return true
  } catch {
    return false
  }
})
if (!chrome) throw new Error('chrome not found')

const browser = await chromium.launch({
  executablePath: chrome,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
page.on('pageerror', (err) => console.error('pageerror', err.message))

console.log('open', base)
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
await page.getByTestId('start-pax').click({ timeout: 180_000 })
await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site && window.__world)', null, { timeout: 180_000 })
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
  window.__hold = true
  g.speed = 0
  const chip = document.createElement('div')
  chip.id = 'proof-sha'
  chip.textContent = 'build ${sha}'
  chip.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;pointer-events:none;font:600 14px ui-monospace,monospace;color:#f4f7fb;background:rgba(8,16,28,.82);padding:4px 8px;border-radius:4px'
  document.body.appendChild(chip)
})()`)

const cell = (c: number, r: number) => ({ x: (c - 31 / 2) * CELL, z: (r - 31 / 2) * CELL })

async function aim(c: number, r: number, dist: number, pitch: number, yaw: number) {
  const pivot = cell(c, r)
  await page.evaluate(
    `(({ pivot, yaw, pitch, dist }) => {
      window.__aim = { x: pivot.x, z: pivot.z, yaw, pitch, dist }
      const w = window.__world
      w.pivot.set(pivot.x, 0, pivot.z)
      w.yaw = yaw
      w.pitch = pitch
      w.dist = dist
      w.placeCam()
    })(${JSON.stringify({ pivot, yaw, pitch, dist })})`,
  )
}

interface Probe {
  vehicles: { kind: string; state: string; c: number; r: number; heading: number; meshC: number; meshR: number; meshHeading: number }[]
  people: { c: number; r: number; meshC: number; meshR: number }[]
  guest: { id: string; flightId: string; thought: string; hold: string | null; node: string } | null
  offMap: number
}

async function probe(guestId: string): Promise<Probe> {
  return (await page.evaluate(`(() => {
    const g = window.__hatch
    const w = window.__world
    w.render(g)
    const CELL = ${CELL}
    const half = 31 / 2
    const toCell = (x, z) => ({ c: x / CELL + half, r: z / CELL + half })
    const poses = (name) => {
      const mesh = w.scene.getObjectByName(name)
      if (!mesh || !mesh.count) return []
      const arr = mesh.instanceMatrix.array
      const out = []
      for (let i = 0; i < mesh.count; i++) {
        const o = i * 16
        const p = toCell(arr[o + 12], arr[o + 14])
        const heading = -Math.atan2(arr[o + 8], arr[o + 0])
        out.push({ c: p.c, r: p.r, heading })
      }
      return out
    }
    const bodies = ['car', 'taxi', 'bus'].flatMap((kind) => poses('landside-' + kind + '-body').map((p) => ({ kind, ...p })))
    const people = poses('landside-person').map((p) => ({ c: p.c, r: p.r }))
    const view = g.landsideView()
    const near = (a, b) => Math.hypot(a.c - b.c, a.r - b.r)
    const vehicles = view.vehicles.map((car) => {
      const mesh = bodies.filter((m) => m.kind === car.kind).sort((a, b) => near(a, car) - near(b, car))[0]
      return {
        kind: car.kind,
        state: car.state,
        c: car.c,
        r: car.r,
        heading: car.heading,
        meshC: mesh ? mesh.c : NaN,
        meshR: mesh ? mesh.r : NaN,
        meshHeading: mesh ? mesh.heading : NaN,
      }
    })
    const peopleRead = view.passengers.map((p) => {
      const mesh = people.slice().sort((a, b) => near(a, p) - near(b, p))[0]
      return { c: p.c, r: p.r, meshC: mesh ? mesh.c : NaN, meshR: mesh ? mesh.r : NaN }
    })
    const guest = g.hallGuests.find((x) => x.id === ${JSON.stringify(guestId)}) || null
    return {
      vehicles,
      people: peopleRead,
      guest: guest ? { id: guest.id, flightId: guest.flightId, thought: guest.thought, hold: guest.curbHold || null, node: guest.node } : null,
      offMap: view.vehicles.filter((car) => car.r < -1e-4).length + bodies.filter((m) => m.r < -1e-4).length,
    }
  })()`)) as Probe
}

async function step() {
  await page.evaluate(`(() => { window.__hold = false; window.__hatch.speed = 1; window.__origTick(1/12); window.__hatch.speed = 0; window.__hold = true })()`)
}

async function shot(dir: string, i: number) {
  const url = (await page.evaluate(`(() => {
    const g = window.__hatch
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

function encode(dir: string, file: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        '12',
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

async function record(name: string, frames: number, follow: () => Promise<{ c: number; r: number } | null>) {
  const dir = `${framesRoot}/${name}`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < frames; i++) {
    await step()
    const at = await follow()
    if (at) await aim(at.c, at.r, 28, 1.05, 0.45)
    await shot(dir, i)
    if (i % 12 === 0) console.log(name, i, at ? `${at.c.toFixed(2)},${at.r.toFixed(2)}` : 'hold')
  }
  const file = `${outDir}/${name}-${sha}.mp4`
  await encode(dir, file)
  await encode(dir, `${artDir}/${name}-${sha}.mp4`)
  const still = `${outDir}/${name}-${sha}.png`
  copyFileSync(`${dir}/frame-${String(frames - 1).padStart(3, '0')}.png`, still)
  copyFileSync(still, `${artDir}/${name}-${sha}.png`)
  console.log('wrote', file)
}

const dropSetup = await page.evaluate(`(() => {
  const g = window.__hatch
  g.clock = 40
  g.hallGuests = []
  g.seedHallForFlight({ id: 'proof-out', cargo: false, pax: 40, airline: 'northline', stand: null }, 'depart')
  const guest = g.hallGuests.find((x) => x.flightId === 'proof-out')
  guest.arriveMode = 'dropoff'
  guest.curbHold = 'ride'
  guest.curbOrder = undefined
  guest.releaseAt = g.clock + 90
  guest.path = []
  guest.seg = 0
  guest.t = 0
  guest.thought = 'On the way to the doors'
  g.hallGuests = [guest]
  return { id: guest.id, flightId: guest.flightId }
})()`)
console.log('drop guest', dropSetup)
const dropId = (dropSetup as { id: string }).id

let dropCar: { c: number; r: number } | null = null
let sawWalk = false
let meshOk = 0
let meshBad = 0
const turnSteps: number[] = []
let prevHead: number | null = null
function note(snap: Probe) {
  if (snap.offMap) throw new Error(`vehicle centre off the north edge (${snap.offMap})`)
  for (const car of snap.vehicles) {
    if (!Number.isFinite(car.meshC)) {
      meshBad++
      continue
    }
    const d = Math.hypot(car.meshC - car.c, car.meshR - car.r)
    const dh = Math.abs(Math.atan2(Math.sin(car.meshHeading - car.heading), Math.cos(car.meshHeading - car.heading)))
    if (d < 0.15 && dh < 0.2) meshOk++
    else meshBad++
    if (car.r > 10.4 && Number.isFinite(car.meshHeading)) {
      if (prevHead != null) {
        turnSteps.push(Math.abs(Math.atan2(Math.sin(car.meshHeading - prevHead), Math.cos(car.meshHeading - prevHead))))
      }
      prevHead = car.meshHeading
    }
  }
  for (const person of snap.people) {
    if (!Number.isFinite(person.meshC)) meshBad++
    else if (Math.hypot(person.meshC - person.c, person.meshR - person.r) < 0.2) meshOk++
    else meshBad++
  }
}
for (let i = 0; i < 70 && !sawWalk; i++) {
  await page.evaluate(`(() => { const g = window.__hatch; g.speed = 1; for (let n = 0; n < 12; n++) window.__origTick(1/12); g.speed = 0 })()`)
  const snap = await probe(dropId)
  note(snap)
  const stopped = snap.vehicles.find((car) => car.kind === 'taxi' && car.state === 'stop')
  if (stopped && snap.guest?.flightId === 'proof-out') {
    sawWalk = true
    dropCar = { c: stopped.c, r: stopped.r }
    console.log('guest at stop', snap.guest)
  } else if (i % 5 === 0) console.log('seeking drop', i, snap.vehicles.map((car) => `${car.kind}:${car.state}@${car.r.toFixed(1)}`).join(' '))
}
if (!sawWalk || !dropCar) throw new Error('departure never alighted')
console.log('alighted', dropCar, 'mesh', meshOk, meshBad, 'turn samples', turnSteps.length)

await record('curb-dropoff', 12 * 8, async () => {
  const snap = await probe(dropId)
  note(snap)
  const person = snap.people[0]
  if (person) return { c: person.c, r: person.r }
  const car = snap.vehicles[0]
  return car ? { c: car.c, r: car.r } : dropCar
})
const turned = (await page.evaluate(`(() => {
  const w = window.__world
  const g = window.__hatch
  const CELL = ${CELL}
  const half = 31 / 2
  const steps = []
  let prev = null
  for (let n = 0; n < 12 * 25; n++) {
    g.speed = 1
    window.__origTick(1 / 12)
    g.speed = 0
    w.render(g)
    const mesh = w.scene.getObjectByName('landside-taxi-body') || w.scene.getObjectByName('landside-car-body')
    if (!mesh || !mesh.count) continue
    const arr = mesh.instanceMatrix.array
    let best = null
    for (let i = 0; i < mesh.count; i++) {
      const o = i * 16
      const r = arr[o + 14] / CELL + half
      const heading = -Math.atan2(arr[o + 8], arr[o + 0])
      if (r > 10.4 && (best == null || r > best.r)) best = { r, heading }
    }
    if (!best) continue
    if (prev != null) {
      const d = Math.abs(Math.atan2(Math.sin(best.heading - prev), Math.cos(best.heading - prev)))
      steps.push(d)
    }
    prev = best.heading
    if (steps.filter((s) => s > 0.02).length >= 12) break
  }
  return steps
})()`)) as number[]
turnSteps.push(...turned)

const pickSetup = await page.evaluate(`(() => {
  const g = window.__hatch
  g.hallGuests = []
  g.seedHallForFlight({ id: 'proof-in', cargo: false, pax: 40, airline: 'northline', stand: null }, 'arrive')
  const guest = g.hallGuests.find((x) => x.flightId === 'proof-in')
  guest.node = 'claim'
  guest.path = ['claim', 'exit']
  guest.seg = 0
  guest.t = 0.99
  guest.clearedSec = true
  guest.needs.bags = 0
  guest.needs.hunger = 0
  guest.needs.bladder = 0
  guest.needs.energy = 0
  guest.needs.shop = 0
  guest.needs.play = 0
  guest.needs.boarding = 0
  g.hallGuests = [guest]
  return { id: guest.id, flightId: guest.flightId }
})()`)
console.log('pick guest', pickSetup)
const pickId = (pickSetup as { id: string }).id

let pickAt: { c: number; r: number } | null = null
for (let i = 0; i < 80 && !pickAt; i++) {
  await page.evaluate(`(() => { const g = window.__hatch; g.speed = 1; for (let n = 0; n < 12; n++) window.__origTick(1/12); g.speed = 0 })()`)
  const snap = await probe(pickId)
  note(snap)
  if (snap.people.length) {
    pickAt = { c: snap.people[0].c, r: snap.people[0].r }
    console.log('guest at pickup', snap.guest)
  } else if (i % 5 === 0) console.log('seeking pickup', i, snap.vehicles.map((car) => `${car.kind}:${car.state}@${car.r.toFixed(1)}`).join(' '))
}
if (!pickAt) throw new Error('arrival was never walked to a pickup')
console.log('pickup walk', pickAt)

await record('curb-pickup', 12 * 8, async () => {
  const snap = await probe(pickId)
  const person = snap.people[0]
  if (person) return { c: person.c, r: person.r }
  const car = snap.vehicles[0]
  return car ? { c: car.c, r: car.r } : pickAt
})

const maxTurn = turnSteps.reduce((m, s) => Math.max(m, s), 0)
const arc = turnSteps.filter((s) => s > 0.02).length
console.log('u-turn mesh steps', turnSteps.length, 'arc', arc, 'max', maxTurn.toFixed(3))
// A step above about 0.5 rad at 1/12 s is a snap. Larger jumps are the sampler
// changing which body it follows, which the per-vehicle sim test already rejects.

writeFileSync(
  `${outDir}/probe-${sha}.json`,
  JSON.stringify({ sha, meshOk, meshBad, maxTurn, arcSamples: arc, turnSteps: turnSteps.length, dropId, pickId }, null, 2),
)
console.log('probe mesh matches', meshOk, 'mismatches', meshBad)
if (meshOk < 8 || meshBad > meshOk) throw new Error('rendered meshes did not track the live vehicles')

await browser.close()
console.log('done', sha)
