import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { MAP_VIEWS, type MapViewId } from '../info/types.ts'
import { screensDir } from '../test/screens.ts'

const SCORE: Record<MapViewId, string> = {
  traffic: 'info-score-pressure',
  queues: 'info-score-checkin-wait',
  bays: 'info-score-in-use',
  airfield: 'info-score-movements',
  power: 'info-score-capacity',
  fuel: 'info-score-level',
}

describe('info view screenshots', () => {
  it('opens each view and saves a desktop shot', async () => {
    const OUT = screensDir('info-views')
    const port = 46341
    const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      await waitForVite(vite, port)
      const browser = await chromium.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
      })
      try {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
        page.setDefaultTimeout(60_000)
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
        await page.evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByTestId('sandbox-toggle').uncheck()
        await page.getByTestId('new-game').click()
        await page.getByTestId('start-pax').click()
        await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
        const gotIt = page.getByRole('button', { name: 'Got it' })
        if (await gotIt.count()) await gotIt.click()
        await page.evaluate(() => {
          const game = (window as unknown as { __hatch: { demoHallCrowd: (n?: number) => number; tick: (dt: number) => void; setSpeed: (n: number) => void } }).__hatch
          game.demoHallCrowd(12)
          for (let i = 0; i < 24; i++) game.tick(0.5)
          game.setSpeed(0)
        })
        await page.getByTestId('info-view-bar').waitFor({ state: 'visible' })

        for (const id of MAP_VIEWS) {
          await page.getByTestId(`info-view-${id}`).click()
          await page.getByTestId('info-view-legend').waitFor({ state: 'visible' })
          await page.getByTestId(SCORE[id]).waitFor({ state: 'visible' })
          const pressed = await page.getByTestId(`info-view-${id}`).getAttribute('aria-pressed')
          expect(pressed, id).toBe('true')
          const titles = await page.locator('[data-testid^="info-score-"]').evaluateAll((els) =>
            els.map((el) => el.getAttribute('title') ?? ''),
          )
          expect(titles.length, id).toBeGreaterThan(0)
          for (const title of titles) expect(title, id).toMatch(/Inputs:/)
          await page.getByTestId('info-view-numbers').click()
          const panel =
            id === 'traffic'
              ? 'landside-flow'
              : id === 'fuel'
                ? 'fuel-farm'
                : id === 'bays'
                  ? 'info-detail-in-use'
                  : id === 'queues'
                    ? 'info-detail-checkin-wait'
                    : id === 'airfield'
                      ? 'info-detail-movements'
                      : 'info-detail-capacity'
          await page.getByTestId(panel).waitFor({ state: 'visible' })
          await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: false })
          await page.keyboard.press('Escape')
          await page.keyboard.press('Escape')
        }
        expect(await page.getByTestId('info-view-legend').count()).toBe(0)

        await page.evaluate(() => {
          const game = (window as unknown as {
            __hatch: {
              fits: unknown[]
              buildStarterKit: () => void
              fieldLevel: () => number
              raiseAlert: (input: unknown) => void
              dismissAlert: (id: string) => void
              alerts: { active: { id: string; key: string }[] }
              panToAlert: (id: string) => void
            }
          }).__hatch
          if (!game.fits.length) game.buildStarterKit()
          game.fieldLevel = () => 3
          game.raiseAlert({
            key: 'cond:test-mark',
            severity: 'critical',
            title: 'Test mark',
            detail: 'cell',
            at: { view: 'apron', cells: [{ c: 16, r: 16 }] },
          })
          game.raiseAlert({
            key: 'cond:test-warn',
            severity: 'warning',
            title: 'Test warn',
            detail: 'cell',
            at: { view: 'apron', cells: [{ c: 16, r: 17 }] },
          })
          const calls: string[] = []
          const orig = game.panToAlert.bind(game)
          game.panToAlert = (id: string) => {
            calls.push(id)
            orig(id)
          }
          ;(window as unknown as { __pans?: string[] }).__pans = calls
        })
        await page.getByTestId('info-view-more').click()
        await page.getByTestId('info-menu-checkin').waitFor({ state: 'visible' })
        await page.getByTestId('info-menu-connections').waitFor({ state: 'visible' })
        await page.getByTestId('info-menu-bags').click()
        await page.getByTestId('info-view-panel').waitFor({ state: 'visible' })
        expect((await page.getByTestId('info-view-panel').innerText()).toLowerCase()).toContain('bag')
        expect(await page.getByTestId('info-panel').count()).toBe(0)
        await page.keyboard.press('Escape')
        await page.getByTestId('info-view-panel').waitFor({ state: 'hidden' })

        const mark = page.getByTestId('alert-mark-cond:test-mark')
        await mark.waitFor({ state: 'visible' })
        expect(await page.getByTestId('alert-mark-cond:test-warn').count()).toBe(0)
        const alertId = await page.evaluate(() => {
          const game = (window as unknown as { __hatch: { alerts: { active: { id: string; key: string }[] } } }).__hatch
          return game.alerts.active.find((row) => row.key === 'cond:test-mark')?.id ?? ''
        })
        await mark.click()
        await page.getByTestId('alert-cond:test-mark').locator('.alert-card-detail').click()
        const pans = await page.evaluate(() => (window as unknown as { __pans?: string[] }).__pans ?? [])
        expect(pans).toEqual([alertId, alertId])
        await page.getByTestId('alert-dismiss-cond:test-mark').click()
        await mark.waitFor({ state: 'detached' })
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 180_000)
})

function waitForVite(proc: ChildProcess, port: number): Promise<void> {
  let log = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    log += chunk.toString()
  })
  proc.stderr?.on('data', (chunk: Buffer) => {
    log += chunk.toString()
  })
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (proc.exitCode != null) {
        clearInterval(timer)
        reject(new Error(`vite exited ${proc.exitCode}: ${log.slice(-500)}`))
        return
      }
      void fetch(`http://127.0.0.1:${port}/`)
        .then((res) => {
          if (res.ok || res.status === 404) {
            clearInterval(timer)
            resolve()
          }
        })
        .catch(() => undefined)
      if (Date.now() - started > 40_000) {
        clearInterval(timer)
        reject(new Error(`vite did not start: ${log.slice(-500)}`))
      }
    }, 200)
  })
}
