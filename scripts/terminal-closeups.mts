/**
 * Close-ups of passengers inside the terminal, plus a short apron frame-rate sample.
 * Dev server: `npx vite --port 45217`, then `npx tsx scripts/terminal-closeups.mts`.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

function call(body: string) {
  return new Function(body) as () => unknown
}

async function fps(page: Page, ms = 3000): Promise<{ min: number; avg: number }> {
  return page.evaluate(
    new Function(
      'duration',
      `return new Promise((resolve) => {
        const gaps = []
        const start = performance.now()
        let last = start
        const step = (now) => {
          gaps.push(now - last)
          last = now
          if (now - start < duration) requestAnimationFrame(step)
          else {
            const worst = Math.max(...gaps.slice(1))
            resolve({ min: Math.round(1000 / worst), avg: Math.round((gaps.length * 1000) / (now - start)) })
          }
        }
        requestAnimationFrame(step)
      })`,
    ) as (duration: number) => Promise<{ min: number; avg: number }>,
    ms,
  )
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call('localStorage.clear(); sessionStorage.clear()'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/terminal-pack4-title.png` })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()

await page.evaluate(call('window.__hatch.speed = 5'))
for (let i = 0; i < 40; i++) {
  const ready = await page.evaluate(
    call(`
      const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.hallGuests.length > 8
    `),
  )
  if (ready) break
  await page.waitForTimeout(500)
}
console.log('apron fps', JSON.stringify(await fps(page, 4000)))

console.log('apron fps settled', JSON.stringify(await fps(page, 4000)))
await page.evaluate(call(`localStorage.setItem('hatchfield-gfx', 'high'); window.__hatch.setView('hall'); window.__hatch.speed = 1`))
await page.waitForFunction(() => Boolean((window as unknown as { __hall?: { guests: Map<string, unknown> } }).__hall))
await page.waitForTimeout(2500)
const pack = await page.evaluate(
  call(`
    const hall = window.__hall
    const map = hall.terminalShared.surfaces.maps.wall
    const img = map && map.image
    return {
      hasLoad: typeof hall.terminalShared.surfaces.loadPack1,
      ctor: img && img.constructor && img.constructor.name,
      w: img && img.width,
      src: img && img.src,
      view: window.__hatch.view,
    }
  `),
)
console.log('pack probe', JSON.stringify(pack))
await page.waitForTimeout(800)
const aimed = await page.evaluate(
  call(`
    const hall = window.__hall
    hall.pivot.set(0, 0, 0)
    hall.dist = 42
    hall.pitch = 0.52
    hall.placeCam()
    return hall.guests.size
  `),
)
console.log('hall guests', aimed)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.hall-canvas { visibility: visible !important }',
})
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/terminal-materials-hall.png` })

const framed = await page.evaluate(
  call(`
    const hall = window.__hall
    const guests = [...hall.guests.values()].sort((a, b) => Math.hypot(a.position.x, a.position.z) - Math.hypot(b.position.x, b.position.z))
    const guest = guests[0]
    const at = guest?.position ?? { x: 0, y: 0, z: 0 }
    hall.pivot.set(at.x, 0, at.z)
    hall.dist = 8
    hall.pitch = 0.28
    hall.placeCam()
    if (!guest) return null
    const feet = guest.position.clone()
    const head = feet.clone()
    head.y += 1.78 * guest.scale.y
    feet.project(hall.camera)
    head.project(hall.camera)
    return { x: at.x, z: at.z, span: Math.abs(head.y - feet.y), scale: guest.scale.y }
  `),
)
console.log('passenger frame', JSON.stringify(framed))
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/terminal-materials-passengers.png` })

async function aimRoom(kind: string, dist: number) {
  const at = await page.evaluate(
    call(`
      const hall = window.__hall
      const room = hall.roomPlan.rooms.find((r) => r.kind === ${JSON.stringify(kind)})
      const fit = hall.interiorFit
      const x = (room.x - fit.cx) * fit.scale
      const z = (room.z - fit.cz) * fit.scale
      hall.pivot.set(x, 1.15, z)
      hall.dist = ${dist}
      hall.pitch = 0.38
      hall.yaw = 0.6
      hall.placeCam()
      return { x, z, label: room.label }
    `),
  )
  console.log('aim', kind, JSON.stringify(at))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/terminal-pack1-${kind}.png` })
}

await aimRoom('checkin', 7)
await aimRoom('security', 7)
await aimRoom('gate', 6.5)
const gateSign = await page.evaluate(
  call(`
    const hall = window.__hall
    let sign = null
    hall.scene.traverse((o) => {
      if (!sign && o.name === 'gate-sign') sign = o
    })
    const logo = hall.terminalShared.surfaces.airline[0]
    const img = logo && logo.image
    if (!sign) return { logoW: img && img.width, missing: true }
    const p = hall.camera.position.clone()
    sign.getWorldPosition(p)
    const q = hall.camera.quaternion.clone()
    sign.getWorldQuaternion(q)
    const n = new p.constructor(0, 0, 1).applyQuaternion(q)
    hall.pivot.set(p.x, p.y, p.z)
    hall.yaw = Math.atan2(n.x, n.z)
    hall.pitch = 0.02
    hall.dist = 3.2
    hall.placeCam()
    return { x: p.x, y: p.y, z: p.z, logoW: img && img.width, src: img && img.src }
  `),
)
console.log('gate sign', JSON.stringify(gateSign))
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/terminal-pack4-gate.png` })
await aimRoom('shops', 7)
await aimRoom('office', 6)

const inside = await page.evaluate(
  call(`
    const hall = window.__hall
    const room = hall.roomPlan.rooms.find((r) => r.kind === 'checkin')
    const fit = hall.interiorFit
    const x = (room.x - fit.cx) * fit.scale
    const z = (room.z - fit.cz) * fit.scale
    hall.pivot.set(x, 1.6, z)
    hall.dist = 4.2
    hall.pitch = 0.22
    hall.yaw = 0.4
    hall.placeCam()
    if (hall.interior) hall.interior.ceilingForce = true
    return { y: hall.camera.position.y, ceil: hall.interior && hall.interior.ceilingForce }
  `),
)
console.log('inside', JSON.stringify(inside))
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/terminal-pack4-counter.png` })

const facade = await page.evaluate(
  call(`
    const hall = window.__hall
    const mark = hall.scene.getObjectByName('hatchfield-logo')
    if (!mark) return null
    hall.pivot.set(mark.position.x + 6, 1.6, mark.position.z)
    hall.dist = 8
    hall.pitch = 0.28
    hall.yaw = -1.57
    hall.placeCam()
    return { x: mark.position.x, y: mark.position.y, z: mark.position.z }
  `),
)
console.log('facade', JSON.stringify(facade))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/terminal-pack4-facade.png` })
console.log('wrote', OUT)
await browser.close()
