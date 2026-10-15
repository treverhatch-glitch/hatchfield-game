// Passenger wiring stills and the follow clip: npx tsx scripts/pax-wire-shots.mts [stills|clip]
// Starter kit -> Terminal view. Stills: hover tooltip, forecast card, close-ups at full detail, FPS.
// Clip: one passenger followed from the curb door to the gate. Writes to PAX_WIRE_OUT (default docs/devlog/media/pax-wire).
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync, renameSync, readdirSync } from 'node:fs'

const mode = process.argv[2] ?? 'stills'
const out = process.env.PAX_WIRE_OUT ?? 'docs/devlog/media/pax-wire'
mkdirSync(out, { recursive: true })
const server = await createServer({ server: { port: 45231, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=default'] })
const size = { width: 1280, height: 720 }
const ctx = await browser.newContext({ viewport: size, ...(mode === 'clip' ? { recordVideo: { dir: `${out}/_video`, size } } : {}) })
const page = await ctx.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))

async function fps(p: Page, secs = 4): Promise<{ min: number; avg: number }> {
  return p.evaluate(`new Promise((res) => {
    const wins = []; let frames = 0; let t0 = performance.now()
    function step(now) { frames++; if (now - t0 >= 1000) { wins.push((frames * 1000) / (now - t0)); frames = 0; t0 = now }
      if (wins.length < ${secs}) requestAnimationFrame(step); else res({ min: Math.min(...wins), avg: wins.reduce((a, b) => a + b, 0) / wins.length }) }
    requestAnimationFrame(step) })`)
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
await page.waitForFunction(() => (window as any).__hatch.offer, null, { timeout: 60000, polling: 250 })
await page.evaluate(() => { const g = (window as any).__hatch; g.acceptOffer(); g.closeNegotiationPanel?.() })
const clear = async () => {
  await page.evaluate(`window.__hatch.closeNegotiationPanel?.()`)
  await page.waitForTimeout(300)
}

/** Screen position of a walker, same projection the hover pick uses. */
const screenOf = (id: string) =>
  page.evaluate((id) => {
    const w = (window as any).__hall
    const g = (window as any).__hatch
    const at = g.hallNav.locate(id)
    if (!at) return null
    const rect = w.renderer.domElement.getBoundingClientRect()
    const v = w.proj.clone().set(at.x, 1.1, at.z)
    v.project(w.camera)
    return { x: (v.x * 0.5 + 0.5) * rect.width + rect.left, y: (-v.y * 0.5 + 0.5) * rect.height + rect.top }
  }, id)

if (mode === 'stills') {
  // Real released passengers walk the hall; give the morning a few minutes to fill it.
  await page.evaluate(() => { (window as any).__hatch.speed = 3 })
  await page.waitForFunction(() => { const g = (window as any).__hatch; return g.hallNav.passengers >= 18 && !g.hallGuests.some((x: any) => x.preview) }, null, { timeout: 240000, polling: 250 })
  await page.evaluate(() => { (window as any).__hatch.speed = 1 })
  await clear()
  await page.evaluate(() => {
    const w = (window as any).__hall
    w.pivot.set(0, 0, 0)
    w.dist = 40
    w.pitch = 0.9
    w.placeCam()
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/hall-wide.png` })

  const ids: string[] = await page.evaluate(() => {
    const g = (window as any).__hatch
    return g.hallNav.nav.poses().map((p: any) => p.id)
  })
  // Frame the crowd close, then hover one passenger.
  const target = ids[Math.min(2, ids.length - 1)]
  await page.evaluate((id) => {
    const g = (window as any).__hatch
    const w = (window as any).__hall
    const at = g.hallNav.locate(id)
    w.pivot.set(at.x, 0, at.z)
    w.dist = 14
    w.pitch = 0.75
    w.placeCam()
  }, target)
  await page.waitForTimeout(600)
  const pos = await screenOf(target)
  if (pos) {
    await page.mouse.move(pos.x + 1, pos.y + 1)
    await page.mouse.move(pos.x, pos.y, { steps: 3 })
    await page.waitForSelector('[data-testid=walker-tip]', { timeout: 5000 })
  }
  const tip = await page.evaluate(() => document.querySelector('[data-testid=walker-tip]')?.textContent ?? null)
  await page.screenshot({ path: `${out}/hover-tooltip.png` })
  await page.mouse.move(5, 5)

  // Click the security lane's queue node: the card carries the throughput forecast.
  await page.evaluate(() => {
    const g = (window as any).__hatch
    g.selectFacility('security')
  })
  await page.waitForTimeout(500)
  const note = await page.evaluate(() => document.querySelector('[data-testid=building-note]')?.textContent ?? null)
  await page.screenshot({ path: `${out}/forecast-card.png` })
  await page.evaluate(() => (window as any).__hatch.selectFacility(null))

  // Many walkers up close, full detail for all of them.
  await page.evaluate(() => {
    const hn = (window as any).__hatch.hallNav
    for (let i = 0; i < 120; i++) hn.nav.spawn({ id: `wave-${i}`, gate: '', departAt: hn.navNow + 2700 + i })
    hn.roster++
  })
  await page.waitForTimeout(7000)
  await page.evaluate(() => {
    const w = (window as any).__hall
    w.pivot.set(-13, 0, -10)
    w.dist = 22
    w.pitch = 0.8
    w.placeCam()
  })
  await clear()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/crowd-close.png` })
  const stats = await page.evaluate(() => ({ ...(window as any).__hall.navCrowd.stats, tuning: { ...(window as any).__hall.navCrowd.tuning } }))
  const frame = await fps(page, 5)
  const report = { tip, note, stats, fps: frame, walkers: await page.evaluate(() => (window as any).__hatch.hallNav.count), errors }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} else {
  await page.evaluate(() => { (window as any).__hatch.speed = 3 })
  await page.waitForFunction(() => { const g = (window as any).__hatch; return g.hallNav.passengers >= 12 && !g.hallGuests.some((x: any) => x.preview) }, null, { timeout: 240000, polling: 250 })
  // Follow the passenger who just reached the curb: the youngest walker still outside the doors.
  const pick = await page.evaluate(() => {
    const g = (window as any).__hatch
    const nav = g.hallNav.nav
    const poses = nav.poses().filter((p: any) => p.phase !== 'done')
    return poses.length ? poses[poses.length - 1].id : null
  })
  if (!pick) throw new Error('no walker to follow')
  await page.evaluate((id) => {
    const g = (window as any).__hatch
    g.speed = 2
    g.closeNegotiationPanel?.()
    ;(window as any).__hall.setFollow(id)
    g.selectGuest(id)
  }, pick)
  const stops: string[] = []
  const t0 = Date.now()
  let last = ''
  let atGate = 0
  while (Date.now() - t0 < 170000) {
    const s = await page.evaluate((id) => {
      const g = (window as any).__hatch
      g.closeNegotiationPanel?.()
      const c = g.hallNav.guestCard(id)
      return c ? `${c.stop ?? 'boarding'}${c.airside ? ' (airside)' : ''} ${c.phase}` : 'gone'
    }, pick)
    if (s !== last) {
      stops.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${s}`)
      last = s
    }
    if (s === 'gone') break
    if (s.startsWith('gate')) {
      if (++atGate >= 14) break
    } else atGate = 0
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1500)
  writeFileSync(`${out}/follow-trace.json`, JSON.stringify({ id: pick, stops, errors }, null, 2))
  console.log(JSON.stringify({ id: pick, stops, errors }, null, 2))
}
await ctx.close()
if (mode === 'clip') {
  const f = readdirSync(`${out}/_video`).find((n) => n.endsWith('.webm'))
  if (f) renameSync(`${out}/_video/${f}`, `${out}/follow-passenger.webm`)
}
await browser.close()
await server.close()
if (errors.length) process.exit(1)
