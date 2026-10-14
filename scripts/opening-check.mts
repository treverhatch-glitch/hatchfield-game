/**
 * Headless opening check on the production build.
 * Title (sandbox off, standard bank) → plot → coach kit → runway refused →
 * kit button gone → first contract Sign on the phone → first landing under 180s at 1× →
 * pause menu has New game.
 *
 * Screenshots land in docs/playtest/opening/.
 * The bot playtest calls runOpeningCheck after the browser smoke.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

/** Same face as catalog `money`, without importing the sim graph into tsx. */
function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function standardBankLabel(): string {
  const source = readFileSync(new URL('../src/game/catalog.ts', import.meta.url), 'utf8')
  const match = source.match(/START_CASH = \{[^}]*standard:\s*([\d_]+)/)
  if (!match) fail('could not read START_CASH.standard from the catalog')
  const cash = Number(match[1].replaceAll('_', ''))
  return `standard ${money(cash)}`
}

const PORT = 45992
const OUT = 'docs/playtest/opening'
const LANDING_LIMIT_SEC = 180
const WALL_CAP_MS = 200_000
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => existsSync(path))

const LANDED = ['landing', 'taxi_in', 'deboard', 'servicing', 'board', 'pushback', 'taxi_out', 'takeoff', 'parked', 'gone']

function fail(message: string): never {
  throw new Error(`opening check: ${message}`)
}

async function shot(page: Page, dir: string, name: string, shots: string[]) {
  const path = join(dir, `${name}.png`)
  await page.screenshot({ path })
  shots.push(path)
}

