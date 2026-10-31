import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { findChrome, gameUrl } from '../test/e2e.ts'


describe('negotiation panel', () => {
  it('opens and closes without blocking the field', async () => {
    const port = 46117
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
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
        await page.goto(gameUrl(port), { waitUntil: 'domcontentloaded', timeout: 90_000 })
        await page.getByTestId('new-game').click()
        await page.getByTestId('start-pax').click()
        await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { presentNegotiation?: (id: string) => void } }).__hatch))
        await page.evaluate(() => {
          const game = (window as unknown as { __hatch: { presentNegotiation: (id: string) => void; openNegotiationPanel: () => void } }).__hatch
          game.presentNegotiation('harbor')
          game.openNegotiationPanel()
        })
        await page.getByTestId('dock-tab-phone').click()
        const peek = page.getByTestId('phone-peek')
        if (await peek.count()) await peek.click()
        const messages = page.getByTestId('phone-tab-messages')
        if ((await messages.getAttribute('aria-selected')) !== 'true') await messages.click()
        if (await page.getByTestId('phone-tab-shut').count()) await messages.click()
        const card = page.getByTestId('phone-card-negotiation')
        await card.waitFor({ state: 'visible' })
        expect(await page.getByTestId('negotiation-panel').count()).toBe(0)
        const box = await card.boundingBox()
        const viewport = page.viewportSize()
        expect(box).toBeTruthy()
        expect(viewport).toBeTruthy()
        if (!box || !viewport) return
        expect(box.x + box.width).toBeLessThan(viewport.width * 0.45)
        const hit = await page.evaluate(() => {
          const spot = document.elementFromPoint(viewportCenter(), 460)
          return {
            inPhone: Boolean(spot?.closest('[data-testid="phone"]')),
            canvas: Boolean(document.querySelector('canvas.field')),
          }
          function viewportCenter() {
            return Math.round(window.innerWidth * 0.62)
          }
        })
        expect(hit.inPhone).toBe(false)
        expect(hit.canvas).toBe(true)
        await page.getByTestId('phone-action-negotiation-close').click()
        await page.waitForFunction(() => !document.querySelector('[data-testid="phone-card-negotiation"]'))
        expect(await page.locator('canvas.field').count()).toBeGreaterThan(0)
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 180_000)
})

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
