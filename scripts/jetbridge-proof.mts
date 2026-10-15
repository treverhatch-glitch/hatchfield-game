// In-play proof clips for the jet bridge seal. Real Vite client, ?playtest=1.
// Nothing here sets a flight phase: the player buys one bridge, signs letters,
// and the script only changes sim speed and the camera while it waits.
//   jetbridge-board.mp4   bridge docked on a boarding airliner, camera orbits, then pans to the stair stand
//   jetbridge-retract.mp4 doors close, the bridge pulls back, then the tug pushes
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const out = process.env.JB_OUT ?? 'docs/devlog/media/jetbridge-proof'
const work = process.env.JB_FRAMES ?? '/tmp/jetbridge-frames'
mkdirSync(out, { recursive: true })

const server = await createServer({ server: { port: 45941, strictPort: false }, logLevel: 'error' })
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
await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site)')
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) {
  await coach.click()
  await page.waitForFunction('!window.__hatch.showStarterKit()')
} else {
  await page.evaluate('window.__hatch.buildStarterKit()')
}

// The player's purchase: one bridge on a starter stand. The other stays on stairs.
const bought = await page.evaluate(`(() => {
  const g = window.__hatch
  g.cash = Math.max(g.cash, 200000)
  g.closeNegotiationPanel && g.closeNegotiationPanel()
  const ok = g.buyFitting('stand:11,6', 'jet_bridge')
  g.setView && g.setView('apron')
  g.speed = 8
  return { ok, access: g.standAccess['11,6'], bridges: g.boughtBridges({ c: 11, r: 6 }) }
})()`)
console.log('bought', bought)

// Sign offers as they come, keep the bridge on the stand the next airliner is heading for
// (a player moving the fitting before that aircraft arrives), and wait for it to board.
await page.evaluate(`(() => {
  const g = window.__hatch
  const STANDS = [{ c: 11, r: 6 }, { c: 11, r: 12 }]
  const ON_STAND = { deboard: 1, servicing: 1, parked: 1, board: 1 }
  const INBOUND = { hold: 1, approach: 1, landing: 1, taxi_in: 1 }
  const airliner = (f) => !f.cargo && !f.ga && (f.craft || 'jet') === 'jet' && ['narrowbody', 'regional', 'widebody'].includes(f.kind)
  const same = (a, b) => a && b && a.c === b.c && a.r === b.r
  const busy = (s) => g.flights.some((f) => same(f.stand, s) && ON_STAND[f.phase])
  window.__jb = { target: null, ready: false, log: [], moves: [] }
  const tick = () => {
    if (window.__jb.ready) return
    if (g.offer) { g.acceptOffer(); g.closeNegotiationPanel && g.closeNegotiationPanel() }
    let target = window.__jb.target && g.flights.find((f) => f.id === window.__jb.target)
    if (!target || target.phase === 'gone' || target.phase === 'taxi_out' || target.phase === 'takeoff') {
      target = g.flights.find((f) => airliner(f) && f.stand && STANDS.some((s) => same(s, f.stand)) && INBOUND[f.phase] && !busy(f.stand))
      window.__jb.target = target ? target.id : null
      if (target) {
        const other = STANDS.find((s) => !same(s, target.stand))
        if (g.boughtBridges(target.stand) < 1) {
          if (g.boughtBridges(other) > 0 && !busy(other)) g.removeFitting('stand:' + other.c + ',' + other.r, 'jet_bridge')
          g.cash = Math.max(g.cash, 50000)
          g.buyFitting('stand:' + target.stand.c + ',' + target.stand.r, 'jet_bridge')
          window.__jb.moves.push({ to: target.stand, at: Math.round(g.clock) })
        }
      }
    }
    const now = performance.now()
    if (!window.__jb.last || now - window.__jb.last > 3000) {
      window.__jb.last = now
      window.__jb.log.push({ clock: Math.round(g.clock), target: window.__jb.target, phases: g.flights.slice(0, 8).map((f) => (f.airframeId || '?') + ':' + f.phase + (f.stand ? '@' + f.stand.c + ',' + f.stand.r : '')) })
      if (window.__jb.log.length > 30) window.__jb.log.shift()
    }
    if (target && target.phase === 'board' && g.boughtBridges(target.stand) > 0 && target.phaseTime > 6) {
      g.speed = 1
      window.__jb.ready = true
      window.__jb.stand = target.stand
      window.__jb.other = STANDS.find((s) => !same(s, target.stand))
    }
  }
  setInterval(tick, 40)
})()`)