async function waitForUrl(url: string) {
  const deadline = Date.now() + 30_000
  let last = 'preview did not answer'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      last = `preview answered ${response.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  fail(last)
}

async function readField(page: Page): Promise<{
  clock: number
  speed: number
  news: string
  landed: boolean
  kit: boolean
} | null> {
  return page.evaluate(`(() => {
    const landedPhases = ${JSON.stringify(LANDED)}
    const hatch = window.__hatch
    if (!hatch) return null
    return {
      clock: hatch.clock,
      speed: hatch.speed,
      news: hatch.news[0] ? hatch.news[0].text : '',
      landed: hatch.flights.some((row) => landedPhases.includes(row.phase)),
      kit: typeof hatch.showStarterKit === 'function' ? hatch.showStarterKit() : true,
    }
  })()`) as Promise<{ clock: number; speed: number; news: string; landed: boolean; kit: boolean } | null>
}

export async function runOpeningCheck(outDir = OUT): Promise<string[]> {
  if (!CHROME) fail('No Chrome binary found for Playwright.')
  if (!existsSync('dist/index.html')) fail('dist/index.html is missing — build the game first.')
  mkdirSync(outDir, { recursive: true })
  const shots: string[] = []
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
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate('localStorage.clear(); sessionStorage.clear()')
    await page.reload({ waitUntil: 'networkidle' })

    const standard = standardBankLabel()
    const sandbox = page.getByTestId('sandbox-toggle')
    await sandbox.waitFor({ state: 'visible', timeout: 8000 })
    if (await sandbox.isChecked()) fail('sandbox toggle was on')
    const titleText = await sandbox.locator('xpath=..').innerText()
    if (!titleText.includes(standard)) fail(`title did not show ${standard} (saw: ${titleText})`)
    await shot(page, outDir, '01-title', shots)

    await page.getByTestId('new-game').click()
    await page.getByTestId('new-game-sheet').waitFor({ state: 'visible', timeout: 8000 })
    await shot(page, outDir, '02-plot', shots)
    await page.getByTestId('start-pax').click()

    const coach = page.getByTestId('coach')
    await coach.waitFor({ state: 'visible', timeout: 8000 })
    const kit = coach.getByTestId('starter-kit-coach')
    await kit.waitFor({ state: 'visible', timeout: 4000 })
    const firstStep = coach.locator('ol > li').first()
    if ((await firstStep.getByTestId('starter-kit-coach').count()) !== 1) {
      fail('coach did not offer the starter kit as the first step')
    }
    await shot(page, outDir, '03-coach', shots)

    await page.getByTestId('build-airfield').click()
    await page.getByTestId('tray-runway').click()
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) fail('no canvas to click a runway')
    const spots = [
      [0.55, 0.4],
      [0.7, 0.45],
      [0.48, 0.35],
    ]
    let refused: Awaited<ReturnType<typeof readField>> = null
    for (const [px, py] of spots) {
      await page.mouse.click(box.x + box.width * px, box.y + box.height * py)
      await page.waitForTimeout(250)
      refused = await readField(page)
      if (/would block the starter kit/i.test(refused?.news ?? '')) break
    }
    if (!/would block the starter kit/i.test(refused?.news ?? '')) {
      fail(`runway click was not refused with the kit message (news: ${refused?.news ?? 'none'})`)
    }
    await shot(page, outDir, '04-runway-refused', shots)

    await kit.click()
    await page.waitForTimeout(800)
    if ((await page.getByTestId('starter-kit-coach').count()) !== 0) fail('coach kit button stayed after stamping')
    if ((await page.getByTestId('starter-kit-dock').count()) !== 0) fail('dock kit button stayed after stamping')
    const stamped = await readField(page)
    if (stamped?.kit) fail('showStarterKit stayed true after stamping')
    await shot(page, outDir, '05-kit-stamped', shots)

    // Desktop hides the HUD letter. The same offer is a Messages card; Sign is Accept.
    const offerShown = await page
      .waitForFunction('() => Boolean(window.__hatch && window.__hatch.offer)', { timeout: 30_000 })
      .then(() => true)
      .catch(() => false)
    if (!offerShown) fail('first contract letter did not appear')
    const peek = page.getByTestId('phone-peek')
    await peek.waitFor({ state: 'attached', timeout: 4000 })
    // The dock is slid off the left edge, so a center click misses the visible sliver.
    await peek.evaluate((el) => (el as HTMLButtonElement).click())
    const messageSign = page.getByTestId('phone-action-contract-sign')
    const fileSign = page.getByTestId('phone-action-contract-file-sign')
    const onMessages = await messageSign.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
    const onFile = onMessages
      ? false
      : await fileSign.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
    if (!onMessages && !onFile) {
      await page.getByTestId('phone-tab-messages').click()
      await messageSign.waitFor({ state: 'visible', timeout: 4000 })
    }
    await shot(page, outDir, '06-contract', shots)
    await (onFile ? fileSign : messageSign).click()

    const speed = await readField(page)
    if (speed?.speed !== 1) fail(`clock was not at 1× after accept (speed ${speed?.speed ?? 'missing'})`)

    const waitStart = Date.now()
    let landedAt: number | null = null
    while (Date.now() - waitStart < WALL_CAP_MS) {
      const snap = await readField(page)
      if (!snap) fail('window.__hatch was missing while waiting for the landing')
      if (snap.speed !== 1) fail(`speed left 1× (now ${snap.speed})`)
      if (snap.landed) {
        landedAt = snap.clock
        break
      }
      if (snap.clock >= LANDING_LIMIT_SEC) {
        fail(`no landing before ${LANDING_LIMIT_SEC}s (clock ${snap.clock.toFixed(1)}s)`)
      }
      await page.waitForTimeout(1000)
    }
    if (landedAt == null) fail('landing wait hit the wall clock cap')
    if (landedAt >= LANDING_LIMIT_SEC) fail(`first landing at ${landedAt.toFixed(1)}s, want under ${LANDING_LIMIT_SEC}s`)
    await shot(page, outDir, '07-landing', shots)

    await page.getByTestId('hud-menu').click()
    const pause = page.getByTestId('pause-menu')
    await pause.waitFor({ state: 'visible', timeout: 4000 })
    const newGame = pause.getByRole('button', { name: 'New game' })
    if (!(await newGame.isVisible().catch(() => false))) fail('pause menu has no New game button')
    await shot(page, outDir, '08-pause', shots)

    if (pageErrors.length) fail(`page errors: ${pageErrors.join(' | ')}`)
    console.log(`opening check passed — first landing at ${landedAt.toFixed(1)}s`)
    for (const path of shots) console.log(path)
    return shots
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

const calledDirectly = process.argv[1]?.includes('opening-check')
if (calledDirectly) {
  runOpeningCheck().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
