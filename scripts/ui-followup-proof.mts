/**
 * Live HUD proof for the Oct 16 inspector follow-up.
 * Vite dev server so a click can hit the real hall and apron. ?playtest=1, 1280×720.
 * The live loop is held, then each frame advances exactly 1/12 s of game time
 * (speed 1) and screenshots the render. ffmpeg encodes those frames at 12 fps.
 * Nothing is injected and the clock is not jumped.
 *
 *   npx tsx scripts/ui-followup-proof.mts
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, copyFileSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'

const PORT = 46331
const URL = `http://127.0.0.1:${PORT}/?playtest=1`
const VIEW = { width: 1280, height: 720 }
const FPS = 12
const OUT = 'docs/devlog/media/ui-followup-oct16'
const ART = '/opt/cursor/artifacts'
const WORK = '/tmp/ui-followup-proof'
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
})

type Box = { id: string; x: number; y: number; w: number; h: number }

const WATCH: Record<string, string> = {
  goals: '[data-testid="milestone-stack"]',
  phone: '.hud .phone-dock.embedded',
  relations: '[data-testid="relations-tab"]',
  timetable: '.tt-root[data-open="1"] .tt-dock',
  'info-views': '[data-testid="info-view-bar"]',
  'build-tray': '.hud .build-tray',
  'flight-card': '[data-testid="flight-card"]',
  offer: '[data-testid^="phone-card-"]',
  'building-panel': '[data-testid="building-panel"]',
  'flight-phase': '[data-testid="flight-phase"]',
  'building-note': '[data-testid="building-note"]',
  'vehicle-phase': '[data-testid="vehicle-phase"]',
}

async function waitForServer() {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(URL)).ok) return
    } catch {
      /* booting */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('vite did not start')
}

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.getByTestId('sandbox-toggle').uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: object }).__hatch))
  await page.getByTestId('starter-kit-coach').click()
  await page.waitForFunction(() => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit())
}

async function boxes(page: Page, ids: string[]): Promise<Box[]> {
  return page.evaluate(
    ({ watch, ids }) => {
      const out: { id: string; x: number; y: number; w: number; h: number }[] = []
      for (const id of ids) {
        const el = document.querySelector(watch[id])
        if (!el) continue
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        out.push({ id, x: r.x, y: r.y, w: r.width, h: r.height })
      }
      return out
    },
    { watch: WATCH, ids },
  )
}

function contains(a: Box, b: Box): boolean {
  const e = 1
  return a.x <= b.x + e && a.y <= b.y + e && a.x + a.w + e >= b.x + b.w && a.y + a.h + e >= b.y + b.h
}

function hitPairs(found: Box[]): string[] {
  const hits: string[] = []
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const a = found[i]
      const b = found[j]
      if (contains(a, b) || contains(b, a)) continue
      const e = 0.5
      if (a.x + e < b.x + b.w && b.x + e < a.x + a.w && a.y + e < b.y + b.h && b.y + e < a.y + a.h) {
        hits.push(`${a.id} × ${b.id}`)
      }
    }
  }
  return hits
}

const DT = 1 / 12
const LAYOUT_FRAMES = 72
const LIVE_FRAMES = 144

/** Hold the rAF loop, step 1/12 s of game time, wait for the render, screenshot. */
async function shoot(page: Page, dir: string, frames: number): Promise<{ frames: number; clock0: number; clock1: number }> {
  mkdirSync(dir, { recursive: true })
  const clock0 = await page.evaluate(() => {
    const g = (window as unknown as { __hatch: { speed: number; clock: number; tick: (dt: number) => void } }).__hatch
    const held = g as typeof g & { __stepOrig?: (dt: number) => void; __stepSpeed?: number }
    held.__stepSpeed = g.speed
    g.speed = 1
    held.__stepOrig = g.tick.bind(g)
    g.tick = () => {}
    return g.clock
  })
  for (let i = 0; i < frames; i++) {
    await page.evaluate((dt) => {
      const g = (window as unknown as { __hatch: { __stepOrig: (dt: number) => void } }).__hatch
      g.__stepOrig(dt)
    }, DT)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    await page.screenshot({ path: join(dir, `frame-${String(i).padStart(3, '0')}.png`), type: 'png' })
    if (i === 0 || i === frames - 1 || i % 24 === 0) console.log(`  ${dir} frame ${i}`)
  }
  const clock1 = await page.evaluate(() => {
    const g = (window as unknown as { __hatch: { speed: number; clock: number; tick: (dt: number) => void; __stepOrig: (dt: number) => void; __stepSpeed: number } }).__hatch
    g.tick = g.__stepOrig
    g.speed = g.__stepSpeed
    return g.clock
  })
  return { frames, clock0, clock1 }
}

