/**
 * A car stopped in the hall layby, from a low side angle and from above.
 * The page also measures the drawn body against the terminal floor slab
 * and the roof overhang as separate meshes.
 * Production preview, ?playtest=1, 12 fps, 1280×720. Graphics stay on ultra.
 */
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const sha = (process.env.PROOF_SHA ?? execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' })).trim()
const base = process.env.PROOF_BASE ?? 'http://127.0.0.1:45217'
const outDir = 'docs/devlog/media/traffic-proof-run3'
const artDir = '/opt/cursor/artifacts'
const framesRoot = '/tmp/layby-roof-probe'
mkdirSync(outDir, { recursive: true })
mkdirSync(artDir, { recursive: true })

const { chromium } = await import('playwright')
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
page.on('pageerror', (err) => console.error('pageerror', err.message))

console.log('open', sha)
await page.goto(`${base}/?playtest=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.evaluate(`(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'ultra')
  localStorage.setItem('hatchfield-texture-quality', 'high')
  localStorage.setItem('hatchfield-aircraft-quality', 'high')
})()`)
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.getByTestId('sandbox-toggle').uncheck().catch(() => {})
await page.getByTestId('new-game').click({ timeout: 60_000 })
await page.getByTestId('start-pax').scrollIntoViewIfNeeded()
await page.getByTestId('start-pax').click({ timeout: 180_000 })
await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site && window.__world)', null, { timeout: 180_000 })
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) {
  await coach.click()
  await page.waitForFunction('!window.__hatch.showStarterKit()')
} else {
  await page.evaluate('window.__hatch.buildStarterKit()')
}

await page.evaluate(`(() => {
  const g = window.__hatch
  const w = window.__world
  g.setView && g.setView('apron')
  g.setDayNightCycle(false)
  w.setGraphicsQuality('ultra')
  w.setDayNight({ hour: 12 })
  const orig = g.tick.bind(g)
  g.tick = (dt) => { if (window.__hold) return; return orig(dt) }
  window.__origTick = orig
  const origRender = w.render.bind(w)
  w.render = (game) => {
    origRender(game)
    const aim = window.__aim
    if (!aim) return
    w.pivot.set(aim.x, 0, aim.z)
    w.yaw = aim.yaw
    w.pitch = aim.pitch
    w.dist = aim.dist
    w.placeCam()
    w.renderer.render(w.scene, w.camera)
  }
  window.__hold = false
  g.speed = 1
})()`)

for (let batch = 0; batch < 8; batch++) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    for (let i = 0; i < 150; i++) {
      if (g.offer) g.acceptOffer()
      window.__origTick(0.1)
    }
  })()`)
  console.log('warm', batch + 1)
}
for (let batch = 0; batch < 4; batch++) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    for (let i = 0; i < 60; i++) {
      if (g.offer) g.acceptOffer()
      window.__origTick(1)
    }
  })()`)
  console.log('busy', batch + 1)
}

const stopped = await page.evaluate(`(() => {
  const g = window.__hatch
  for (let i = 0; i < 12 * 120; i++) {
    if (g.offer) g.acceptOffer()
    window.__origTick(1 / 12)
    const hit = g.landsideView().vehicles.find((c) => c.state === 'stop' && c.speed < 0.3 && c.c > 16.45 && c.c < 16.75 && c.r > 7.5 && c.r < 11)
    if (hit) {
      g.speed = 0
      window.__hold = true
      return { id: hit.id, kind: hit.kind, c: hit.c, r: hit.r, heading: hit.heading, lane: hit.lane, speed: hit.speed }
    }
  }
  g.speed = 0
  window.__hold = true
  return null
})()`)
console.log('stopped', JSON.stringify(stopped))
if (!stopped) throw new Error('no car stopped in the hall layby')

const probe = await page.evaluate(`(() => {
  const car = ${JSON.stringify(stopped)}
  const w = window.__world
  w.render(window.__hatch)
  const CELL = 22 * 0.45
  const M = 0.45
  const want = { x: (car.c - 31 / 2) * CELL, z: (car.r - 31 / 2) * CELL }
  const apply = (m, x, y, z) => {
    const e = m.elements
    return {
      x: e[0] * x + e[4] * y + e[8] * z + e[12],
      y: e[1] * x + e[5] * y + e[9] * z + e[13],
      z: e[2] * x + e[6] * y + e[10] * z + e[14],
    }
  }
  const inside = (p, a, b, c) => {
    const s = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
    const t = (c.x - b.x) * (p.z - b.z) - (c.z - b.z) * (p.x - b.x)
    const u = (a.x - c.x) * (p.z - c.z) - (a.z - c.z) * (p.x - c.x)
    const eps = 1e-4
    return (s >= -eps && t >= -eps && u >= -eps) || (s <= eps && t <= eps && u <= eps)
  }
  let body = null
  let bestD = 1e9
  const meshes = []
  w.scene.traverse((obj) => meshes.push(obj))
  for (const mesh of meshes) {
    if (!mesh.isInstancedMesh || !mesh.instanceColor || !mesh.castShadow) continue
    if (!mesh.geometry || mesh.geometry.type !== 'BoxGeometry') continue
    mesh.updateWorldMatrix(true, false)
    const local = mesh.matrix.clone()
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, local)
      const world = mesh.matrixWorld.clone().multiply(local)
      const at = apply(world, 0, 0, 0)
      const d = Math.hypot(at.x - want.x, at.z - want.z)
      if (d < bestD) {
        bestD = d
        body = { mesh, world, at }
      }
    }
  }
  if (!body) return { error: 'no drawn body', want }
  const geo = body.mesh.geometry
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const hx = (bb.max.x - bb.min.x) / 2
  const hz = (bb.max.z - bb.min.z) / 2
  const samples = []
  for (let u = -1; u <= 1.001; u += 0.25) {
    for (let v = -1; v <= 1.001; v += 0.25) {
      samples.push(apply(body.world, hx * u, 0, hz * v))
    }
  }
  const corners = [
    apply(body.world, hx, 0, hz),
    apply(body.world, hx, 0, -hz),
    apply(body.world, -hx, 0, -hz),
    apply(body.world, -hx, 0, hz),
  ]
  const near = (p) => Math.hypot(p.x - want.x, p.z - want.z) < 12
  const buckets = { slab: [], roof: [], kerb: [], road: [], post: [] }
  const take = (mesh, kind, test) => {
    const pos = mesh.geometry && mesh.geometry.getAttribute && mesh.geometry.getAttribute('position')
    if (!pos) return
    mesh.updateWorldMatrix(true, false)
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : pos.count
    const vert = (n) => {
      const i = index ? index.getX(n) : n
      return apply(mesh.matrixWorld, pos.getX(i), pos.getY(i), pos.getZ(i))
    }
    for (let n = 0; n + 2 < count; n += 3) {
      const a = vert(n)
      const b = vert(n + 1)
      const c = vert(n + 2)
      if (!near(a) && !near(b) && !near(c)) continue
      const minY = Math.min(a.y, b.y, c.y)
      const maxY = Math.max(a.y, b.y, c.y)
      if (!test(minY, maxY, mesh.name || '')) continue
      buckets[kind].push([a, b, c])
    }
  }
  for (const mesh of meshes) {
    const name = mesh.name || ''
    if (name === 'terminal-slab') take(mesh, 'slab', () => true)
    else if (name.startsWith('terminal-shell')) {
      take(mesh, 'roof', (minY) => minY > 0.9)
      take(mesh, 'post', (minY, maxY) => minY < 0.3 && maxY > 1)
    } else if (name === 'surface-kerb') take(mesh, 'kerb', () => true)
    else if (name === 'surface-road') take(mesh, 'road', () => true)
  }
  const hit = (list, p) => list.some(([a, b, c]) => inside(p, a, b, c))
  const count = (list) => samples.filter((p) => hit(list, p)).length
  const slabN = count(buckets.slab)
  const roofN = count(buckets.roof)
  const kerbN = count(buckets.kerb)
  const roadN = count(buckets.road)
  const postN = count(buckets.post)
  const ys = (list) => {
    let min = 1e9
    let max = -1e9
    for (const tri of list) for (const p of tri) {
      if (p.y < min) min = p.y
      if (p.y > max) max = p.y
    }
    return list.length ? { minM: min / M, maxM: max / M, tris: list.length } : { tris: 0 }
  }
  return {
    id: car.id,
    kind: car.kind,
    cell: { c: car.c, r: car.r, lane: car.lane },
    matchM: bestD / M,
    bodyM: { length: (hx * 2), width: (hz * 2) },
    samples: samples.length,
    onSlab: slabN,
    underRoof: roofN,
    onKerb: kerbN,
    onRoad: roadN,
    onPost: postN,
    slab: ys(buckets.slab),
    roof: ys(buckets.roof),
    kerb: ys(buckets.kerb),
    cornersM: corners.map((p) => ({ x: +((p.x - want.x) / M).toFixed(3), z: +((p.z - want.z) / M).toFixed(3), y: +(p.y / M).toFixed(3) })),
  }
})()`)
console.log('FOOTPRINT', JSON.stringify(probe, null, 2))
writeFileSync(`${outDir}/layby-roof-probe-${sha}.json`, JSON.stringify({ sha, stopped, probe }, null, 2))
writeFileSync(`${artDir}/layby-roof-probe-${sha}.json`, JSON.stringify({ sha, stopped, probe }, null, 2))

const CELL = 22 * 0.45
const carAt = stopped as { c: number; r: number }
async function aim(c: number, r: number, dist: number, pitch: number, yaw: number) {
  const pivot = { x: (c - 31 / 2) * CELL, z: (r - 31 / 2) * CELL }
  await page.evaluate(
    `(({ pivot, yaw, pitch, dist }) => {
      const w = window.__world
      window.__aim = { x: pivot.x, z: pivot.z, yaw, pitch, dist }
      w.pivot.set(pivot.x, 0, pivot.z)
      w.yaw = yaw
      w.pitch = pitch
      w.dist = dist
      w.placeCam()
    })(${JSON.stringify({ pivot, yaw, pitch, dist })})`,
  )
}
async function holdFrame(dir: string, i: number) {
  const url = (await page.evaluate(`(() => {
    const g = window.__hatch
    const w = window.__world
    g.camGoal = null
    g.cameraCue = null
    g.viewCue = null
    w.render(g)
    document.querySelectorAll('[data-testid="celebration-banner"],[data-testid="celebration-confetti"]').forEach((el) => { el.style.display = 'none' })
    return w.renderer.domElement.toDataURL('image/png')
  })()`)) as string
  writeFileSync(`${dir}/frame-${String(i).padStart(3, '0')}.png`, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
}
function encode(dir: string, file: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', '12', '-i', `${dir}/frame-%03d.png`,
      '-vf', `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='build ${sha}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.65:x=16:y=h-36`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file,
    ], { stdio: 'inherit' })
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
  })
}
async function clip(name: string, dist: number, pitch: number, yaw: number, shiftC: number) {
  const dir = `${framesRoot}/${name}`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  await aim(carAt.c + shiftC, carAt.r, dist, pitch, yaw)
  for (let i = 0; i < 12 * 4; i++) await holdFrame(dir, i)
  const file = `${outDir}/${name}-${sha}.mp4`
  await encode(dir, file)
  await encode(dir, `${artDir}/${name}-${sha}.mp4`)
  console.log('wrote', file)
}

// Low side angle from the grass side of the road, looking under the roof at the stopped car.
await clip('layby-stopped-side', 18, 0.42, Math.PI / 2, 0.35)
// Straight down, so the roof footprint and the asphalt read as a plan.
await clip('layby-stopped-top', 24, 1.22, 0.2, 0.2)

await browser.close()
console.log('done', sha)