try {
  await page.waitForFunction('window.__jb && window.__jb.ready', null, { timeout: 600_000, polling: 250 })
} catch (err) {
  console.error('never boarded', JSON.stringify(await page.evaluate('window.__jb'), null, 2))
  throw err
}
console.log('boarding', JSON.stringify(await page.evaluate('({ target: window.__jb.target, stand: window.__jb.stand, moves: window.__jb.moves })')))

type Sample = { clock: number; phase: string; phaseTime: number; extend: number; stairs: number; otherPhase: string | null }
const sampleJs = `(() => {
  const g = window.__hatch
  const f = g.flights.find((x) => x.id === window.__jb.target)
  const o = g.flights.find((x) => x.stand && x.stand.c === window.__jb.other.c && x.stand.r === window.__jb.other.r && x.phase !== 'gone')
  return {
    clock: +g.clock.toFixed(2),
    phase: f ? f.phase : 'gone',
    phaseTime: f ? +f.phaseTime.toFixed(2) : 0,
    extend: +g.bridgeExtendAt(window.__jb.stand).toFixed(3),
    stairs: g.crewScene().props.filter((p) => p.kind === 'stairs').length,
    otherPhase: o ? o.airframeId + ':' + o.phase : null,
  }
})()`

/** The drawn bridge pieces, from the live scene graph. */
const bridgeJs = `(() => {
  const w = window.__world
  const root = w.wr.staticGroup.getObjectByName('jet-bridges')
  const apron = root && root.children.find((c) => c.name === 'apron-bridge' && c.userData.stand.c === window.__jb.stand.c && c.userData.stand.r === window.__jb.stand.r)
  const pos = (name) => { const o = apron && apron.getObjectByName(name); return o ? { x: o.position.x, y: o.position.y, z: o.position.z } : null }
  return { rot: pos('bridge-rotunda'), cab: pos('bridge-cab'), bellows: pos('bridge-bellows') }
})()`

const CELL = 22 * 0.45
const cell = (c: number, r: number) => ({ x: (c - 31 / 2) * CELL, z: (r - 31 / 2) * CELL })