function encode(dir: string, file: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'frame-%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
      { stdio: 'inherit' },
    )
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
  })
}

async function clickSpeed(page: Page, label: string) {
  await page.getByTestId('stats-bar').getByRole('button', { name: label, exact: true }).click()
}

async function openPhone(page: Page, keepTab = false) {
  if (!keepTab) await page.getByTestId('dock-tab-phone').click()
  const peek = page.getByTestId('phone-peek')
  if (await peek.count()) await peek.click()
  const messages = page.getByTestId('phone-tab-messages')
  if ((await messages.count()) && (await messages.getAttribute('aria-selected')) !== 'true') await messages.click()
}

async function projectClick(page: Page, kind: 'flight' | 'security'): Promise<{ x: number; y: number } | null> {
  return page.evaluate((kind) => {
    const w = window as unknown as {
      __world?: {
        camera: { updateMatrixWorld: () => void }
        pivot: { set: (x: number, y: number, z: number) => void }
        placeCam: () => void
        jets: Map<string, { position: { x: number; y: number; z: number; clone: () => { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void; project: (c: unknown) => void } }; visible: boolean }>
      }
      __hall?: {
        camera: { updateMatrixWorld: () => void }
        pivot: { set: (x: number, y: number, z: number) => void }
        placeCam: () => void
        dist: number
        serviceFx: {
          facilityTargets: () => {
            userData: { facilityId?: string }
            position: { clone: () => { x: number; y: number; z: number; project: (c: unknown) => void } }
            parent: { localToWorld: (v: { x: number; y: number; z: number; project: (c: unknown) => void }) => void } | null
          }[]
        }
      }
      __hatch?: { flights: { id: string; phase: string }[]; hallNav: { metrics: () => { id: string; kind: string }[] } }
    }
    let cam: { updateMatrixWorld: () => void } | undefined
    let point: { x: number; y: number; z: number; project: (c: unknown) => void } | undefined
    if (kind === 'flight') {
      const world = w.__world
      const flight = w.__hatch?.flights.find((row) => row.phase !== 'gone')
      const mesh = flight && world?.jets.get(flight.id)
      if (!world || !mesh || !mesh.visible) return null
      world.pivot.set(mesh.position.x, 0, mesh.position.z)
      ;(world as { dist: number }).dist = 52
      world.placeCam()
      const ground = mesh.position.clone()
      ground.y = 0.2
      cam = world.camera
      point = ground
    } else {
      const hall = w.__hall
      const lane = w.__hatch?.hallNav.metrics().find((row) => row.kind === 'security_lane')
      const pick = lane && hall?.serviceFx.facilityTargets().find((row) => row.userData.facilityId === lane.id)
      if (!hall || !pick) return null
      const v = pick.position.clone()
      ;(pick.parent ?? pick).localToWorld(v)
      hall.pivot.set(v.x, 0, v.z)
      hall.dist = Math.min(hall.dist, 16)
      hall.placeCam()
      cam = hall.camera
      point = v
    }
    if (!cam || !point) return null
    cam.updateMatrixWorld()
    point.project(cam)
    const canvas = [...document.querySelectorAll('canvas')].find((node) => {
      const r = node.getBoundingClientRect()
      return r.width > 100 && r.height > 100 && getComputedStyle(node).visibility !== 'hidden'
    })
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const projected = point as { z: number }
    if (projected.z > 1) return null
    const p = point as unknown as { x: number; y: number }
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height }
  }, kind)
}

async function ensureFlightCard(page: Page) {
  const visible = () => page.getByTestId('flight-card').isVisible().catch(() => false)
  const follow = page.getByTestId('follow-cam')
  if (await follow.count()) {
    const label = (await follow.innerText()).trim()
    if (!label.startsWith('Following')) await follow.click()
    await page.waitForTimeout(700)
  } else {
    const point = await projectClick(page, 'flight')
    if (point) await page.mouse.click(point.x, point.y)
  }
  if (!(await visible())) {
    const box = await page.locator('canvas.field').boundingBox()
    if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42)
    await page.getByTestId('flight-card').waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {})
  }
  return visible()
}

