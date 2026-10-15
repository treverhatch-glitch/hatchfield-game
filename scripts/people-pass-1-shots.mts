/**
 * Prefab hall and apron stills for the people pass.
 * Dev server: `npx vite --host 127.0.0.1 --port 45217`
 * Usage: SHOT_TAG=before SHOT_ONLY=apron npx tsx scripts/people-pass-1-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/screens/people-pass-1'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.argv[2] || process.env.SHOT_TAG || 'after'
const ONLY = process.env.SHOT_ONLY || 'all'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(
  call(
    `localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high'); localStorage.setItem('hatchfield-texture-quality', 'high')`,
  ),
)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
const dock = page.getByTestId('starter-kit-dock')
if (await dock.count()) await dock.click({ timeout: 15000 })
else await page.evaluate(call('window.__hatch.buildStarterKit()'))
await page.evaluate(call('window.__hatch.speed = 8'))

if (ONLY !== 'hall') {
  await page.evaluate(call('window.__hatch.setView("apron")'))
  const hold = call(`
    const g = window.__hatch
    const w = window.__world
    if (!w) return null
    if (!w.__crewWrapped) {
      const origPlace = w.placeCam.bind(w)
      w.placeCam = function () {
        const lock = w.__crewLock
        if (!lock) return origPlace()
        w.camera.position.set(lock.cx, lock.cy, lock.cz)
        w.camera.lookAt(lock.tx, lock.ty, lock.tz)
        w.camera.updateMatrixWorld()
      }
      const gl = w.renderer.render.bind(w.renderer)
      w.renderer.render = function (scene, camera) {
        if (w.__crewLock) w.placeCam()
        return gl(scene, camera)
      }
      w.__crewWrapped = true
    }
    const scene = g.crewScene()
    const crew = scene.people.filter((p) => p.service !== 'pax')
    const fuel = crew.filter((p) => p.service === 'fuel')
    const focus = fuel.length ? fuel : crew
    const jobs = scene.jobs.filter((j) => j.service !== 'pax')
    if (!focus.length) return { crew: 0, jobs: jobs.map((j) => j.service + ':' + j.step) }
    const CELL = 22 * 0.45
    const HALF = 15.5
    const wx = (c) => (c - HALF) * CELL
    const wz = (r) => (r - HALF) * CELL
    let px = 0
    let pz = 0
    for (const p of focus) { px += wx(p.c); pz += wz(p.r) }
    px /= focus.length
    pz /= focus.length
    const flight = g.flights.find((f) => f.stand)
    const acx = flight ? wx(flight.x) : px
    const acz = flight ? wz(flight.y) : pz
    let dx = px - acx
    let dz = pz - acz
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    let sx = -dz
    let sz = dx
    const away = (px - acx) * sx + (pz - acz) * sz
    if (away < 0) { sx = -sx; sz = -sz }
    const dist = ${TAG === 'before' ? 4.2 : 2.4}
    g.speed = 1
    w.__crewLock = { cx: px + sx * dist, cy: ${TAG === 'before' ? 1.7 : 1.15}, cz: pz + sz * dist, tx: px, ty: 0.55, tz: pz }
    w.goalTo = null
    w.placeCam()
    return { crew: focus.length, service: focus[0].service, jobs: jobs.map((j) => j.service + ':' + j.step) }
  `)
  let apron: { crew: number; service?: string; jobs?: string[] } | null = null
  for (let i = 0; i < 400; i++) {
    apron = (await page.evaluate(hold)) as typeof apron
    if (apron && apron.crew > 0) break
    if (i % 20 === 0) console.log('waiting', JSON.stringify(apron))
    await page.waitForTimeout(300)
  }
  console.log('apron', JSON.stringify(apron))
  await page.waitForTimeout(900)
  const apronDraw = await page.evaluate(
    call(`const w = window.__world
      const crew = w.scene.getObjectByName('ground-crew')
      const torso = crew && crew.getObjectByName('people-torso')
      const cam = w.camera.position
      return { cam: [cam.x, cam.y, cam.z].map((n) => Math.round(n * 10) / 10), torso: torso ? torso.count : -1, lock: w.__crewLock }`),
  )
  console.log('apron-draw', JSON.stringify(apronDraw))
  await page.locator('canvas.field').screenshot({ path: `${OUT}/${TAG}-apron.png` })
}

if (ONLY !== 'apron') {
  await page.evaluate(call('window.__hatch.speed = 8'))
  for (let i = 0; i < 80; i++) {
    const queued = await page.evaluate(
      call(`const m = window.__hatch.hallNav.metrics()
        return m.some((row) => (row.kind === 'checkin_desk' || row.kind === 'security_lane' || row.kind === 'shop_counter') && row.queueLength > 0)`),
    )
    if (queued) break
    await page.waitForTimeout(400)
  }
  await page.evaluate(call('window.__hatch.speed = 1'))
  await page.evaluate(call('window.__hatch.setView("hall")'))
  await page.waitForFunction(() => Boolean((window as unknown as { __hall?: { placeCam?: () => void } }).__hall?.placeCam), null, {
    timeout: 20000,
  })
  async function hallShot(zone: string, kind: string, file: string) {
    const aimed = await page.evaluate(
      call(`const g = window.__hatch
        const h = window.__hall
        g.speed = 1
        const metrics = g.hallNav.metrics().filter((m) => m.kind === ${JSON.stringify(kind)} && m.line && m.line.length)
        const row = metrics.find((m) => m.queueLength > 0) || metrics[0]
        const origin = g.hallNav.origin()
        const spot = row ? row.line[Math.min(2, row.line.length - 1)] : { x: 0, z: 0 }
        h.goalTo = null
        h.pivot.set(spot.x + origin.x, 0, spot.z + origin.z)
        h.dist = ${TAG === 'before' ? 14 : 8}
        h.pitch = ${TAG === 'before' ? 0.72 : 0.42}
        h.yaw = 0.85
        h.placeCam()
        const torso = h.navCrowd.group.getObjectByName('people-torso')
        const cam = h.camera.position
        return {
          spot: row ? row.kind + ':' + row.id : 'none',
          queue: row ? row.queueLength : 0,
          dist: h.dist,
          cam: [cam.x, cam.y, cam.z].map((n) => Math.round(n * 10) / 10),
          heads: h.navCrowd.stats.heads,
          bodies: h.navCrowd.stats.bodies,
          torso: torso ? torso.count : -1,
        }`),
    )
    console.log('hall', zone, JSON.stringify(aimed))
    await page.waitForTimeout(600)
    const drawn = await page.evaluate(
      call(`const h = window.__hall
        h.goalTo = null
        h.placeCam()
        const torso = h.navCrowd.group.getObjectByName('people-torso')
        return { heads: h.navCrowd.stats.heads, bodies: h.navCrowd.stats.bodies, torso: torso ? torso.count : -1, dist: h.dist }`),
    )
    console.log('hall-draw', zone, JSON.stringify(drawn))
    await page.locator('canvas.hall-canvas').screenshot({ path: `${OUT}/${file}` })
  }
  await hallShot('checkin', 'checkin_desk', `${TAG}-checkin.png`)
  await hallShot('security', 'security_lane', `${TAG}-security.png`)
  await hallShot('retail', 'shop_counter', `${TAG}-food.png`)
}

console.log('errors', errors.slice(0, 8))
await browser.close()
if (errors.length) process.exitCode = 1
