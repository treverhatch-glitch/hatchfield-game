import { appendFileSync, existsSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium, type Page } from 'playwright'
import { HUD_VIEWPORTS } from './regions.ts'

const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME,
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
].filter((path): path is string => Boolean(path))

type Box = { id: string; x: number; y: number; w: number; h: number }

/** Every HUD panel that owns screen space. Nested pairs (the phone inside the dock) are skipped. */
const PANELS: Record<string, string> = {
  top: '[data-testid="stats-bar"]',
  strip: '[data-testid="info-strip"]',
  'info-views': '[data-testid="info-view-bar"]',
  boards: '[data-testid="tab-boards"]',
  photo: '[data-testid="photo-mode"]',
  follow: '[data-testid="follow-cam"]',
  'hall-peeks': '[data-testid="hall-peeks"]',
  coach: '[data-testid="coach"]',
  hints: '[data-testid="hint-panel"]',
  dock: '[data-testid="left-dock"]',
  build: '[data-hud-panel="build"]',
  'build-tray': '.hud .build-tray',
  alerts: '.hud .alert-dock',
  inspector: '.hud .chrome.has-panel .panel-rollout',
  'flight-card': '.hud .flight-card',
  'assign-panel': '.hud .assign-panel',
  'inspector-queue': '[data-testid="inspector-queue"]',
  timetable: '.tt-root[data-open="1"] .tt-dock',
  interior: '[data-testid="interior-bar"]',
  'hall-caption': '.hall-chrome',
  'kit-bar': '.kit-bar',
  'hall-sheet': '[data-testid="hall-build"]',
  'guest-card': '.guest-card',
  debug: '[data-testid="debug-hud"]',
  'playtest-year': '[data-testid="playtest-year-report"]',
  toasts: '.feedback-toasts',
  banner: '[data-testid="celebration-banner"]',
}

type HatchProbe = {
  presentNegotiation: (id: string) => void
  openNegotiationPanel: () => void
  showStarterKit: () => boolean
  alerts: { raise: (input: { key: string; severity: string; title: string; detail: string }, now: number) => unknown }
  clock: number
  emit?: () => void
}

describe('HUD regions in the browser', () => {
  it('keeps every HUD panel apart at 1280×800 and 1920×1080', async () => {
    const port = 46121
    const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      await waitForVite(vite)
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
      }
      const chromePath = CHROME_PATHS.find((p) => existsSync(p))
      if (chromePath) launchOptions.executablePath = chromePath
      const browser = await chromium.launch(launchOptions)
      try {
        for (const viewport of HUD_VIEWPORTS) {
          const at = `${viewport.width}x${viewport.height}`
          const page = await browser.newPage({ viewport })
          await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
          await page.evaluate(() => localStorage.clear())
          await page.reload({ waitUntil: 'networkidle' })
          await page.getByTestId('sandbox-toggle').uncheck()
          await page.getByTestId('new-game').click()
          await page.getByTestId('start-pax').click()
          await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: HatchProbe }).__hatch))
          await page.getByTestId('starter-kit-coach').click()
          await page.waitForFunction(() => !(window as unknown as { __hatch: HatchProbe }).__hatch.showStarterKit())

          // An offer on the phone and a critical alert top right, both at once.
          await page.evaluate(() => {
            const g = (window as unknown as { __hatch: HatchProbe }).__hatch
            g.presentNegotiation('harbor')
            g.openNegotiationPanel()
            g.alerts.raise({ key: 'layout-probe', severity: 'critical', title: 'Probe alert', detail: 'Layout check' }, g.clock)
          })
          await openPhoneMessages(page)
          await page.getByTestId('phone-card-negotiation').waitFor({ state: 'visible' })
          await page.locator('.hud .alert-dock').first().waitFor({ state: 'visible' })
          await expectApart(page, `${at} apron + phone + alert`)

          // An open build menu stays in the centre column.
          await page.getByTestId('build-airfield').click()
          await page.locator('.hud .build-tray').waitFor({ state: 'visible' })
          await expectApart(page, `${at} build menu open`)
          await page.getByTestId('build-airfield').click()

          // A manage panel takes the inspector slot. The Economy items must take the click (#43).
          await page.getByTestId('menu-money').click()
          await page.getByTestId('submenu-money').waitFor({ state: 'visible' })
          await expectApart(page, `${at} economy menu open`)
          const onTop = await page.evaluate(() => {
            const r = document.querySelector('[data-testid="tab-overview"]')!.getBoundingClientRect()
            return (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null)?.dataset.testid
          })
          expect(onTop, `Economy item takes the click at ${at}`).toBe('tab-overview')
          await page.getByTestId('tab-overview').click()
          await page.locator('.hud .chrome.has-panel .panel-rollout').waitFor({ state: 'visible' })
          await expectApart(page, `${at} inspector open`)

          // The timetable tab opens the sheet above the build bar.
          await page.getByTestId('dock-tab-timetable').click()
          await page.locator('.tt-root[data-open="1"] .tt-dock').waitFor({ state: 'visible' })
          await expectApart(page, `${at} timetable open`)
          await page.getByTestId('dock-tab-phone').click()

          // Terminal: the build menu is centred and clear of the dock and the top band.
          await page.getByTestId('view-terminal').click()
          await page.getByTestId('interior-bar').waitFor({ state: 'visible' })
          const boxes = await expectApart(page, `${at} terminal`)
          const menu = boxes.find((item) => item.id === 'interior')!
          expect(Math.abs(menu.x + menu.w / 2 - viewport.width / 2), `interior bar centre at ${at}`).toBeLessThan(4)

          // Notices raised in the hall (a toast and a signing banner) sit under the build menu.
          await page.evaluate(() => {
            const layer = document.querySelector('[data-testid="feedback-layer"]')!
            const toasts = document.createElement('div')
            toasts.className = 'feedback-toasts layout-probe'
            toasts.innerHTML = '<div class="feedback-toast">Probe toast · +$1,200</div>'
            const banner = document.createElement('div')
            banner.className = 'feedback-banner layout-probe'
            banner.dataset.testid = 'celebration-banner'
            banner.innerHTML = '<strong>Contract signed</strong><p>Probe Air joins the field.</p>'
            layer.append(toasts, banner)
          })
          await expectApart(page, `${at} terminal + notices`)
          await page.evaluate(() => document.querySelectorAll('.layout-probe').forEach((el) => el.remove()))
          await page.close()
        }
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 300_000)
})