async function holdLoop(page: Page) {
  await page.evaluate(() => {
    const g = (window as unknown as {
      __hatch: { speed: number; tick: (dt: number) => void; __stepOrig?: (dt: number) => void; __stepSpeed?: number }
    }).__hatch
    if (g.__stepOrig) return
    g.__stepSpeed = g.speed
    g.speed = 1
    g.__stepOrig = g.tick.bind(g)
    g.tick = () => {}
  })
}

async function releaseLoop(page: Page) {
  await page.evaluate(() => {
    const g = (window as unknown as {
      __hatch: { speed: number; tick: (dt: number) => void; __stepOrig?: (dt: number) => void; __stepSpeed?: number }
    }).__hatch
    if (!g.__stepOrig || g.__stepSpeed == null) return
    g.tick = g.__stepOrig
    g.speed = g.__stepSpeed
    g.__stepOrig = undefined
  })
}

async function stepHeld(page: Page, dt: number) {
  await page.evaluate((step) => {
    const g = (window as unknown as { __hatch: { __stepOrig: (dt: number) => void } }).__hatch
    g.__stepOrig(step)
  }, dt)
}

/** Step until a flight is inside a phase that should change within the next 12s. */
async function seekPhaseWindow(page: Page): Promise<{ id: string; phase: string; phaseTime: number; no: string }> {
  const soon = (phase: string, phaseTime: number) => {
    // These phases change name inside a 12s clip when the path is clear.
    // Deboard and board often run longer than 12s, so they are not proof windows.
    if (phase === 'pushback' && phaseTime < 0.8) return true
    if (phase === 'takeoff' && phaseTime < 0.45) return true
    if (phase === 'taxi_out' && phaseTime < 0.35) return true
    return false
  }
  const seen = new Map<string, number>()
  for (let i = 0; i < 1600; i++) {
    await stepHeld(page, 0.25)
    const rows = await page.evaluate(() => {
      const g = (window as unknown as {
        __hatch: {
          flights: {
            id: string
            phase: string
            phaseTime: number
            flightNo: string
            kind: string
            fuelHeld?: boolean
            posted: { fuel: boolean }
          }[]
        }
      }).__hatch
      return g.flights
        .filter((row) => row.phase !== 'gone' && row.kind !== 'air_ambulance' && row.kind !== 'military')
        .map((row) => ({
          id: row.id,
          phase: row.phase,
          phaseTime: row.phaseTime,
          no: row.flightNo,
          fuel: row.posted.fuel,
          held: Boolean(row.fuelHeld),
        }))
    })
    for (const row of rows) seen.set(row.phase, (seen.get(row.phase) ?? 0) + 1)
    const hit = rows.find(
      (row) =>
        !row.held &&
        (soon(row.phase, row.phaseTime) ||
          (row.phase === 'deboard' && row.phaseTime >= 18 && row.phaseTime <= 28) ||
          (row.phase === 'servicing' && row.fuel && row.phaseTime >= 3 && row.phaseTime <= 7) ||
          (row.phase === 'board' && row.phaseTime >= 18 && row.phaseTime <= 30)),
    )
    if (hit) return hit
    if (i > 0 && i % 400 === 0) console.log('seek', i, JSON.stringify([...seen.entries()]))
  }
  throw new Error(`no flight entered a short phase window; phases ${JSON.stringify([...seen.entries()])}`)
}

async function focusFlight(page: Page, id: string) {
  await page.evaluate(async (flightId) => {
    const g = (window as unknown as {
      __hatch: {
        view: string
        tool: string
        selectedFlight: string | null
        emit: () => void
        flights: { id: string }[]
      }
    }).__hatch
    const card = await import('/src/ui/inspector/flightCard.ts')
    const cam = await import('/src/camera/session.ts')
    const actors = await import('/src/camera/actors.ts')
    g.view = 'apron'
    g.tool = 'pan'
    g.selectedFlight = flightId
    g.emit()
    card.openFlightCard(flightId)
    const tracks = actors.tracksFrom(actors.snapshotFrom(g as never))
    const track = tracks.find((row: { id: string }) => row.id === `plane:${flightId}`)
    if (track) {
      cam.cameraSession.stopFollow()
      cam.cameraSession.select(track)
      cam.cameraSession.startFollow()
    }
  }, id)
  await page.getByTestId('flight-card').waitFor({ state: 'visible', timeout: 8_000 })
  await page.getByTestId('view-apron').click().catch(() => {})
}

