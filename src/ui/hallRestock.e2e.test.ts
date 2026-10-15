import { existsSync, mkdirSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium, type Page } from 'playwright'

const CHROME_PATHS = [process.env.PLAYWRIGHT_CHROME, '/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].filter(
  (path): path is string => Boolean(path),
)

describe('hall restock screens', () => {
  it('shows the cart docked at the counter and the out-of-stock chip', async () => {
    const port = 46241
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
        // The plot stays empty until the coach stamps the kit. Terminal needs that hall.
        await page.getByTestId('starter-kit-coach').click()
        await page.waitForFunction(
          () =>
            !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
        )
        const gotIt = page.getByRole('button', { name: 'Got it' })
        if (await gotIt.count()) await gotIt.click()
        await page.getByTestId('view-terminal').click()
        await page.waitForFunction(() => {
          const probe = window as unknown as { __hatch?: { view?: string }; __hall?: { placeCam?: () => void } }
          return probe.__hatch?.view === 'hall' && typeof probe.__hall?.placeCam === 'function'
        })

        const docked = await page.evaluate(() => {
          const game = (window as unknown as { __hatch: Hatch }).__hatch
          const hall = (window as unknown as { __hall: HallCam }).__hall
          game.setSpeed(1)
          game.setHallReorder('shop', 0)
          game.setHallReorder('food', 80)
          game.foodShelf = 4
          for (let i = 0; i < 800; i++) {
            game.tick(0.05)
            const pose = game.supplyCartPoses().find((p) => p.phase === 'shelving' && p.docked && p.kind === 'food')
            if (pose) {
              game.setSpeed(0)
              game.camGoal = null
              hall.dist = 9
              hall.pitch = 1.05
              hall.yaw = 0.2
              hall.pivot.set(pose.x, 0, pose.z)
              hall.placeCam()
              return { x: pose.x, z: pose.z }
            }
          }
          return null
        })
        expect(docked).toBeTruthy()
        await page.waitForTimeout(400)
        const aimed = await page.evaluate((at) => {
          const hall = (window as unknown as { __hall: HallCam }).__hall
          hall.dist = 9
          hall.pitch = 1.05
          hall.yaw = 0.2
          hall.pivot.set(at.x, 0, at.z)
          hall.placeCam()
          const cam = hall.camera.position
          return {
            dist: hall.dist,
            cam: [cam.x, cam.y, cam.z],
            names: hall.scene.children.map((c) => c.name),
            carts: hall.scene.getObjectByName('supply-carts')?.children.length ?? 0,
          }
        }, docked!)
        expect(aimed.carts).toBeGreaterThan(0)
        expect(aimed.dist).toBe(9)
        await page.waitForTimeout(250)
        mkdirSync('docs/screens/g1', { recursive: true })
        await page.screenshot({ path: 'docs/screens/g1/cart-docked.png' })

        await page.evaluate(() => {
          const game = (window as unknown as { __hatch: Hatch }).__hatch
          game.foodShelf = 0
          game.shopShelf = 0
          if (game.infoOpen !== 'retail') game.toggleInfo('retail')
        })
        await page.getByTestId('info-view-panel').waitFor({ state: 'visible' })
        expect(await page.getByTestId('info-view-panel').innerText()).toMatch(/Out of stock, restock run \d+ s away/)
        await page.screenshot({ path: 'docs/screens/g1/out-of-stock.png' })
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 120_000)
})

interface Hatch {
  site?: string
  infoOpen: string | null
  camGoal: { view: string; c: number; r: number; seq: number } | null
  foodShelf: number
  shopShelf: number
  setSpeed: (n: number) => void
  setHallReorder: (kind: 'food' | 'shop', level: number) => void
  tick: (dt: number) => void
  supplyCartPoses: () => { phase: string; docked: boolean; kind: string; x: number; z: number }[]
  toggleInfo: (id: string) => void
  view: string
}

interface HallCam {
  dist: number
  pitch: number
  yaw: number
  pivot: { set: (x: number, y: number, z: number) => void }
  placeCam: () => void
  camera: { position: { x: number; y: number; z: number } }
  scene: { children: { name: string }[]; getObjectByName: (name: string) => { children: unknown[] } | undefined }
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
