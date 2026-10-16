// Production-build proof for Trever items 1, 11, 13, 17, 18, 23, 28, 29.
// Serves an already-built dist via `vite preview`. Real game, ?playtest=1, ultra, 1280×720.
//   GFX_BASE=http://127.0.0.1:46123 GFX_TAG=after GFX_HASH=abcdef012345 tsx scripts/gfx-trever-proof.mts
import { chromium, type Page } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const base = process.env.GFX_BASE ?? 'http://127.0.0.1:46123'
const tag = process.env.GFX_TAG ?? 'after'
const hash = process.env.GFX_HASH ?? 'unknown'
const out = `docs/devlog/media/gfx-trever/${tag}`
const work = `/tmp/gfx-frames/${tag}`
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))

async function boot() {
  await page.goto(`${base}?playtest=1`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.evaluate(() => {
    localStorage.setItem('hatchfield-gfx', 'ultra')
    localStorage.setItem('hatchfield-texture-quality', 'high')
    localStorage.setItem('hatchfield-aircraft-quality', 'high')
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByTestId('new-game').click({ timeout: 60000 })
  await page.getByTestId('start-pax').click({ timeout: 180000 })
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string }; __world?: object }).__hatch?.site && (window as unknown as { __world?: object }).__world), null, { timeout: 180000 })
  const coach = page.getByTestId('starter-kit-coach')
  if (await coach.count()) {
    await coach.click({ timeout: 30000 }).catch(() => {})
  }
  await page.evaluate(() => {
    const g = (window as unknown as { __hatch: { buildStarterKit?: () => void; showStarterKit?: () => boolean; speed: number; clock: number } }).__hatch
    if (g.showStarterKit?.()) g.buildStarterKit?.()
    g.speed = 0
    g.clock = 60
  })
  await frames(3)
}

function frames(n: number) {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count
        const step = () => {
          if (left-- <= 0) resolve()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    n,
  )
}

async function settle() {
  await frames(2)
}

async function still(name: string) {
  const file = `${out}/${name}-${hash}.png`
  await settle()
  await page.screenshot({ path: file })
  console.log('still', file)
  return file
}

