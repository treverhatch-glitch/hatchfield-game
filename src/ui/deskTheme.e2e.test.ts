import { existsSync, mkdirSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium, type Page } from 'playwright'

const CHROME_PATHS = [process.env.PLAYWRIGHT_CHROME, '/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].filter(
  (path): path is string => Boolean(path),
)

describe('check-in desk themes', () => {
  it('swaps a common desk from one airline to the next', async () => {
    const port = 46257
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
        await page.getByTestId('starter-kit-coach').click()
        await page.waitForFunction(
          () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
        )
        const gotIt = page.getByRole('button', { name: 'Got it' })
        if (await gotIt.count()) await gotIt.click()
        await page.getByTestId('view-terminal').click()
        await page.waitForFunction(() => {
          const probe = window as unknown as { __hatch?: { view?: string }; __hall?: { placeCam?: () => void } }
          return probe.__hatch?.view === 'hall' && typeof probe.__hall?.placeCam === 'function'
        })

        const first = await page.evaluate(() => {
          const game = (window as unknown as { __hatch: Hatch }).__hatch
          const row = (id: string, airlineId: string, std: number) => ({
            slotId: id,
            std,
            hallId: 'hall',
            airlineId,
            intl: false,
            tags: Array.from({ length: 40 }, () => 'budget' as const),
            releases: [] as number[],
            spawned: 0,
            flightId: id,
            closed: false,
          })
          game.setSpeed(0)
          const now = game.clock
          for (const flight of game.flights) flight.phase = 'gone'
          game.showUps = game.showUps.filter((plan) => plan.closed)
          game.showUps.push(row('harbor-desk', 'harbor', now + 10), row('north-desk', 'northline', now + 30))
          game.selectFacility('checkin')
          game.tickHallNav(0.05)
          const brands = game.deskBrands().map((brand) => brand.id)
          return { brands, live: game.hallNav.live }
        })
        expect(first.brands).toContain('harbor')
        expect(first.brands).not.toContain('northline')
        expect(first.live).toBe(true)
        await page.evaluate(() => {
          const game = (window as unknown as { __hatch: Hatch }).__hatch
          ;(window as unknown as { __hall: HallCam }).__hall.render(game)
        })
        expect(await aim(page, 'harbor')).toBe(true)
        mkdirSync('docs/screens/checkin', { recursive: true })
        await page.screenshot({ path: 'docs/screens/checkin/desk-harbor.png' })

        const second = await page.evaluate(() => {
          const game = (window as unknown as { __hatch: Hatch }).__hatch
          game.clock += 20
          game.selectFacility('checkin')
          game.tickHallNav(0.05)
          return { brands: game.deskBrands().map((brand) => brand.id), why: game.buildingCard()?.why ?? '' }
        })
        expect(second.brands).toContain('northline')
        expect(second.brands).not.toContain('harbor')
        expect(second.why).not.toBe('short of desks')
        await page.evaluate(() => {
          const game = (window as unknown as { __hatch: Hatch }).__hatch
          ;(window as unknown as { __hall: HallCam }).__hall.render(game)
        })
        expect(await aim(page, 'northline')).toBe(true)
        await page.screenshot({ path: 'docs/screens/checkin/desk-northline.png' })
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 120_000)
})

interface Brand {
  id: string
}

interface Hatch {
  site?: string
  view: string
  clock: number
  speed: number
  flights: { phase: string }[]
  showUps: { closed: boolean }[]
  setSpeed: (n: number) => void
  tickHallNav: (step: number) => void
  selectFacility: (id: string | null) => void
  hallNav: { live: boolean }
  deskBrands: () => Brand[]
  buildingCard: () => { why: string } | null
  showStarterKit: () => boolean
}

async function aim(page: Page, brand: string): Promise<boolean> {
  return page.evaluate((id) => {
    const hall = (window as unknown as { __hall: HallCam }).__hall
    const sign = hall.scene.getObjectByName(`desk-sign:${id}`)
    if (!sign) return false
    const game = (window as unknown as { __hatch: unknown }).__hatch
    hall.dist = 3
    hall.pitch = 0.18
    hall.yaw = sign.rotation.y + Math.PI
    hall.pivot.set(sign.position.x, sign.position.y, sign.position.z)
    hall.placeCam()
    hall.render(game)
    return true
  }, brand)
}

interface HallCam {
  dist: number
  pitch: number
  yaw: number
  pivot: { set: (x: number, y: number, z: number) => void }
  placeCam: () => void
  render: (game: unknown) => void
  scene: {
    traverse: (fn: (obj: { name: string }) => void) => void
    getObjectByName: (name: string) => { position: { x: number; y: number; z: number }; rotation: { y: number } } | undefined
  }
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
