/**
 * Hall-view stills of the interior spaces. Start Vite first:
 *   npx vite --host 127.0.0.1 --port 45217
 *   SHOT_TAG=before npx tsx scripts/interior-shots.mts
 *
 * Browser snippets are `new Function` strings so the bundler does not inject
 * helpers the page does not have.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media/interiors'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.argv[2] || process.env.SHOT_TAG || 'after'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(
  call(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('hatchfield-gfx', 'high');
    localStorage.setItem('hatchfield-texture-quality', 'high')`),
)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
const dock = page.getByTestId('starter-kit-dock')
if (await dock.count()) await dock.click()
else {
  await page.getByTestId('menu-money').click()
  await page.getByTestId('tab-overview').click()
  await page.getByTestId('starter-kit').click()
}
await page.evaluate(call(`window.__hatch.setView('hall')`))
await page.waitForFunction(
  call(`const h = window.__hall
    return !!(h && h.interior && h.interior.plan && h.interior.plan.rooms && h.interior.plan.rooms.rooms.length)`),
  { timeout: 25000 },
)
await page.waitForTimeout(1500)
await page.addStyleTag({ content: 'body * { visibility: hidden !important } canvas.hall-canvas { visibility: visible !important }' })

const names = (await page.evaluate(
  call(`const hall = window.__hall
    const rooms = hall.interior.plan.rooms.rooms
    const has = (k) => rooms.some((r) => r.kind === k)
    const list = ['arrivals', 'checkin', 'food_court', 'gate_seating', 'office', 'lounge', 'restrooms', 'baggage_claim', 'jet_bridge']
    return list.filter((name) => {
      if (name === 'arrivals' || name === 'checkin' || name === 'baggage_claim') return has('checkin')
      if (name === 'food_court') return has('shops')
      if (name === 'gate_seating') return has('gate')
      if (name === 'office') return has('office')
      if (name === 'lounge') return has('airside')
      if (name === 'restrooms') return hall.interior.plan.props.some((p) => p.kind === 'wc')
      if (name === 'jet_bridge') return !!hall.jetBridge
      return false
    })`),
)) as string[]

const AIM = `const hall = window.__hall
const game = window.__hatch
game.camGoal = null
hall.goalTo = null
const fit = hall.interiorFit
const rooms = hall.interior.plan.rooms.rooms
const biggest = (kind) => rooms.filter((r) => r.kind === kind).sort((a, b) => b.squares.length - a.squares.length)[0]
const aim = (x, z, yaw, pitch, dist) => {
  hall.pivot.set((x - fit.cx) * fit.scale, 0, (z - fit.cz) * fit.scale)
  hall.yaw = yaw
  hall.pitch = pitch
  hall.dist = dist
  hall.placeCam()
}
const shot = __SHOT__
const center = rooms.reduce((a, r) => ({ x: a.x + r.x, z: a.z + r.z, n: a.n + 1 }), { x: 0, z: 0, n: 0 })
center.x /= center.n; center.z /= center.n
const face = (r) => Math.atan2(center.x - r.x, center.z - r.z)
const dress = hall.interior.root.getObjectByName('interior-dressing')
const anchors = (dress && dress.userData.anchors) || {}
if (shot === 'arrivals') { const p = anchors.arrivals || biggest('checkin'); if (p) aim(p.x, p.z, face(p), 0.28, 8) }
else if (shot === 'checkin') { const r = biggest('checkin'); if (r) aim(r.x, r.z, face(r) + 0.8, 0.22, 8) }
else if (shot === 'food_court') { const r = biggest('shops'); if (r) aim(r.x, r.z, face(r), 0.32, 7) }
else if (shot === 'gate_seating') { const r = biggest('gate'); if (r) aim(r.x, r.z, face(r), 0.34, 7) }
else if (shot === 'office') { const p = anchors.office || biggest('office'); if (p) aim(p.x, p.z, face(p), 0.38, 7) }
else if (shot === 'lounge') { const p = anchors.lounge || biggest('airside'); if (p) aim(p.x, p.z, face(p), 0.3, 8) }
else if (shot === 'restrooms') { const wc = hall.interior.plan.props.find((p) => p.kind === 'wc'); if (wc) aim(wc.x, wc.z, 0.4, 0.4, 6) }
else if (shot === 'jet_bridge' && hall.jetBridge) {
  hall.pivot.set(hall.jetBridge.position.x, 1.4, hall.jetBridge.position.z)
  hall.yaw = hall.jetBridge.rotation.y + 0.7
  hall.pitch = 0.16
  hall.dist = 14
  hall.placeCam()
} else if (shot === 'baggage_claim') { const p = anchors.claim || biggest('checkin'); if (p) aim(p.x, p.z, face(p) + 1.2, 0.32, 8) }
return { shot, dist: hall.dist, cam: hall.camera.position.toArray(), pivot: hall.pivot.toArray(), bridge: !!hall.jetBridge }`

for (const name of names) {
  const aimed = await page.evaluate(call(AIM.replace('__SHOT__', JSON.stringify(name))))
  console.log('aim', JSON.stringify(aimed))
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}-${TAG}.png` })
  console.log('shot', name)
}
console.log('names', names)
console.log('errors', errors.slice(0, 8))
await browser.close()
