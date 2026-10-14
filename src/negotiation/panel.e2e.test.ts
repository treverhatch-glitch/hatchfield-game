import { existsSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME,
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
].filter((path): path is string => Boolean(path))

describe('negotiation panel', () => {
  it('opens and closes without blocking the field', async () => {
    const port = 46117
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
      if (chromePath) {
        launchOptions.executablePath = chromePath
      }
      const browser = await chromium.launch(launchOptions)
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 90_000 })
        await page.getByTestId('new-game').click()
        await page.getByTestId('start-pax').click()
        await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { presentNegotiation?: (id: string) => void } }).__hatch))
        await page.evaluate(() => {
          ;(window as unknown as { __hatch: { presentNegotiation: (id: string) => void } }).__hatch.presentNegotiation('harbor')
        })
        const panel = page.getByTestId('negotiation-panel')
        await panel.waitFor({ state: 'visible' })
        const box = await panel.boundingBox()
        const viewport = page.viewportSize()
        expect(box).toBeTruthy()
        expect(viewport).toBeTruthy()
        if (!box || !viewport) return
        expect(box.width).toBeLessThan(viewport.width * 0.5)
        expect(box.x).toBeGreaterThan(viewport.width * 0.45)
        const hit = await page.evaluate(() => {
          const layer = document.querySelector('[data-testid="negotiation-layer"]')
          const sheet = document.querySelector('[data-testid="negotiation-panel"]')
          const spot = document.elementFromPoint(80, 460)
          const layerStyle = layer ? getComputedStyle(layer).pointerEvents : ''
          return {
            layerStyle,
            inPanel: Boolean(sheet && spot && sheet.contains(spot)),
            canvas: Boolean(document.querySelector('canvas.field')),
          }
        })
        expect(hit.layerStyle).toBe('none')
        expect(hit.inPanel).toBe(false)
        expect(hit.canvas).toBe(true)
        await page.getByTestId('negotiation-close').click()
        await page.waitForFunction(() => {
          const sheet = document.querySelector('[data-testid="negotiation-panel"]')
          return !sheet
        })
        expect(await page.locator('canvas.field').count()).toBeGreaterThan(0)
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 120_000)
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