async function shootFlight(page: Page, dir: string, frames: number) {
  mkdirSync(dir, { recursive: true })
  const samples: { sim: string; shown: string; text: string }[] = []
  for (let i = 0; i < frames; i++) {
    const sample = await page.evaluate(async (dt) => {
      const g = (window as unknown as {
        __hatch: { __stepOrig: (dt: number) => void; flights: { id: string; phase: string }[] }
      }).__hatch
      g.__stepOrig(dt)
      const card = await import('/src/ui/inspector/flightCard.ts')
      const deadline = performance.now() + 600
      let shown = ''
      let sim = ''
      let text = ''
      while (performance.now() < deadline) {
        const id = card.flightCardFlightId()
        const flight = g.flights.find((row) => row.id === id)
        sim = flight?.phase ?? ''
        const el = document.querySelector('[data-testid="flight-phase"]')
        shown = el?.getAttribute('data-phase') ?? ''
        text = el?.textContent?.trim() ?? ''
        if (sim && shown === sim) break
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
      }
      return { sim, shown, text }
    }, DT)
    samples.push(sample)
    await page.screenshot({ path: join(dir, `frame-${String(i).padStart(3, '0')}.png`), type: 'png' })
    if (i > 8 && !sample.shown) break
    if (i === 60 && samples.every((row) => row.shown === samples[0]?.shown)) break
    if (i === 0 || i === frames - 1 || i % 24 === 0) {
      console.log(`  ${dir} frame ${i} ${sample.sim} / ${sample.shown} ${sample.text}`)
    }
  }
  return samples
}

async function recordChangingFlight(page: Page) {
  await holdLoop(page)
  const dir = join(WORK, 'inspector-flight')
  rmSync(dir, { recursive: true, force: true })
  let last: {
    attempt: number
    pick: { id: string; phase: string; phaseTime: number; no: string }
    phases: string[]
    simPhases: string[]
    stuck: number
    texts: string[]
  } | null = null
  for (let attempt = 1; attempt <= 8; attempt++) {
    const pick = await seekPhaseWindow(page)
    console.log('flight window', attempt, JSON.stringify(pick))
    await focusFlight(page, pick.id)
    const samples = await shootFlight(page, dir, LIVE_FRAMES)
    const phases = [...new Set(samples.map((row) => row.shown).filter(Boolean))]
    const simPhases = [...new Set(samples.map((row) => row.sim).filter(Boolean))]
    const stuck = samples.filter((row) => row.sim && row.shown !== row.sim).length
    const texts = [...new Set(samples.map((row) => row.text).filter(Boolean))]
    last = { attempt, pick, phases, simPhases, stuck, texts }
    console.log('flight phases', phases.join(' -> '), 'stuck', stuck)
    if (phases.length >= 2 && stuck === 0) break
  }
  await releaseLoop(page)
  if (!last || last.phases.length < 2 || last.stuck > 0) {
    throw new Error(`selected flight phase did not change live: ${JSON.stringify(last)}`)
  }
  return last
}

async function readTexts(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => ({
    phase: document.querySelector('[data-testid="flight-phase"]')?.textContent?.trim() ?? '',
    note: document.querySelector('[data-testid="building-note"]')?.textContent?.trim() ?? '',
    queue: document.querySelector('[data-testid="building-figure-queue"]')?.textContent?.trim() ?? '',
    bays: document.querySelector('[data-testid="building-figure-bays"]')?.textContent?.trim() ?? '',
    vehicle: document.querySelector('[data-testid="vehicle-phase"]')?.textContent?.trim() ?? '',
    offer: document.querySelector('[data-testid^="phone-card-"]')?.textContent?.trim().slice(0, 120) ?? '',
  }))
}

