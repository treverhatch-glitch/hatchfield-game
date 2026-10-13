/** Before/after stills and a flight clip for the aircraft model slice. */
import { chromium, type Page } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = 'docs/devlog/media'
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome'
const mode = process.argv[2] || 'before'
const args = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
]

const SHOW = [
  { id: 'pc12', kind: 'air_ambulance', craft: 'jet', name: 'Pilatus PC-12' },
  { id: 'atr72', kind: 'regional', craft: 'jet', name: 'ATR 72-600' },
  { id: 'crj700', kind: 'regional', craft: 'jet', name: 'CRJ-700' },
  { id: 'b738', kind: 'narrowbody', craft: 'jet', name: 'Boeing 737-800' },
  { id: 'a321', kind: 'narrowbody', craft: 'jet', name: 'Airbus A321' },
  { id: 'b789', kind: 'widebody', craft: 'jet', name: 'Boeing 787-9' },
  { id: 'a380', kind: 'widebody', craft: 'jet', name: 'Airbus A380-800' },
  { id: 'b748f', kind: 'freighter', craft: 'jet', name: 'Boeing 747-8F' },
  { id: 'c130', kind: 'military', craft: 'jet', name: 'Lockheed C-130H' },
  { id: 'f15', kind: 'military', craft: 'jet', name: 'F-15C' },
  { id: 'cl415', kind: 'air_ambulance', craft: 'jet', name: 'CL-415' },
  { id: 'aw139', kind: 'helo_med', craft: 'helo', name: 'AW139' },
]

function findWorld(aim: { dist: number | null; c: number | null; r: number | null }) {
  const dist = aim.dist
  const c = aim.c
  const r = aim.r
  const canvas = document.querySelector('canvas.field')
  if (!canvas) return null
  const key = Object.keys(canvas).find((k) => k.startsWith('__reactFiber'))
  let fiber = key ? (canvas as any)[key] : null
  const seen = new Set()
  while (fiber && !seen.has(fiber)) {
    seen.add(fiber)
    let hook = (fiber as { memoizedState?: unknown }).memoizedState
    while (hook) {
      const ref = (hook as { memoizedState?: { current?: unknown } }).memoizedState
      const world = ref && (ref as { current?: unknown }).current
      const cam = world as { pivot?: { set: (x: number, y: number, z: number) => void }; dist?: number; placeCam?: () => void } | null
      if (cam && cam.pivot && cam.placeCam) {
        if (c != null && r != null) {
          const SIZE = 32
          const CELL = 6.2
          cam.pivot.set((c - (SIZE - 1) / 2) * CELL, 0, (r - (SIZE - 1) / 2) * CELL)
        }
        if (dist != null) cam.dist = dist
        cam.placeCam()
        return true
      }
      hook = (hook as { next?: unknown }).next
    }
    fiber = (fiber as { return?: unknown }).return
  }
  return false
}

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('tab-economy').click()
  await page.getByTestId('starter-kit').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
}

async function acceptLetter(page: Page) {
  await page.getByRole('button', { name: '5x' }).first().click()
  const letter = page.getByTestId('contract-letter')
  await letter.waitFor({ timeout: 25000 })
  await letter.getByRole('button').first().click()
  await page.getByRole('button', { name: 'Accept' }).click()
}