async function openPhoneMessages(page: Page) {
  await page.getByTestId('dock-tab-phone').click()
  const peek = page.getByTestId('phone-peek')
  if (await peek.count()) await peek.click()
  const messages = page.getByTestId('phone-tab-messages')
  if ((await messages.getAttribute('aria-selected')) !== 'true') await messages.click()
  if (await page.getByTestId('phone-tab-shut').count()) await messages.click()
}

async function expectApart(page: Page, label: string): Promise<Box[]> {
  const found = await page.evaluate((panels) => {
    const out: { id: string; x: number; y: number; w: number; h: number; path: string[] }[] = []
    const seen = new Map<Element, string>()
    for (const [id, selector] of Object.entries(panels)) {
      for (const el of document.querySelectorAll(selector)) {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue
        seen.set(el, id)
        out.push({ id, x: r.x, y: r.y, w: r.width, h: r.height, path: [] })
        break
      }
    }
    for (const item of out) {
      const el = [...seen].find(([, id]) => id === item.id)![0]
      for (const [other, id] of seen) if (other !== el && other.contains(el)) item.path.push(id)
    }
    return out
  }, PANELS)
  const hits: string[] = []
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const a = found[i]
      const b = found[j]
      if (a.path.includes(b.id) || b.path.includes(a.id)) continue
      if (overlaps(a, b)) hits.push(`${a.id} × ${b.id}`)
    }
  }
  if (process.env.HUD_REGIONS_DEBUG) {
    appendFileSync(process.env.HUD_REGIONS_DEBUG, `${label} ${JSON.stringify(found.map(({ path: _p, ...box }) => box))}\n`)
  }
  expect(hits, `overlapping HUD panels at ${label}`).toEqual([])
  return found
}

function overlaps(a: Box, b: Box): boolean {
  const e = 0.5
  return a.x + e < b.x + b.w && b.x + e < a.x + a.w && a.y + e < b.y + b.h && b.y + e < a.y + a.h
}

function waitForVite(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start')), 40_000)
    const onData = (chunk: Buffer) => {
      const text = chunk.toString()
      if (text.includes('Local:') || text.includes('ready in')) {
        clearTimeout(timer)
        resolve()
      }
    }
    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)
    proc.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`vite exited ${code}`))
    })
  })
}
