/**
 * Playwright smoke: load the production build and play the opening with real clicks.
 * Targets about five minutes of sim time (300s on the field clock) after the kit.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import type { BrowserReport, CouldNot, SlowTick } from '../src/playtest/types.ts'

const PORT = 45991
const FIVE_MINUTES = 300
const WALL_CAP_MS = 90_000
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => existsSync(path))

const LANDED = ['landing', 'taxi_in', 'deboard', 'servicing', 'board', 'pushback', 'taxi_out', 'takeoff', 'parked', 'gone']

interface Snap {
  clock: number
  day: number
  cash: number
  speed: number
  flights: number
  guests: number
  happiness: number | null
  fieldRating: number
  landed: { phase: string; no: string } | null
  stuck: { id: string; detail: string }[]
  slow: SlowTick[]
}

export async function runSmoke(outDir: string): Promise<BrowserReport> {
  const started = performance.now()
  const script: string[] = []
  const screenshots: string[] = []
  const consoleErrors: string[] = []
  const couldNot: CouldNot[] = []
  const notes: string[] = []
  const softlocks: string[] = []
  mkdirSync(outDir, { recursive: true })

  if (!CHROME) {
    return blank(started, 'No Chrome binary found for Playwright.', true)
  }
  if (!existsSync('dist/index.html')) {
    return blank(started, 'dist/index.html is missing — the smoke test loads the production build.', true)
  }

  let server: ChildProcess | null = null
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    server = spawn(
      'npx',
      ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
      { stdio: 'ignore', detached: true },
    )
    const url = `http://127.0.0.1:${PORT}/?playtest=1`
    await waitForUrl(url)
    script.push(`open ${url}`)

    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`console: ${message.text().slice(0, 300)}`)
    })

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate('localStorage.clear(); sessionStorage.clear()')
    await page.reload({ waitUntil: 'networkidle' })
    await shot(page, outDir, screenshots, '01-title')

    const sandbox = page.getByTestId('sandbox-toggle')
    if (await sandbox.isChecked().catch(() => false)) {
      await sandbox.uncheck()
      notes.push('Turned sandbox off so the run uses standard cash.')
    }
    script.push('sandbox off')

    await page.getByTestId('new-game').click()
    script.push('new game')
    await page.getByTestId('start-pax').waitFor({ state: 'visible', timeout: 8000 })
    await shot(page, outDir, screenshots, '02-route')
    await page.getByTestId('start-pax').click()
    script.push('passenger start')
    // The new-game card stamps the kit. The coach no longer offers starter-kit-coach.
    await page.waitForFunction(
      () => {
        const hatch = (window as unknown as { __hatch?: { showStarterKit?: () => boolean } }).__hatch
        return Boolean(hatch) && hatch.showStarterKit?.() === false
      },
      { timeout: 8000 },
    )
    await page.getByTestId('coach').waitFor({ state: 'visible', timeout: 8000 })
    notes.push('Starter kit stamped by the new-game card. The coach no longer shows starter-kit-coach.')
    script.push('starter kit stamped by the new-game card')
    await shot(page, outDir, screenshots, '03-field')
    await page.waitForTimeout(600)
    await shot(page, outDir, screenshots, '04-kit')

    const letter = page.getByTestId('contract-letter')
    const preview = page.getByTestId('phone-preview')
    const deadline = Date.now() + 20_000
    let letterShown = false
    let previewShown = false
    while (Date.now() < deadline && !(letterShown && previewShown)) {
      if (!letterShown) letterShown = await letter.isVisible().catch(() => false)
      if (!previewShown) previewShown = await preview.isVisible().catch(() => false)
      if (letterShown && previewShown) break
      await page.waitForTimeout(200)
    }
    if (previewShown) script.push('phone preview flashed')
    if (!letterShown || !previewShown) {
      couldNot.push({
        command: 'acceptContract',
        detail: `contract letter within 20s: stack ${letterShown ? 'yes' : 'no'}, phone preview ${previewShown ? 'yes' : 'no'}`,
        count: 1,
      })
    }
    if (letterShown) {
      await letter.locator('.letter-tab').click()
      script.push('open contract letter')
      await shot(page, outDir, screenshots, '05-contract')
      const accept = page.getByTestId('contract-accept')
      if (await accept.isVisible().catch(() => false)) {
        await accept.click()
        script.push('accept contract')
      } else {
        couldNot.push({ command: 'acceptContract', detail: 'Accept button was not visible', count: 1 })
      }
      await page.waitForTimeout(400)
      await shot(page, outDir, screenshots, '06-accepted')
    } else {
      const peek = page.getByTestId('phone-peek')
      if (await peek.isVisible().catch(() => false)) {
        await peek.click()
        script.push('open phone')
      }
      const card = page.getByTestId('phone-card-contract')
      const onPhone = await card.waitFor({ state: 'visible', timeout: 12_000 }).then(() => true).catch(() => false)
      if (!onPhone) {
        couldNot.push({ command: 'acceptContract', detail: 'contract letter did not appear on the stack or the phone', count: 1 })
        await shot(page, outDir, screenshots, '05-contract')
      } else {
        script.push('contract letter on the phone')
        await shot(page, outDir, screenshots, '05-contract')
        const sign = page.getByTestId('phone-action-contract-sign')
        if (await sign.isVisible().catch(() => false)) {
          await sign.click()
          script.push('sign contract on the phone')
        } else {
          couldNot.push({ command: 'acceptContract', detail: 'Phone contract card had no Sign button', count: 1 })
        }
        await page.waitForTimeout(400)
        await shot(page, outDir, screenshots, '06-accepted')
        const shut = page.getByTestId('phone-close')
        if (await shut.isVisible().catch(() => false)) await shut.click()
      }
    }

    const backToApron = async () => {
      const apron = page.getByTestId('view-airport')
      if (await apron.isVisible().catch(() => false)) await apron.click({ timeout: 3000 })
    }

    await backToApron()
    const pavement = page.getByRole('button', { name: 'Pavement' })
    if (await pavement.isVisible().catch(() => false)) {
      await pavement.click({ timeout: 4000 })
      script.push('open pavement tray')
      const taxi = page.getByRole('button', { name: /Taxiway/ })
      if (await taxi.isVisible().catch(() => false)) {
        await taxi.click({ timeout: 4000 })
        script.push('select taxiway')
        const canvas = page.locator('canvas').first()
        const box = await canvas.boundingBox()
        if (box) {
          await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.55)
          script.push('click the field')
        }
      } else {
        couldNot.push({ command: 'stamp', detail: 'Taxiway was not in the build tray', count: 1 })
      }
    } else {
      couldNot.push({ command: 'stamp', detail: 'Pavement tray was not on the apron', count: 1 })
    }

    await backToApron()
    const servicesMenu = page.getByTestId('menu-operations')
    if (await servicesMenu.isVisible().catch(() => false)) {
      await servicesMenu.click({ timeout: 4000 })
      script.push('operations menu')
    }
    const services = page.getByTestId('tab-services')
    if (await services.isVisible().catch(() => false)) {
      await services.click({ timeout: 4000 })
      script.push('services tab')
      await page.waitForTimeout(300)
      for (const name of ['Hall food', 'Souvenirs']) {
        const button = page.getByRole('button', { name: new RegExp(name) })
        if (await button.first().isVisible().catch(() => false)) {
          await button.first().click({ timeout: 4000 })
          script.push(`furnish ${name}`)
        } else {
          couldNot.push({
            command: 'buyRoom',
            detail: `${name} was not on the services panel (no hall selected)`,
            count: 1,
          })
        }
      }
    } else {
      couldNot.push({ command: 'buyRoom', detail: 'Services tab was not on screen', count: 1 })
    }
    await shot(page, outDir, screenshots, '07-services')

    await page.getByTestId('view-terminal').click({ timeout: 4000 }).catch(() => {})
    script.push('terminal view')
    await page.waitForTimeout(400)
    await shot(page, outDir, screenshots, '07b-hall')
    await backToApron()

    const fast = page.locator('.stat-speeds button', { hasText: '5x' })
    if (await fast.isVisible().catch(() => false)) {
      await fast.click({ timeout: 4000 })
      script.push('5x')
    } else {
      couldNot.push({ command: 'setSpeed', detail: '5x button was not visible', count: 1 })
    }
    await page.evaluate(`(() => {
      const hatch = window.__hatch
      if (!hatch || hatch.__playtestPatched) return
      const orig = hatch.tick.bind(hatch)
      hatch.__playtestSlow = []
      hatch.tick = (dt) => {
        const t = performance.now()
        orig(dt)
        const ms = performance.now() - t
        const row = {
          ms: Math.round(ms * 10) / 10,
          day: hatch.gameDay(),
          clock: Math.round(hatch.clock * 10) / 10,
          flights: hatch.flights.length,
          guests: hatch.hallGuests.length,
        }
        const slow = hatch.__playtestSlow || []
        slow.push(row)
        slow.sort((a, b) => b.ms - a.ms)
        hatch.__playtestSlow = slow.slice(0, 8)
      }
      hatch.__playtestPatched = true
    })()`)

    const curve: BrowserReport['cashCurve'] = []
    const satisfaction: BrowserReport['satisfaction'] = []
    let landingSec: number | null = null
    let lastClock = 0
    let flatPolls = 0
    const seenStuck = new Map<string, string>()
    const cleared = new Set<string>()
    const waitStart = Date.now()
    while (Date.now() - waitStart < WALL_CAP_MS) {
      const snap = await readSnap(page)
      if (!snap) {
        couldNot.push({ command: 'probe', detail: 'window.__hatch was missing', count: 1 })
        break
      }
      const previousClock = lastClock
      lastClock = snap.clock
      if (!curve.some((point) => point.day === snap.day)) {
        curve.push({ day: snap.day, cash: Math.round(snap.cash) })
        satisfaction.push({
          day: snap.day,
          guests: snap.guests,
          avg: snap.happiness == null ? null : Math.round(snap.happiness * 10) / 10,
          fieldRating: snap.fieldRating,
        })
      }
      if (landingSec == null && snap.landed) landingSec = Math.round(snap.clock * 10) / 10
      const live = new Set(snap.stuck.map((row) => row.id))
      for (const row of snap.stuck) seenStuck.set(row.id, row.detail)
      for (const id of seenStuck.keys()) if (!live.has(id)) cleared.add(id)
      if (previousClock > 0 && snap.speed >= 5 && snap.clock - previousClock < 0.5) flatPolls += 1
      else flatPolls = 0
      if (snap.clock >= FIVE_MINUTES) break
      await page.waitForTimeout(1500)
    }
    if (flatPolls >= 6) softlocks.push('Clock barely moved across several polls while 5× was selected.')
    if (lastClock < FIVE_MINUTES) {
      notes.push(`Sim clock reached ${Math.round(lastClock)}s before the 90s wall cap (target ${FIVE_MINUTES}s).`)
    }
    await shot(page, outDir, screenshots, '08-five-minutes')
    const end = await readSnap(page)
    const withGuests = satisfaction.filter((point) => point.avg != null)
    return {
      ok: consoleErrors.length === 0 && softlocks.length === 0,
      skipped: false,
      reason: landingSec == null ? 'Opening played. No landing in the scripted window.' : 'Opening played through the first landing.',
      wallMs: Math.round(performance.now() - started),
      script,
      screenshots,
      timeToFirstLandingSec: landingSec,
      cashCurve: curve,
      stuck: [...seenStuck.entries()].filter(([id]) => !cleared.has(id)).map(([id, detail]) => ({ id, detail })),
      recovered: [...cleared],
      consoleErrors,
      softlocks,
      satisfaction,
      satisfactionAvg: withGuests.length
        ? Math.round((withGuests.reduce((sum, point) => sum + (point.avg ?? 0), 0) / withGuests.length) * 10) / 10
        : null,
      slowestTicks: end?.slow ?? [],
      couldNot,
      clockEnd: end?.clock ?? lastClock,
      cashEnd: end?.cash ?? null,
      notes,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    consoleErrors.push(reason)
    return {
      ...blank(started, reason, false),
      script,
      screenshots,
      consoleErrors,
      couldNot,
      notes,
      softlocks,
    }
  } finally {
    await browser?.close().catch(() => {})
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM')
      } catch {
        server.kill('SIGTERM')
      }
    }
  }
}

function blank(started: number, reason: string, skipped: boolean): BrowserReport {
  return {
    ok: false,
    skipped,
    reason,
    wallMs: Math.round(performance.now() - started),
    script: [],
    screenshots: [],
    timeToFirstLandingSec: null,
    cashCurve: [],
    stuck: [],
    recovered: [],
    consoleErrors: [],
    softlocks: [],
    satisfaction: [],
    satisfactionAvg: null,
    slowestTicks: [],
    couldNot: [],
    clockEnd: 0,
    cashEnd: null,
    notes: [],
  }
}

async function shot(page: Page, outDir: string, screenshots: string[], name: string) {
  const path = join(outDir, `${name}.png`)
  await page.screenshot({ path })
  screenshots.push(join('docs/playtest/bots/smoke', `${name}.png`))
}

async function readSnap(page: Page): Promise<Snap | null> {
  return page.evaluate(`(() => {
      const landedPhases = ${JSON.stringify(LANDED)}
      const hatch = window.__hatch
      if (!hatch) return null
      const guests = hatch.hallGuests.filter((guest) => !guest.preview)
      const happiness = guests.length
        ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guests.length
        : null
      const flight = hatch.flights.find((row) => landedPhases.includes(row.phase))
      const stuck = (hatch.alerts.active || [])
        .filter((alert) => String(alert.key).startsWith('cond:stuck'))
        .map((alert) => ({ id: alert.key, detail: alert.title }))
      return {
        clock: hatch.clock,
        day: hatch.gameDay(),
        cash: hatch.cash,
        speed: hatch.speed,
        flights: hatch.flights.length,
        guests: guests.length,
        happiness,
        fieldRating: hatch.fieldRating(),
        landed: flight ? { phase: flight.phase, no: flight.flightNo } : null,
        stuck,
        slow: hatch.__playtestSlow || [],
      }
    })()`) as Promise<Snap | null>
}

async function waitForUrl(url: string) {
  const deadline = Date.now() + 30_000
  let last = 'preview did not answer'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      last = `HTTP ${response.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(last)
}
