import { existsSync, mkdirSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium, type Page } from 'playwright'

const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME,
  '/usr/bin/google-chrome',
  '/usr/local/bin/google-chrome',
].filter((path): path is string => Boolean(path))

type HatchProbe = {
  raiseAlert: (input: {
    key: string
    severity: 'critical' | 'warning' | 'info'
    title: string
    detail: string
    at?: { view: 'apron' | 'hall'; cells: { c: number; r: number }[] }
  }) => void
  camGoal: { view: string; c: number; r: number } | null
  alerts: { active: { key: string }[] }
}

describe('alert stack', () => {
  it('sits bottom right, shows critical and warning, and a click jumps the camera', async () => {
    const port = 46223
    const vite = spawn(process.execPath, [viteBin(), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      await waitForVite(vite, port)
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
      }
      const chromePath = CHROME_PATHS.find((path) => existsSync(path))
      if (chromePath) launchOptions.executablePath = chromePath
      const browser = await chromium.launch(launchOptions)
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
        page.setDefaultTimeout(60_000)
        await openTitle(page, port)
        await page.evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        await openTitle(page, port)
        await page.getByTestId('sandbox-toggle').uncheck()
        await page.getByTestId('new-game').click()
        await page.getByTestId('start-pax').click()
        await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
        const gotIt = page.getByRole('button', { name: 'Got it' })
        if (await gotIt.count()) await gotIt.click()

        await page.evaluate(() => {
          const game = (window as unknown as { __hatch: HatchProbe }).__hatch
          game.raiseAlert({
            key: 'e2e-fuel',
            severity: 'critical',
            title: 'Fuel farm is empty',
            detail: '0 L on the farm',
            at: { view: 'apron', cells: [{ c: 4, r: 5 }] },
          })
          game.raiseAlert({
            key: 'e2e-queue',
            severity: 'warning',
            title: 'Check-in queue',
            detail: 'Desks are behind',
            at: { view: 'apron', cells: [{ c: 8, r: 2 }] },
          })
          game.raiseAlert({
            key: 'e2e-vip',
            severity: 'info',
            title: 'VIP visit',
            detail: 'A stand is held for the motorcade',
          })
        })

        const stack = page.getByTestId('alert-stack')
        await stack.waitFor({ state: 'visible' })
        await page.getByTestId('alert-e2e-fuel').waitFor({ state: 'visible' })
        await page.getByTestId('alert-e2e-queue').waitFor({ state: 'visible' })
        expect(await page.getByText('VIP visit').count()).toBe(0)
        expect(await page.getByTestId('alert-e2e-fuel').getAttribute('data-severity')).toBe('critical')
        expect(await page.getByTestId('alert-e2e-queue').getAttribute('data-severity')).toBe('warning')
        expect(await page.getByTestId('alert-e2e-fuel').innerText()).toMatch(/critical/i)
        expect(await page.getByTestId('alert-e2e-queue').innerText()).toMatch(/warning/i)

        const box = await stack.boundingBox()
        const money = await page.getByTestId('menu-money').boundingBox()
        expect(box, 'alert stack has a box').toBeTruthy()
        expect(money, 'money menu has a box').toBeTruthy()
        expect(box!.x).toBeGreaterThan(1440 / 2)
        expect(box!.y + box!.height).toBeLessThanOrEqual(money!.y + 4)

        const before = await cam(page)
        await page.getByTestId('alert-dismiss-e2e-queue').click()
        await page.getByTestId('alert-e2e-queue').waitFor({ state: 'detached' })
        expect(await cam(page)).toEqual(before)

        await page.getByTestId('alert-e2e-fuel').locator('.alert-card-detail').click()
        await page.waitForFunction(() => {
          const goal = (window as unknown as { __hatch: HatchProbe }).__hatch.camGoal
          return goal?.c === 4 && goal?.r === 5 && goal?.view === 'apron'
        })

        const phone = page.getByTestId('phone')
        if (await phone.count()) {
          expect(await phone.innerText()).not.toMatch(/Fuel farm is empty|VIP visit|emergency/i)
        }

        mkdirSync('docs/screens/ui-audit', { recursive: true })
        await page.screenshot({ path: 'docs/screens/ui-audit/alerts-bottom-right.png' })
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 120_000)
})

async function cam(page: Page) {
  return page.evaluate(() => (window as unknown as { __hatch: HatchProbe }).__hatch.camGoal)
}

function viteBin(): string {
  return 'node_modules/vite/bin/vite.js'
}

async function waitForVite(proc: ChildProcess, port: number): Promise<void> {
  let log = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    log += chunk.toString()
  })
  proc.stderr?.on('data', (chunk: Buffer) => {
    log += chunk.toString()
  })
  const started = Date.now()
  while (Date.now() - started < 40_000) {
    if (proc.exitCode != null) throw new Error(`vite exited ${proc.exitCode}: ${log.slice(-500)}`)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      if (res.ok || res.status === 404) return
    } catch {
      // socket not open yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`vite did not start: ${log.slice(-500)}`)
}

async function openTitle(page: Page, port: number): Promise<void> {
  let last: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
      return
    } catch (err) {
      last = err
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  throw last
}
