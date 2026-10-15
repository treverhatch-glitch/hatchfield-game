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
        const harborShot = await aim(page, 'harbor')
        expect(harborShot.ok).toBe(true)
        expect(harborShot.rgb[1]).toBeGreaterThan(harborShot.rgb[0] + 30)
        expect(harborShot.rgb[1]).toBeGreaterThan(harborShot.rgb[2])
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
        const northShot = await aim(page, 'northline')
        expect(northShot.ok).toBe(true)
        expect(northShot.rgb[2]).toBeGreaterThan(northShot.rgb[0] + 30)
        expect(northShot.rgb[2]).toBeGreaterThan(northShot.rgb[1])
        await page.screenshot({ path: 'docs/screens/checkin/desk-northline.png' })
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 240_000)
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

async function aim(page: Page, brand: string): Promise<{ ok: boolean; rgb: number[] }> {
  return page.evaluate((id) => {
    const hall = (window as unknown as { __hall: HallCam }).__hall
    const game = (window as unknown as { __hatch: { camGoal: unknown } }).__hatch
    // Rebuild the signs for the current allocation before looking them up.
    hall.render(game)
    // A facility select eases the orbit camera. A grab cancels that ease so
    // the framed render keeps the lens parked on the sign.
    hall.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 4, clientY: 4, button: 0 }))
    game.camGoal = null
    const sign = hall.scene.getObjectByName(`desk-sign:${id}`)
    if (!sign) return { ok: false, rgb: [0, 0, 0] }
    sign.updateWorldMatrix(true, false)
    const normal = sign.position.clone()
    sign.getWorldDirection(normal)
    const eye = sign.position.clone().addScaledVector(normal, 5)
    hall.camera.position.copy(eye)
    hall.camera.up.set(0, 1, 0)
    hall.camera.lookAt(sign.position)
    hall.render(game)
    const gl = hall.renderer.getContext()
    function signPaint(mesh: Sign): number[] {
      const canvas = mesh.material?.map?.image
      const ctx = canvas?.getContext('2d')
      const px = ctx?.getImageData(8, 8, 1, 1).data
      return px ? [px[0], px[1], px[2]] : [0, 0, 0]
    }
    const paint = signPaint(sign)
    const w = gl.drawingBufferWidth
    const h = gl.drawingBufferHeight
    const pix = new Uint8Array(4)
    let best = [0, 0, 0]
    let bestD = 1e9
    for (let y = (h * 0.3) | 0; y < h * 0.7; y += 6) {
      for (let x = (w * 0.3) | 0; x < w * 0.7; x += 6) {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix)
        const d = Math.abs(pix[0] - paint[0]) + Math.abs(pix[1] - paint[1]) + Math.abs(pix[2] - paint[2])
        if (d < bestD) {
          bestD = d
          best = [pix[0], pix[1], pix[2]]
        }
      }
    }
    return { ok: bestD < 90, rgb: best }
  }, brand)
}

interface HallCam {
  render: (game: unknown) => void
  renderer: {
    domElement: HTMLCanvasElement
    getContext: () => WebGL2RenderingContext
  }
  camera: {
    position: { copy: (v: Vec3) => void }
    up: { set: (x: number, y: number, z: number) => void }
    lookAt: (v: Vec3) => void
  }
  scene: {
    getObjectByName: (name: string) => Sign | undefined
  }
}

interface Vec3 {
  x: number
  y: number
  z: number
  clone: () => Vec3
  copy: (v: Vec3) => Vec3
  addScaledVector: (v: Vec3, s: number) => Vec3
}

interface Sign {
  position: Vec3
  material?: { map?: { image?: HTMLCanvasElement } }
  updateWorldMatrix: (updateParents: boolean, updateChildren: boolean) => void
  getWorldDirection: (target: Vec3) => Vec3
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