function encode(dir: string, file: string, fps: number) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(fps),
      '-i',
      `${dir}/frame-%03d.png`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      file,
    ])
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${file} ${code}`))))
  })
}

async function clip(name: string, count: number, step: (i: number) => Promise<void>) {
  const dir = `${work}/${name}`
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < count; i++) {
    await step(i)
    await settle()
    await page.screenshot({ path: `${dir}/frame-${String(i).padStart(3, '0')}.png` })
  }
  const file = `${out}/${name}-${hash}.mp4`
  await encode(dir, file, 12)
  console.log('clip', file)
  return file
}

async function aim(pose: { dist: number; yaw: number; pitch: number; x: number; z: number; hour: number }) {
  await page.evaluate((p) => {
    const g = (window as unknown as { __hatch: { speed: number; clock: number } }).__hatch
    const w = (window as unknown as {
      __world: { dist: number; yaw: number; pitch: number; pivot: { set: (x: number, y: number, z: number) => void }; placeCam: () => void }
    }).__world
    g.speed = 0
    g.clock = (p.hour / 24) * 180
    w.dist = p.dist
    w.yaw = p.yaw
    w.pitch = p.pitch
    w.pivot.set(p.x, 0, p.z)
    w.placeCam()
  }, pose)
}

async function probe() {
  return page.evaluate(() => {
    const w = (window as unknown as {
      __world: {
        dist: number
        sun: { intensity: number; color: { getHexString: () => string } }
        renderer: { toneMappingExposure: number; getPixelRatio: () => number; capabilities: { getMaxAnisotropy: () => number } }
        scene: { traverse: (fn: (o: { name?: string; material?: unknown; visible?: boolean; geometry?: { type?: string } }) => void) => void; fog?: { color?: { getHexString: () => string }; near?: number; far?: number } }
        camera: { position: { x: number; z: number } }
        pivot: { x: number; z: number }
      }
    }).__world
    const g = (window as unknown as { __hatch: { clock: number; speed: number; flights: { length: number } } }).__hatch
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const tiny = document.createElement('canvas')
    tiny.width = 32
    tiny.height = 18
    const ctx = tiny.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(canvas, 0, 0, 32, 18)
    const data = ctx.getImageData(0, 0, 32, 18).data
    let r = 0
    let gg = 0
    let b = 0
    let n = 0
    let min = 255
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      gg += data[i + 1]
      b += data[i + 2]
      min = Math.min(min, data[i], data[i + 1], data[i + 2])
      n++
    }
    let maps = 0
    let flat = 0
    let maxTex = 0
    let aniso = 0
    const lod: Record<string, boolean> = {}
    const bridgeOffset: Record<string, number> = {}
    w.scene.traverse((obj) => {
      const mesh = obj as { name?: string; visible?: boolean; material?: { map?: { image?: { width?: number; naturalWidth?: number }; anisotropy?: number }; polygonOffset?: boolean; polygonOffsetFactor?: number } | Array<{ map?: { image?: { width?: number; naturalWidth?: number }; anisotropy?: number }> }> }
      if (mesh.name && mesh.name.startsWith('lod-')) lod[mesh.name] = Boolean(mesh.visible)
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
      for (const mat of mats) {
        const img = mat.map?.image
        const width = img?.naturalWidth || img?.width || 0
        if (width > 2) {
          maps++
          maxTex = Math.max(maxTex, width)
          aniso = Math.max(aniso, mat.map?.anisotropy || 0)
        } else if (mat.map) flat++
        if (mesh.name && mesh.name.startsWith('bridge-') && 'polygonOffsetFactor' in mat) {
          bridgeOffset[mesh.name] = (mat as { polygonOffsetFactor?: number }).polygonOffsetFactor ?? 0
        }
      }
    })
    const disc = { x: 0, z: 0, found: false }
    w.scene.traverse((obj) => {
      if (obj.name === 'world-ground-disc') {
        const p = obj as unknown as { position: { x: number; z: number } }
        disc.x = p.position.x
        disc.z = p.position.z
        disc.found = true
      }
    })
    return {
      clock: g.clock,
      hour: (g.clock / 180) * 24,
      speed: g.speed,
      flights: g.flights.length,
      exposure: w.renderer.toneMappingExposure,
      sunI: w.sun.intensity,
      sun: w.sun.color.getHexString(),
      pixelRatio: w.renderer.getPixelRatio(),
      maxAniso: w.renderer.capabilities.getMaxAnisotropy(),
      dist: w.dist,
      avg: { r: Math.round(r / n), g: Math.round(gg / n), b: Math.round(b / n) },
      min,
      maps,
      flatStandIn: flat,
      maxTex,
      aniso,
      lod,
      bridgeOffset,
      disc,
      cam: { x: w.camera.position.x, z: w.camera.position.z },
    }
  })
}

async function parkAircraft() {
  await page.evaluate(() => {
    const g = (window as unknown as {
      __hatch: {
        speed: number
        flights: unknown[]
        airline: (id: string) => { color: string }
      }
    }).__hatch
    g.speed = 0
    const airline = 'bushline'
    g.airline(airline)
    g.flights.push({
      id: 'gfx-proof-plane',
      airline,
      flightNo: 'BL100',
      airframeId: 'b738',
      airframeName: 'b738',
      pax: 160,
      cargo: false,
      craft: 'jet',
      kind: 'narrowbody',
      phase: 'taxi_in',
      stand: null,
      x: 14,
      y: 26.4,
      z: 0.12,
      heading: 1.57,
      path: [{ c: 14, r: 26 }],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: {},
      waitingOn: {},
      phaseTime: 0,
      ledger: [],
    })
  })
}

async function buyBridge() {
  return page.evaluate(() => {
    const g = (window as unknown as {
      __hatch: {
        cash: number
        buyFitting: (id: string, kind: string) => boolean
        boughtBridges: (cell: { c: number; r: number }) => number
      }
    }).__hatch
    g.cash = Math.max(g.cash, 200000)
    const ok = g.buyFitting('stand:11,6', 'jet_bridge')
    return { ok, bridges: g.boughtBridges({ c: 11, r: 6 }) }
  })
}

async function pivotSpan() {
  return page.evaluate(() => {
    const w = (window as unknown as { __world: { pivot: { x: number; z: number }; dist: number } }).__world
    return { x: w.pivot.x, z: w.pivot.z, dist: w.dist }
  })
}

async function panMetres() {
  await aim({ dist: 88, yaw: 0.4, pitch: 0.68, x: 0, z: 0, hour: 8 })
  await page.locator('canvas').click()
  const a = await pivotSpan()
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(3000)
  await page.keyboard.up('ArrowRight')
  const b = await pivotSpan()
  const wu = Math.hypot(b.x - a.x, b.z - a.z) / 3
  return { wu, metresPerSec: wu / 0.45, dist: b.dist, from: a, to: b }
}

const report: Record<string, unknown> = { tag, hash, errors }
try {
  await boot()
  await aim({ dist: 88, yaw: 0.6, pitch: 0.62, x: -8, z: -20, hour: 8 })
  report.day = await probe()
  await still('01-daylight')
  await clip('01-daylight', 30, async (i) => {
    await aim({ dist: 88, yaw: 0.6 + i * 0.01, pitch: 0.62, x: -20 + i * 1.6, z: -30 + i * 0.4, hour: 8 })
  })

  await aim({ dist: 120, yaw: 0.4, pitch: 0.45, x: 0, z: 0, hour: 23 })
  report.night = await probe()
  await still('01-night')
  await clip('01-night', 24, async (i) => {
    await aim({ dist: 110, yaw: 0.3 + i * 0.02, pitch: 0.5, x: i * 0.8, z: -10, hour: 23 })
  })

  await aim({ dist: 160, yaw: 0.2, pitch: 0.35, x: 720, z: 640, hour: 23 })
  report.edge = await probe()
  await still('11-edge')
  await clip('11-edge', 30, async (i) => {
    const t = i / 29
    await aim({ dist: 180, yaw: 0.2, pitch: 0.32, x: 200 + t * 700, z: 180 + t * 620, hour: 23 })
  })

  await parkAircraft()
  await frames(4)
  await aim({ dist: 36, yaw: 0.9, pitch: 1.05, x: -14.8, z: 108, hour: 8 })
  report.aircraftClose = await probe()
  await still('13-aircraft')
  await clip('13-aircraft', 30, async (i) => {
    await aim({ dist: 42, yaw: 0.4 + i * 0.08, pitch: 0.7, x: -14.8, z: 108, hour: 8 })
  })

  await aim({ dist: 22, yaw: 0.5, pitch: 0.9, x: -6, z: -40, hour: 8 })
  report.zoomClose = await probe()
  await still('17-zoom-close')
  await aim({ dist: 240, yaw: 0.5, pitch: 0.7, x: -6, z: -40, hour: 8 })
  report.zoomFar = await probe()
  await still('17-zoom-far')
  await clip('17-zoom', 36, async (i) => {
    const t = i / 35
    const dist = t < 0.5 ? 28 + (240 - 28) * (t * 2) : 240 - (240 - 28) * ((t - 0.5) * 2)
    await aim({ dist, yaw: 0.5, pitch: 0.72, x: -6, z: -40, hour: 8 })
  })

  await aim({ dist: 260, yaw: 1.2, pitch: 0.55, x: -14.8, z: 108, hour: 8 })
  report.liveryFar = await probe()
  await still('18-livery-far')
  await aim({ dist: 32, yaw: 1.2, pitch: 0.45, x: -14.8, z: 108, hour: 8 })
  report.liveryClose = await probe()
  await still('18-livery-close')
  await clip('18-livery', 30, async (i) => {
    const dist = 30 + (i / 29) * 230
    await aim({ dist, yaw: 1.15, pitch: 0.48, x: -14.8, z: 108, hour: 8 })
  })

  await aim({ dist: 48, yaw: 0.8, pitch: 0.55, x: -10, z: -50, hour: 8 })
  report.buildings = await probe()
  await still('23-buildings')
  await clip('23-buildings', 30, async (i) => {
    await aim({ dist: 52, yaw: 0.3 + i * 0.06, pitch: 0.5, x: -16, z: -48, hour: 8 })
  })

  const bridge = await buyBridge()
  report.bridgeBuy = bridge
  await frames(6)
  await aim({ dist: 28, yaw: 0.2, pitch: 0.55, x: -44, z: -90, hour: 8 })
  report.bridge = await probe()
  await still('28-bridge')
  await clip('28-bridge', 36, async (i) => {
    const slide = Math.sin((i / 35) * Math.PI * 2) * 18
    await aim({ dist: 26, yaw: 0.15 + i * 0.01, pitch: 0.5, x: -44 + slide, z: -88, hour: 8 })
  })

  report.pan = await panMetres()
  await aim({ dist: 88, yaw: 0.4, pitch: 0.68, x: 0, z: 0, hour: 8 })
  await page.getByTestId('hud-menu').click()
  await page.getByTestId('pause-settings').click()
  await page.getByTestId('settings-camera-speed').waitFor({ timeout: 15000 })
  await still('29-settings')
  await page.getByTestId('pause-resume').click().catch(async () => {
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  })
  await frames(3)
  await aim({ dist: 88, yaw: 0.4, pitch: 0.68, x: 0, z: 0, hour: 8 })
  await page.locator('canvas').click()
  await page.keyboard.down('ArrowRight')
  await clip('29-pan', 30, async () => {
    await page.evaluate(() => {
      const g = (window as unknown as { __hatch: { speed: number; clock: number } }).__hatch
      g.speed = 0
      g.clock = 60
    })
  })
  await page.keyboard.up('ArrowRight')
} catch (err) {
  report.failed = err instanceof Error ? err.stack : String(err)
  console.error(report.failed)
} finally {
  report.pageErrors = errors
  writeFileSync(`${out}/probe-${hash}.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ day: report.day, night: report.night, edge: report.edge, pan: report.pan, bridge: report.bridgeBuy, failed: report.failed }, null, 2))
  await browser.close()
  if (report.failed) process.exit(1)
}