async function main() {
  if (!CHROME) throw new Error('no Chrome binary')
  mkdirSync(OUT, { recursive: true })
  mkdirSync(ART, { recursive: true })
  const keep = process.env.PROOF_KEEP === '1'
  if (!keep) rmSync(WORK, { recursive: true, force: true })
  mkdirSync(WORK, { recursive: true })
  const server: ChildProcess = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  })
  const log: Record<string, unknown> = {}
  try {
    await waitForServer()
    const browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    })
    try {
      const page = await browser.newPage({ viewport: VIEW })
      page.setDefaultTimeout(90_000)
      await boot(page)
      const only = process.env.PROOF_ONLY ?? ''

      if (only !== 'flight' && only !== 'security') {
      await page.getByTestId('dock-tab-airlines').click()
      await page.getByTestId('relations-tab').waitFor({ state: 'visible' })
      await openPhone(page, true)
      await page.locator('.hud .phone-dock.embedded[data-state="open"]').waitFor({ state: 'visible' })
      const goalsBoxes = await boxes(page, ['goals', 'phone', 'relations'])
      log.goals = { boxes: goalsBoxes, overlaps: hitPairs(goalsBoxes), frames: LAYOUT_FRAMES, step: DT }
      console.log('goals', JSON.stringify(log.goals))
      log.goalsStep =
        keep && readdirSync(join(WORK, 'goals')).filter((name) => name.endsWith('.png')).length >= LAYOUT_FRAMES
          ? { frames: LAYOUT_FRAMES, reused: true }
          : await shoot(page, join(WORK, 'goals'), LAYOUT_FRAMES)

      await page.getByTestId('dock-tab-timetable').click()
      await page.locator('.tt-root[data-open="1"] .tt-dock').waitFor({ state: 'visible' })
      await page.getByTestId('build-airfield').click()
      await page.locator('.hud .build-tray').waitFor({ state: 'visible' })
      await page.waitForTimeout(500)
      const timeBoxes = await boxes(page, ['timetable', 'build-tray', 'info-views'])
      log.timetable = { boxes: timeBoxes, overlaps: hitPairs(timeBoxes), frames: LAYOUT_FRAMES, step: DT }
      console.log('timetable', JSON.stringify(log.timetable))
      log.timetableStep =
        keep && readdirSync(join(WORK, 'timetable')).filter((name) => name.endsWith('.png')).length >= LAYOUT_FRAMES
          ? { frames: LAYOUT_FRAMES, reused: true }
          : await shoot(page, join(WORK, 'timetable'), LAYOUT_FRAMES)
      await page.getByTestId('build-airfield').click()
      await page.getByTestId('dock-tab-phone').click()
      }

      await clickSpeed(page, '5x')
      const deadline = Date.now() + 180_000
      let offer = false
      let flight = false
      let signedOnce = false
      while (Date.now() < deadline && !(offer && flight)) {
        const state = await page.evaluate(() => {
          const g = (window as unknown as { __hatch: { offer: unknown; flights: { phase: string }[]; signed: string[] } }).__hatch
          return {
            offer: Boolean(g.offer),
            flight: g.flights.some((row) => row.phase !== 'gone'),
            signed: g.signed.length,
          }
        })
        offer = state.offer
        flight = state.flight
        if (state.offer && state.signed === 0 && !signedOnce && !state.flight) {
          signedOnce = true
          await openPhone(page)
          const sign = page.getByTestId('phone-action-contract-sign')
          if (await sign.count()) await sign.click()
        }
        await page.waitForTimeout(500)
      }
      log.wait = { offer, flight }

      if (offer && flight && only !== 'flight') {
        await clickSpeed(page, '1x')
        const cardUp = await ensureFlightCard(page)
        await openPhone(page)
        const both = await boxes(page, ['flight-card', 'offer', 'phone'])
        log.flightOffer = { boxes: both, overlaps: hitPairs(both), cardUp, frames: LAYOUT_FRAMES, step: DT }
        console.log('flight-offer', JSON.stringify(log.flightOffer))
        log.flightOfferStep =
          keep && readdirSync(join(WORK, 'flight-offer')).filter((name) => name.endsWith('.png')).length >= LAYOUT_FRAMES
            ? { frames: LAYOUT_FRAMES, reused: true }
            : await shoot(page, join(WORK, 'flight-offer'), LAYOUT_FRAMES)
      }

      if (flight) {
        if (only !== 'security') {
        await clickSpeed(page, '1x')
        log.inspectorFlight = await recordChangingFlight(page)
        console.log('inspector-flight', JSON.stringify(log.inspectorFlight))
        }

        if (only !== 'flight') {
        await page.getByTestId('view-terminal').click()
        await page.getByTestId('interior-bar').waitFor({ state: 'visible', timeout: 120_000 })
        await page.waitForFunction(
          () => {
            const hall = (window as unknown as { __hall?: { serviceFx: { facilityTargets: () => unknown[] } } }).__hall
            return (hall?.serviceFx.facilityTargets().length ?? 0) > 0
          },
          null,
          { timeout: 30_000 },
        ).catch(() => {})
        const sec = await projectClick(page, 'security')
        if (sec) {
          const spot = await page.evaluate(({ x, y }) => {
            const shifts = [
              [0, 0],
              [0, -36],
              [28, 0],
              [-28, 0],
              [0, 32],
              [48, -24],
              [-48, 20],
            ]
            for (const shift of shifts) {
              const el = document.elementFromPoint(x + shift[0], y + shift[1])
              if (el && el.tagName === 'CANVAS') return { x: x + shift[0], y: y + shift[1], hit: 'canvas' }
            }
            const el = document.elementFromPoint(x, y)
            return { x, y, hit: el ? `${el.tagName}.${el.className}` : 'none' }
          }, sec)
          console.log('security click', JSON.stringify(spot))
          await page.mouse.click(spot.x, spot.y)
        }
        const laneId = await page.evaluate(() => {
          const g = (window as unknown as {
            __hatch: {
              hallNav: { live: boolean; metrics: () => { id: string; kind: string; queueLength: number; served: number }[] }
              selectFacility: (id: string) => void
              selectedFacility: string | null
            }
          }).__hatch
          const lanes = g.hallNav.metrics().filter((row) => row.kind === 'security_lane')
          const lane = [...lanes].sort((a, b) => b.queueLength - a.queueLength)[0]
          if (!lane) return ''
          g.selectFacility(lane.id)
          return `${lane.id} live=${g.hallNav.live} q=${lane.queueLength} served=${lane.served} sel=${g.selectedFacility}`
        })
        console.log('security lane', laneId)
        await page.getByTestId('building-panel').waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {})
        const queue = page.getByTestId('building-section-queue')
        if (await queue.count()) await queue.click()
        const bays = page.getByTestId('building-section-bays')
        if (await bays.count()) await bays.click()
        const noteBefore = await readTexts(page)
        rmSync(join(WORK, 'inspector-security'), { recursive: true, force: true })
        log.inspectorSecurityStep = await shoot(page, join(WORK, 'inspector-security'), LIVE_FRAMES)
        const noteAfter = await readTexts(page)
        log.inspectorSecurity = {
          point: sec,
          before: noteBefore,
          after: noteAfter,
          frames: LIVE_FRAMES,
          step: DT,
          changed: noteBefore.note !== noteAfter.note || noteBefore.queue !== noteAfter.queue || noteBefore.bays !== noteAfter.bays,
        }
        console.log('inspector-security', JSON.stringify(log.inspectorSecurity))
        }
      }

      const clips = [
        ['goals', 'goals-phone-relations-framestep-12fps.mp4'],
        ['timetable', 'timetable-airfield-framestep-12fps.mp4'],
      ] as const
      for (const [dir, name] of clips) {
        if (only === 'flight' || only === 'security') continue
        const file = join(OUT, name)
        await encode(join(WORK, dir), file)
        copyFileSync(file, join(ART, name))
      }
      if (offer && flight && only !== 'flight') {
        const file = join(OUT, 'flight-offer-framestep-12fps.mp4')
        await encode(join(WORK, 'flight-offer'), file)
        copyFileSync(file, join(ART, 'flight-offer-framestep-12fps.mp4'))
      }
      if (flight) {
        const liveDir = join(WORK, 'inspector-live')
        rmSync(liveDir, { recursive: true, force: true })
        mkdirSync(liveDir, { recursive: true })
        let n = 0
        const parts =
          only === 'flight' ? ['inspector-flight'] : only === 'security' ? ['inspector-security'] : ['inspector-flight', 'inspector-security']
        for (const part of parts) {
          const names = readdirSync(join(WORK, part)).filter((name) => name.endsWith('.png')).sort()
          for (const name of names) {
            copyFileSync(join(WORK, part, name), join(liveDir, `frame-${String(n).padStart(3, '0')}.png`))
            n += 1
          }
        }
        const liveFile = join(OUT, 'inspector-live-framestep-12fps.mp4')
        await encode(liveDir, liveFile)
        copyFileSync(liveFile, join(ART, 'inspector-live-framestep-12fps.mp4'))
      }
      writeFileSync(join(OUT, 'overlap.json'), `${JSON.stringify(log, null, 2)}\n`)
      copyFileSync(join(OUT, 'overlap.json'), join(ART, 'ui-followup-overlap.json'))
      console.log(JSON.stringify(log, null, 2))
      await page.close()
    } finally {
      await browser.close()
    }
  } finally {
    if (server.pid) process.kill(-server.pid, 'SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
