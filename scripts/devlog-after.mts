/** After-fix stills, the one overlap clip, and a 2–4 min playthrough. */
import { mkdirSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { chromium, type Browser, type Page } from 'playwright'
import { Game } from '../src/game/sim.ts'
import { SAVE_KEY } from '../src/game/types.ts'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

function stubStorage() {
  const mem = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  return mem
}

function assertFixes() {
  const mem = stubStorage()
  const g = new Game()
  g.sandbox = true
  g.beginNew('easy')
  g.startFocus = 'pax'
  g.buyLand('city')
  g.buildStarterKit()
  g.signed.push('northline')
  g.cargoVolume = {
    id: 'vol-devlog',
    airline: 'northline',
    targetUnits: 40,
    delivered: 12,
    fee: 8000,
    deadline: 90,
    age: 1,
  }
  g.persist()
  if (!mem.get(SAVE_KEY)?.includes('vol-devlog')) throw new Error('cargoVolume not in save JSON')
  const g2 = new Game()
  if (!g2.load() || g2.cargoVolume?.id !== 'vol-devlog') throw new Error('cargoVolume did not load')
  g2.beginNew('easy')
  if (mem.get(SAVE_KEY)) throw new Error('beginNew left the save in place')
  console.log('node: cargoVolume round-trips; beginNew clears save')
}

assertFixes()

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
}

async function kitAndSign(page: Page) {
  await page.getByTestId('new-game').click()
  await page.waitForTimeout(250)
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(500)
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(200)
  await page.getByTestId('starter-kit').click()
  await page.waitForTimeout(300)
  const close = page.locator('.panel-head button').filter({ hasText: /Close/i })
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.getByRole('button', { name: /^3x$/ }).click()
  for (let i = 0; i < 30; i++) {
    const tab = page.locator('.letter-tab').filter({ hasText: /Contract/i }).first()
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true })
      const sign = page.locator('.letter-actions button').filter({ hasText: /^Sign$/ }).first()
      if (await sign.count()) {
        await sign.click({ force: true })
        return
      }
    }
    await page.waitForTimeout(200)
  }
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args })

const setupCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const setup = await setupCtx.newPage()
await boot(setup)
await kitAndSign(setup)
for (let i = 0; i < 40; i++) {
  const n = await setup.evaluate(() => {
    const g = (window as unknown as { __hatch?: { flights: unknown[] } }).__hatch
    return g?.flights.length ?? 0
  })
  if (n > 0) break
  await setup.waitForTimeout(250)
}
await setup.evaluate(() => {
  const g = (window as unknown as { __hatch?: { speed: number; persist: () => void } }).__hatch!
  g.speed = 0
  g.persist()
})
const saved = await setup.evaluate(() => localStorage.getItem('apron-save-v25'))
if (!saved) throw new Error('no save to reload')

// Overlap fix clip — checklist and jet card side by side.
const clip = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
})
const vp = await clip.newPage()
await vp.goto(URL, { waitUntil: 'domcontentloaded' })
await vp.evaluate((raw) => {
  localStorage.setItem('apron-save-v25', raw)
  sessionStorage.setItem('hatchfield-screen', 'play')
}, saved)
await vp.reload({ waitUntil: 'networkidle' })
await vp.waitForTimeout(500)
await vp.evaluate(() => {
  const g = (window as unknown as { __hatch?: {
    speed: number
    flights: { x: number; y: number }[]
    setHover: (v: { c: number; r: number }) => void
  } }).__hatch!
  g.speed = 1
  const f = g.flights[0]
  if (f) g.setHover({ c: Math.round(f.x), r: Math.round(f.y) })
})
await vp.waitForTimeout(1800)
await shot(vp, 'BUG-001-after')
await vp.waitForTimeout(1600)
const video = vp.video()
await clip.close()
if (video) await rename(await video.path(), `${OUT}/BUG-001-after.webm`)
console.log('video BUG-001-after')

// Fresh visit shows the title.
const fresh = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const fp = await fresh.newPage()
await fp.goto(URL, { waitUntil: 'domcontentloaded' })
await fp.evaluate((raw) => {
  localStorage.setItem('apron-save-v25', raw)
  sessionStorage.clear()
}, saved)
await fp.reload({ waitUntil: 'networkidle' })
await fp.waitForTimeout(600)
await shot(fp, 'BUG-004-after')
const onTitle = await fp.getByRole('heading', { name: 'Hatchfield' }).isVisible().catch(() => false)
const hasContinue = await fp.getByTestId('continue-game').isVisible().catch(() => false)
console.log('title', onTitle, 'continue', hasContinue)
if (!onTitle || !hasContinue) throw new Error('title/continue not shown with a save')
await fresh.close()