async function hideUi(page: Page) {
  await page.evaluate(() => {
    const hud = document.querySelector('.hud') as HTMLElement | null
    if (hud) hud.style.display = 'none'
    document.querySelectorAll('.inspect-card').forEach((el) => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

async function frameFlight(page: Page, dist: number) {
  return page.evaluate((cameraDist) => {
    const g = (window as unknown as { __hatch?: { flights: { phase: string; x: number; y: number; z: number; airframeName: string }[] } }).__hatch
    const flight = g?.flights.find((f) => f.phase !== 'gone')
    if (!flight) return { ok: false }
    const canvas = document.querySelector('canvas.field')
    if (!canvas) return { ok: false, phase: flight.phase }
    const key = Object.keys(canvas).find((k) => k.startsWith('__reactFiber'))
    let fiber = key ? (canvas as any)[key] : null
    const seen = new Set()
    while (fiber && !seen.has(fiber)) {
      seen.add(fiber)
      let hook = (fiber as { memoizedState?: unknown }).memoizedState
      while (hook) {
        const ref = (hook as { memoizedState?: { current?: unknown } }).memoizedState
        const world = ref && (ref as { current?: { pivot?: { set: Function }; dist?: number; placeCam?: Function } }).current
        if (world && world.pivot && world.placeCam) {
          const SIZE = 32
          const CELL = 6.2
          world.pivot.set((flight.x - (SIZE - 1) / 2) * CELL, 0, (flight.y - (SIZE - 1) / 2) * CELL)
          world.dist = cameraDist
          world.placeCam()
          return { ok: true, phase: flight.phase, name: flight.airframeName, z: flight.z }
        }
        hook = (hook as { next?: unknown }).next
      }
      fiber = (fiber as { return?: unknown }).return
    }
    return { ok: false, phase: flight.phase }
  }, dist)
}

async function fps(page: Page, ms = 2500) {
  return page.evaluate(
    new Function(
      'budget',
      `return new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const step = (now) => {
          frames += 1
          if (now - start < budget) requestAnimationFrame(step)
          else resolve({ fps: Math.round((frames * 1000) / (now - start)), frames })
        }
        requestAnimationFrame(step)
      })`,
    ) as (budget: number) => Promise<{ fps: number; frames: number }>,
    ms,
  )
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })

if (mode === 'before') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  await boot(page)
  await acceptLetter(page)
  const start = Date.now()
  let framed = false
  while (Date.now() - start < 40000) {
    const info = await frameFlight(page, 42)
    if (info.ok) {
      framed = true
      console.log('before frame', info)
      break
    }
    await page.waitForTimeout(300)
  }
  await hideUi(page)
  await page.waitForTimeout(500)
  console.log('before fps', await fps(page))
  await page.screenshot({ path: `${OUT}/MODELS-before.png` })
  console.log('wrote MODELS-before.png', framed)
} else if (mode === 'after') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  await boot(page)
  await acceptLetter(page)
  const start = Date.now()
  while (Date.now() - start < 40000) {
    const info = await frameFlight(page, 48)
    if (info.ok) break
    await page.waitForTimeout(300)
  }
  await hideUi(page)
  const parked = await page.evaluate((show) => {
    const g = (window as unknown as { __hatch?: { speed: number; flights: any[] } }).__hatch
    if (!g || !g.flights.length) return { ok: false }
    g.speed = 0
    const template = JSON.parse(JSON.stringify(g.flights.find((f) => f.phase !== 'gone') ?? g.flights[0]))
    g.flights = show.map((craft, i) => {
      const copy = JSON.parse(JSON.stringify(template))
      copy.id = `show-${craft.id}`
      copy.airframeId = craft.id
      copy.airframeName = craft.name
      copy.kind = craft.kind
      copy.craft = craft.craft
      copy.phase = 'parked'
      copy.x = 10 + (i % 6) * 3.6
      copy.y = 13 + Math.floor(i / 6) * 4.4
      copy.z = 0.12
      copy.heading = Math.PI / 2
      copy.cargo = craft.kind === 'freighter'
      return copy
    })
    return { ok: true, n: g.flights.length }
  }, SHOW)
  console.log('lineup', parked)
  await page.evaluate(findWorld, { dist: 52, c: 10 + 2.5 * 3.6, r: 15 })
  await page.waitForTimeout(600)
  console.log('after close fps', await fps(page, 3000))
  await page.screenshot({ path: `${OUT}/MODELS-after.png` })
  await page.evaluate(findWorld, { dist: 34, c: 10 + 1 * 3.6, r: 13 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/MODELS-after-close.png` })
  await page.evaluate(findWorld, { dist: 140, c: 10 + 2.5 * 3.6, r: 15 })
  await page.waitForTimeout(500)
  console.log('after far fps', await fps(page, 3000))
  await page.screenshot({ path: `${OUT}/MODELS-after-far.png` })
} else if (mode === 'flight') {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/models-flight', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  const pageOpened = Date.now()
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('console', msg.text())
  })
  await boot(page)
  await acceptLetter(page)
  await hideUi(page)
  console.log('ui hidden at ms', Date.now() - pageOpened)
  const started = Date.now()
  let sawTaxi = false
  let sawLand = false
  let sawDepart = false
  let sampled = false
  while (Date.now() - started < 90000) {
    const info = await page.evaluate(() => {
      const g = (window as unknown as { __hatch?: { flights: { phase: string; x: number; y: number; z: number; airframeName: string }[]; flightsDone: number } }).__hatch
      const flight = g?.flights.find((f) => f.phase !== 'gone')
      const canvas = document.querySelector('canvas.field')
      if (!canvas || !flight) return { ok: false, done: g?.flightsDone ?? 0 }
      const key = Object.keys(canvas).find((k) => k.startsWith('__reactFiber'))
      let fiber = key ? (canvas as any)[key] : null
      const seen = new Set()
      while (fiber && !seen.has(fiber)) {
        seen.add(fiber)
        let hook = (fiber as { memoizedState?: unknown }).memoizedState
        while (hook) {
          const ref = (hook as { memoizedState?: { current?: unknown } }).memoizedState
          const world = ref && (ref as { current?: { pivot?: { set: Function }; dist?: number; placeCam?: Function } }).current
          if (world && world.pivot && world.placeCam) {
            const SIZE = 32
            const CELL = 6.2
            world.pivot.set((flight.x - (SIZE - 1) / 2) * CELL, 0, (flight.y - (SIZE - 1) / 2) * CELL)
            const airborne = flight.phase === 'approach' || flight.phase === 'takeoff' || flight.phase === 'hold'
            world.dist = airborne ? 58 : 40
            world.placeCam()
            break
          }
          hook = (hook as { next?: unknown }).next
        }
        fiber = (fiber as { return?: unknown }).return
      }
      return { ok: true, phase: flight.phase, name: flight.airframeName, z: flight.z, done: g?.flightsDone ?? 0 }
    })
    if (info.ok) {
      if (!sampled) {
        sampled = true
        console.log('flight fps', await fps(page, 2500), info)
      }
      if (info.phase === 'landing' || info.phase === 'approach') sawLand = true
      if (info.phase === 'taxi_in' || info.phase === 'taxi_out' || info.phase === 'parked' || info.phase === 'servicing' || info.phase === 'board' || info.phase === 'pushback') sawTaxi = true
      if (info.phase === 'takeoff') sawDepart = true
    }
    if ((info.done ?? 0) >= 1 && sawDepart) {
      console.log('cycle done', info)
      break
    }
    await page.waitForTimeout(180)
  }
  console.log({ sawTaxi, sawLand, sawDepart, ms: Date.now() - started })
  const video = page.video()
  await context.close()
  if (video) await video.saveAs(`${OUT}/MODELS-flight.webm`)
  console.log('wrote MODELS-flight.webm')
} else if (mode === 'perf') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  await boot(page)
  await acceptLetter(page)
  await hideUi(page)
  const start = Date.now()
  let framed = false
  while (Date.now() - start < 40000) {
    const info = await frameFlight(page, 42)
    if (info.ok) {
      framed = true
      console.log('perf frame', info)
      break
    }
    await page.waitForTimeout(300)
  }
  const sample = async (dist: number) => {
    await frameFlight(page, dist)
    await page.waitForTimeout(400)
    const rate = await fps(page, 3000)
    const info = await page.evaluate((cameraDist) => {
      const canvas = document.querySelector('canvas.field')
      if (!canvas) return null
      const key = Object.keys(canvas).find((k) => k.startsWith('__reactFiber'))
      let fiber = key ? (canvas as any)[key] : null
      const seen = new Set()
      while (fiber && !seen.has(fiber)) {
        seen.add(fiber)
        let hook = (fiber as { memoizedState?: unknown }).memoizedState
        while (hook) {
          const ref = (hook as { memoizedState?: { current?: unknown } }).memoizedState
          const world = ref && (ref as { current?: any }).current
          if (world && world.renderer && world.placeCam) {
            const r = world.renderer.info.render
            return {
              dist: world.dist,
              cameraDist,
              calls: r.calls,
              triangles: r.triangles,
              shadows: world.renderer.shadowMap.enabled,
              dpr: world.renderer.getPixelRatio(),
              speed: (window as any).__hatch?.speed,
              flights: (window as any).__hatch?.flights?.filter((f: { phase: string }) => f.phase !== 'gone').length,
            }
          }
          hook = (hook as { next?: unknown }).next
        }
        fiber = (fiber as { return?: unknown }).return
      }
      return null
    }, dist)
    console.log('perf', dist, rate, info)
  }
  if (!framed) console.log('perf never framed a flight')
  await sample(42)
  await sample(88)
  await sample(140)
}

await browser.close()
console.log('done', mode)
