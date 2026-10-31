import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium, type Page } from 'playwright'
import { findChrome, gameUrl } from '../test/e2e.ts'


const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]

type Box = { id: string; x: number; y: number; w: number; h: number }

type HatchProbe = {
  showStarterKit: () => boolean
  fieldLevel: () => number
  toggleInfo: (id: string) => void
}

describe('HUD top band layout', () => {
  it('keeps the info-view chips and overlays off the top bar after the kit is stamped', async () => {
    const port = 46118
    const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      await waitForVite(vite)
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
      }
      const chromePath = findChrome()
      if (chromePath) {
        launchOptions.executablePath = chromePath
      }
      const browser = await chromium.launch(launchOptions)
      try {
        for (const viewport of VIEWPORTS) {
          const page = await browser.newPage({ viewport })
          await page.goto(gameUrl(port), { waitUntil: 'domcontentloaded', timeout: 90_000 })
          await page.evaluate(() => localStorage.clear())
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
          await page.getByTestId('sandbox-toggle').uncheck()
          await page.getByTestId('new-game').click()
          await page.getByTestId('start-pax').click()
          await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: HatchProbe }).__hatch))

          // The plot is empty until the coach kit is stamped. Layout checks run after that stamp.
          await page.getByTestId('starter-kit-coach').click()
          await page.waitForFunction(
            () => !(window as unknown as { __hatch: HatchProbe }).__hatch.showStarterKit(),
          )
          expect(await page.getByTestId('starter-kit-coach').count()).toBe(0)
          expect(await page.getByTestId('starter-kit-dock').count()).toBe(0)
          await page.getByTestId('coach').waitFor({ state: 'visible' })
          await expectNoOverlap(page, ['coach', 'photo-mode', 'info-strip', 'menu-money'], viewport)

          // One info bar: five map pills and More. Connections shows from Field Lv 3.
          await page.evaluate(() => {
            const g = (window as unknown as { __hatch: HatchProbe }).__hatch
            g.fieldLevel = () => 3
          })
          await page.getByTestId('info-view-bar').waitFor({ state: 'visible' })
          const pillIds = await page
            .locator('[data-testid^="info-view-"]')
            .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''))
          expect(pillIds).toEqual(
            expect.arrayContaining([
              'info-view-traffic',
              'info-view-queues',
              'info-view-bays',
              'info-view-power',
              'info-view-fuel',
              'info-view-more',
            ]),
          )
          expect(await page.locator('[data-testid^="info-hotspot-"]').count()).toBe(0)
          await page.getByTestId('info-view-more').click()
          await page.getByTestId('info-menu-checkin').waitFor({ state: 'visible' })
          await page.getByTestId('info-menu-connections').waitFor({ state: 'visible' })
          expect(await page.getByTestId('info-menu-power').count()).toBe(0)
          expect(await page.getByTestId('info-menu-fuel').count()).toBe(0)
          await page.getByTestId('info-menu-bags').click()
          await page.getByTestId('info-view-panel').waitFor({ state: 'visible' })
          expect(await page.getByTestId('info-panel').count()).toBe(0)
          await expectNoOverlap(
            page,
            ['info-view-bar', 'flow-toggle', 'info-view-panel', 'coach', 'photo-mode', 'menu-money'],
            viewport,
          )
          await page.keyboard.press('Escape')
          await page.getByTestId('info-view-panel').waitFor({ state: 'hidden' })
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

/** Every listed overlay sits fully below the top bar and clears each of its stats. */
async function expectNoOverlap(page: Page, ids: string[], viewport: { width: number; height: number }) {
  const bar = await page.getByTestId('stats-bar').evaluate((header) => {
    const rect = header.getBoundingClientRect()
    const stats = [...header.children]
      .map((el, i) => {
        const r = el.getBoundingClientRect()
        return { id: `stats-bar[${i}]`, x: r.x, y: r.y, w: r.width, h: r.height }
      })
      .filter((b) => b.w > 0 && b.h > 0)
    return { bottom: rect.bottom, stats }
  })
  expect(bar.stats.length).toBeGreaterThan(5)
  const at = `${viewport.width}x${viewport.height}`
  for (const id of ids) {
    const box = await boxOf(page, id)
    for (const stat of bar.stats) {
      expect(overlaps(box, stat), `${id} overlaps ${stat.id} at ${at}`).toBe(false)
    }
    expect(box.y, `${id} starts inside the top bar at ${at}`).toBeGreaterThanOrEqual(bar.bottom)
    expect(box.x + box.w, `${id} runs off screen at ${at}`).toBeLessThanOrEqual(viewport.width)
  }
}

async function boxOf(page: Page, id: string): Promise<Box> {
  const loc = page.getByTestId(id).first()
  await loc.waitFor({ state: 'visible' })
  const b = await loc.boundingBox()
  expect(b, `${id} has no box`).toBeTruthy()
  return { id, x: b!.x, y: b!.y, w: b!.width, h: b!.height }
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
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