// Volume job survives reload. Guest card uses room names.
await setup.evaluate(() => {
  const g = (window as unknown as { __hatch?: {
    cargoVolume: unknown
    clock: number
    signed: string[]
    emit: () => void
    persist: () => void
    speed: number
  } }).__hatch!
  const airline = g.signed[0] ?? 'northline'
  g.cargoVolume = {
    id: 'vol-after',
    airline,
    targetUnits: 40,
    delivered: 12,
    fee: 8000,
    deadline: g.clock + 120,
    age: 1,
  }
  g.speed = 5
  g.emit()
  g.persist()
  sessionStorage.setItem('hatchfield-screen', 'play')
})
await setup.reload({ waitUntil: 'networkidle' })
await setup.waitForTimeout(400)
const vol = await setup.evaluate(() => {
  const g = (window as unknown as { __hatch?: { cargoVolume: { id: string } | null } }).__hatch
  return g?.cargoVolume?.id ?? null
})
console.log('volume after reload', vol)
if (vol !== 'vol-after') throw new Error(`volume lost: ${vol}`)
await shot(setup, 'BUG-003-after')

await setup.evaluate(() => {
  const g = (window as unknown as { __hatch?: { speed: number; setView: (v: string) => void } }).__hatch!
  g.speed = 5
  g.setView('hall')
})
for (let i = 0; i < 24; i++) {
  const n = await setup.evaluate(() => {
    const g = (window as unknown as { __hatch?: { hallGuests: { id: string }[]; selectedGuest: string | null; emit: () => void } }).__hatch!
    if (g.hallGuests[0] && !g.selectedGuest) {
      g.selectedGuest = g.hallGuests[0].id
      g.emit()
    }
    return g.hallGuests.length
  })
  if (n > 0) break
  await setup.waitForTimeout(400)
}
await setup.waitForTimeout(400)
await shot(setup, 'BUG-005-after')
await setupCtx.close()

// Full morning playthrough.
const play = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
})
const pp = await play.newPage()
const t0 = Date.now()
await boot(pp)
await pp.waitForTimeout(2000)
await pp.getByTestId('new-game').click()
await pp.waitForTimeout(2000)
await pp.getByTestId('start-pax').click()
await pp.waitForTimeout(1800)
await pp.getByTestId('tab-economy').click()
await pp.waitForTimeout(800)
await pp.getByTestId('starter-kit').click()
await pp.waitForTimeout(1500)
const close = pp.locator('.panel-head button').filter({ hasText: /Close/i })
if (await close.isVisible().catch(() => false)) await close.click()
await pp.getByRole('button', { name: /^3x$/ }).click()
for (let i = 0; i < 24; i++) {
  const tab = pp.locator('.letter-tab').filter({ hasText: /Contract/i }).first()
  if (await tab.isVisible().catch(() => false)) {
    await tab.click({ force: true })
    await pp.waitForTimeout(400)
    const sign = pp.locator('.letter-actions button').filter({ hasText: /^Sign$/ }).first()
    if (await sign.count()) {
      await sign.click({ force: true })
      break
    }
  }
  await pp.waitForTimeout(250)
}
await pp.waitForTimeout(70_000)
await pp.getByRole('button', { name: /^Hall$/ }).click()
await pp.waitForTimeout(12_000)
await pp.keyboard.press('Escape')
await pp.waitForTimeout(1500)
await pp.getByTestId('tab-economy').click()
await pp.waitForTimeout(600)
const loan = pp.getByRole('button', { name: /Bridge loan/i }).first()
if (await loan.isVisible().catch(() => false)) await loan.click({ force: true })
await pp.waitForTimeout(2500)
if (await close.isVisible().catch(() => false)) await close.click()
await pp.getByTestId('tab-airlines').click()
await pp.waitForTimeout(4000)
await pp.getByRole('button', { name: /^5x$/ }).click()
await pp.waitForTimeout(28_000)
await pp.getByRole('button', { name: /^Pause$/ }).click()
await pp.waitForTimeout(1500)
const elapsed = Math.round((Date.now() - t0) / 1000)
console.log('playthrough wall seconds', elapsed)
const pv = pp.video()
await play.close()
if (pv) await rename(await pv.path(), `${OUT}/playthrough.webm`)
await browser.close()
console.log('after media done')
