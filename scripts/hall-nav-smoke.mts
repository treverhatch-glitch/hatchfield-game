// Terminal-view smoke for the paxnav walkers: npx tsx scripts/hall-nav-smoke.mts  (starts vite itself)
// Starter kit -> Terminal view -> walkers on the nav grid. Screenshots wide and up close,
// then FPS with the day-one crowd and with 1200 walkers. Writes to HALL_NAV_OUT (default ./hall-nav-out).
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = process.env.HALL_NAV_OUT ?? 'hall-nav-out'
const heavy = Number(process.env.HALL_NAV_PAX ?? 1200)
mkdirSync(out, { recursive: true })
const server = await createServer({ server: { port: 45221, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=default'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))

/** One-second FPS windows over `secs`; returns min and average. */
async function fps(secs = 4): Promise<{ min: number; avg: number }> {
  // A string, so tsx does not wrap the in-page closure in its own helpers.
  return page.evaluate(`new Promise((res) => {
    const wins = []
    let frames = 0
    let t0 = performance.now()
    function step(now) {
      frames++
      if (now - t0 >= 1000) {
        wins.push((frames * 1000) / (now - t0))
        frames = 0
        t0 = now
      }
      if (wins.length < ${secs}) requestAnimationFrame(step)
      else res({ min: Math.min(...wins), avg: wins.reduce((a, b) => a + b, 0) / wins.length })
    }
    requestAnimationFrame(step)
  })`)
}

await page.goto(base, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.waitForTimeout(400)
await page.getByTestId('start-pax').click()
await page.waitForTimeout(800)
await page.evaluate(() => {
  const g = (window as any).__hatch
  g.buildStarterKit()
  g.setView('hall')
  g.speed = 1
})
await page.waitForFunction(() => (window as any).__hall && (window as any).__hatch.hallNav.live, null, { timeout: 30000 })
// Time the glue on the main thread: the nav step in the sim tick, and the instanced crowd write.
await page.evaluate(`(() => {
  const g = window.__hatch, w = window.__hall
  const t = (window.__navMs = { tick: 0, draw: 0, frames: 0 })
  const tick = g.tickHallNav.bind(g)
  g.tickHallNav = (s) => { const a = performance.now(); tick(s); t.tick += performance.now() - a }
  const sync = w.navCrowd.sync.bind(w.navCrowd)
  w.navCrowd.sync = (n, c) => { const a = performance.now(); const r = sync(n, c); t.draw += performance.now() - a; t.frames++; return r }
})()`)
// Offer panels sit over the hall; close them so the shot is of the floor.
const clearPanels = async () => {
  await page.evaluate(`window.__hatch.closeNegotiationPanel?.()`)
  await page.waitForTimeout(400)
}
const navMs = async () => page.evaluate(`(() => { const t = window.__navMs; const r = { tickMs: t.tick / Math.max(1, t.frames), drawMs: t.draw / Math.max(1, t.frames) }; t.tick = t.draw = t.frames = 0; return r })()`)

// A morning wave so the queues read: 90 departures through the curb doors.
const spawnWave = (n: number, tag: string) =>
  page.evaluate(
    ({ n, tag }) => {
      const hn = (window as any).__hatch.hallNav
      for (let i = 0; i < n; i++) hn.nav.spawn({ id: `${tag}-${i}`, gate: '', departAt: hn.navNow + 2700 + i })
      hn.roster++
    },
    { n, tag },
  )
await spawnWave(90, 'wave')
await page.waitForTimeout(9000)
await navMs()
const calm = { ...(await fps()), ...(await navMs()) }
const stats = await page.evaluate(() => {
  const g = (window as any).__hatch
  return {
    walkers: g.hallNav.count,
    boarded: g.hallNav.boarded,
    clock: g.clock,
    drawn: (window as any).__hall.navDrawn,
    queues: g.hallNav.metrics().map((m: any) => ({ id: m.id, kind: m.kind, queue: m.queueLength, served: m.served, estWaitSec: Math.round(m.estWaitSec) })),
  }
})
await clearPanels()
await page.screenshot({ path: `${out}/hall-wide.png` })

// Up close on check-in and the security lane.
await page.evaluate(() => {
  const w = (window as any).__hall
  w.pivot.set(-13, 0, -10)
  w.dist = 20
  w.pitch = 0.8
  w.placeCam()
})
await page.waitForTimeout(800)
await clearPanels()
await page.screenshot({ path: `${out}/hall-close.png` })

// Same whole-hall camera with and without the heavy wave, so the walkers' own cost shows.
await page.evaluate(() => {
  const w = (window as any).__hall
  w.pivot.set(0, 0, 0)
  w.dist = 46
  w.pitch = 0.9
  w.placeCam()
})
await page.waitForTimeout(1000)
const wideBase = await fps()
await spawnWave(heavy, 'heavy')
await page.waitForTimeout(3000)
await navMs()
const loaded = { ...(await fps()), ...(await navMs()) }
const heavyCount = await page.evaluate(() => (window as any).__hatch.hallNav.count)
await clearPanels()
await page.screenshot({ path: `${out}/hall-heavy.png` })

const report = { calm: { ...calm, ...stats }, wideBase, heavy:{ ...loaded, walkers: heavyCount }, errors }
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
await server.close()
if (errors.length) process.exit(1)