async function camera(p: Page, pivot: { x: number; z: number }, yaw: number, pitch: number, dist: number) {
  await p.evaluate(
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

await page.evaluate('window.__world.setDayNight({ hour: 11 })')
const parts = (await page.evaluate(bridgeJs)) as { rot: { x: number; z: number } | null; cab: { x: number; z: number } | null }
const stand = (await page.evaluate('window.__jb.stand')) as { c: number; r: number }
const other = (await page.evaluate('window.__jb.other')) as { c: number; r: number }
const craft = (await page.evaluate('(() => { const f = window.__hatch.flights.find((x) => x.id === window.__jb.target); return { x: f.x, y: f.y, heading: f.heading } })()')) as { x: number; y: number; heading: number }
const craftAt = cell(craft.x, craft.y)
const cabAt = parts.cab ?? craftAt
const rotAt = parts.rot ?? cabAt
const otherAt = cell(other.c, other.r)
// Camera sits at pivot + dist·(sin yaw, cos yaw). Put it on the door side of the fuselage.
let lat = { x: -Math.sin(craft.heading), z: Math.cos(craft.heading) }
if ((rotAt.x - craftAt.x) * lat.x + (rotAt.z - craftAt.z) * lat.z < 0) lat = { x: -lat.x, z: -lat.z }
const sideYaw = Math.atan2(lat.x, lat.z)
const lerpP = (a: { x: number; z: number }, b: { x: number; z: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
const smooth = (t: number) => t * t * (3 - 2 * t)
const reach = Math.hypot(rotAt.x - cabAt.x, rotAt.z - cabAt.z)
console.log('geometry', { craftAt, cabAt, rotAt, otherAt, sideYaw, reach })

// Clip 1: live at 1x. Orbit the docked cab, then pull out to the whole bridge from facade to door.
const boardDir = `${work}/board`
rmSync(boardDir, { recursive: true, force: true })
mkdirSync(boardDir, { recursive: true })
const boardLog: (Sample & { frame: number })[] = []
const boardFrames = 45
const doorPivot = lerpP(craftAt, cabAt, 0.75)
const wholePivot = lerpP(cabAt, rotAt, 0.45)
const wideDist = Math.max(40, reach * 1.5)
for (let i = 0; i < boardFrames; i++) {
  const u = i / (boardFrames - 1)
  let pivot = doorPivot
  let yaw = sideYaw - 0.75 + (u / 0.5) * 1.5
  let dist = 20
  let pitch = 0.42
  if (u > 0.5 && u <= 0.78) {
    const s = smooth((u - 0.5) / 0.28)
    pivot = lerpP(doorPivot, wholePivot, s)
    yaw = sideYaw + 0.75 - s * 0.55
    dist = 20 + s * (wideDist - 20)
    pitch = 0.42 + s * 0.2
  } else if (u > 0.78) {
    const s = (u - 0.78) / 0.22
    pivot = wholePivot
    yaw = sideYaw + 0.2 + s * 0.35
    dist = wideDist
    pitch = 0.62
  }
  await camera(page, pivot, yaw, pitch, dist)
  await page.waitForTimeout(60)
  await page.screenshot({ path: `${boardDir}/frame-${String(i).padStart(3, '0')}.png` })
  boardLog.push({ frame: i, ...((await page.evaluate(sampleJs)) as Sample) })
}
await encode(boardDir, 3, `${out}/jetbridge-board.mp4`)
console.log('board clip', boardLog[0], boardLog[boardLog.length - 1])

// Clip 2: fast-forward the rest of the board, then slow to 0.15x the moment the doors close.
await page.evaluate(`(() => {
  const g = window.__hatch
  const f = g.flights.find((x) => x.id === window.__jb.target)
  const tick = g.tick.bind(g)
  window.__jb.shut = false
  g.tick = (dt) => {
    tick(dt)
    if (!window.__jb.shut && f && f.bridgeShutAt != null) { window.__jb.shut = true; g.speed = 0.15 }
  }
  g.speed = 3
})()`)
await page.waitForFunction('window.__jb.shut || !window.__hatch.flights.some((f) => f.id === window.__jb.target && f.phase === "board")', null, { timeout: 600_000, polling: 100 })
await page.evaluate('window.__world.setDayNight({ hour: 11 })')
const retractDir = `${work}/retract`
rmSync(retractDir, { recursive: true, force: true })
mkdirSync(retractDir, { recursive: true })
const retractLog: (Sample & { frame: number })[] = []
const retractFrames = 42
const quarter = lerpP(cabAt, rotAt, 0.4)
for (let i = 0; i < retractFrames; i++) {
  const u = i / (retractFrames - 1)
  await camera(page, quarter, sideYaw + 0.3 - u * 0.2, 0.78, Math.max(48, reach * 2.1))
  await page.waitForTimeout(60)
  await page.screenshot({ path: `${retractDir}/frame-${String(i).padStart(3, '0')}.png` })
  const s = (await page.evaluate(sampleJs)) as Sample
  retractLog.push({ frame: i, ...s })
  if (s.phase === 'pushback' && s.phaseTime > 0.6) await page.evaluate('window.__hatch.speed = 0.5')
}
await encode(retractDir, 3, `${out}/jetbridge-retract.mp4`)
console.log('retract clip', retractLog[0], retractLog[retractLog.length - 1])

// Clip 3: a starter stand on mobile stairs. Scheduled airliners take the bridged stand first,
// so the player sells the bridge back and the next airliner on a starter stand walks the stairs.
await page.evaluate(`(() => {
  const g = window.__hatch
  const STANDS = [{ c: 11, r: 6 }, { c: 11, r: 12 }]
  g.tick = Object.getPrototypeOf(g).tick.bind(g)
  for (const s of STANDS) if (g.boughtBridges(s) > 0) g.removeFitting('stand:' + s.c + ',' + s.r, 'jet_bridge')
  window.__jb.soldBack = STANDS.map((s) => g.boughtBridges(s))
  window.__jb.stairsReady = false
  g.speed = 8
  const poll = setInterval(() => {
    if (g.offer) { g.acceptOffer(); g.closeNegotiationPanel && g.closeNegotiationPanel() }
    const airliner = (x) => !x.cargo && !x.ga && x.kind !== 'military' && ['narrowbody', 'regional', 'widebody'].includes(x.kind)
    const f = g.flights.find((x) => airliner(x) && x.stand && STANDS.some((s) => s.c === x.stand.c && s.r === x.stand.r) && (x.phase === 'deboard' || x.phase === 'board'))
    const stairs = g.crewScene().props.some((p) => p.kind === 'stairs')
    if (f && stairs) { g.speed = 0.25; window.__jb.stairsReady = true; window.__jb.stairFlight = f.id; window.__jb.bridgeTarget = window.__jb.target; window.__jb.target = f.id; clearInterval(poll) }
  }, 30)
})()`)
await page.waitForFunction('window.__jb.stairsReady', null, { timeout: 600_000, polling: 100 })
const stairCraft = (await page.evaluate('(() => { const f = window.__hatch.flights.find((x) => x.id === window.__jb.stairFlight); return { x: f.x, y: f.y, heading: f.heading, af: f.airframeId } })()')) as { x: number; y: number; heading: number; af: string }
const stairAt = cell(stairCraft.x, stairCraft.y)
const hall = cell(14, 8)
let stairLat = { x: -Math.sin(stairCraft.heading), z: Math.cos(stairCraft.heading) }
if ((hall.x - stairAt.x) * stairLat.x + (hall.z - stairAt.z) * stairLat.z < 0) stairLat = { x: -stairLat.x, z: -stairLat.z }
const stairYaw = Math.atan2(stairLat.x, stairLat.z)
await page.evaluate('window.__world.setDayNight({ hour: 11 })')
const stairDir = `${work}/stairs`
rmSync(stairDir, { recursive: true, force: true })
mkdirSync(stairDir, { recursive: true })
const stairLog: (Sample & { frame: number })[] = []
const stairFrames = 36
for (let i = 0; i < stairFrames; i++) {
  const u = i / (stairFrames - 1)
  await camera(page, stairAt, stairYaw - 0.7 + u * 1.4, 0.5, 26)
  await page.waitForTimeout(60)
  await page.screenshot({ path: `${stairDir}/frame-${String(i).padStart(3, '0')}.png` })
  stairLog.push({ frame: i, ...((await page.evaluate(sampleJs)) as Sample) })
}
await encode(stairDir, 3, `${out}/starter-stairs.mp4`)
console.log('stairs clip', stairCraft, stairLog[0], stairLog[stairLog.length - 1])

writeFileSync(
  `${out}/proof-log.json`,
  JSON.stringify({ bought, moves: await page.evaluate('window.__jb.moves'), target: await page.evaluate('window.__jb.bridgeTarget'), stairFlight: await page.evaluate('window.__jb.stairFlight'), stand, other, board: boardLog, retract: retractLog, stairCraft, soldBack: await page.evaluate('window.__jb.soldBack'), stairs: stairLog, errors }, null, 2),
)
console.log('wrote', out, 'pageerrors', errors)
await finish(0)
