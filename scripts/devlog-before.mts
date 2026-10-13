/** Capture before-fix evidence. One short video for the inspect/checklist overlap. */
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args })

const setup = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await setup.newPage()
await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.clear()
  sessionStorage.clear()
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.waitForTimeout(300)
await shot(page, 'BUG-004-land-cash')
await page.getByTestId('start-pax').click()
await page.waitForTimeout(600)
await page.getByTestId('tab-economy').click()
await page.waitForTimeout(200)
await page.getByTestId('starter-kit').click()
await page.waitForTimeout(400)
const close = page.locator('.panel-head button').filter({ hasText: /Close/i })
if (await close.isVisible().catch(() => false)) await close.click()
await page.getByRole('button', { name: /^3x$/ }).click()

let signed = false
for (let i = 0; i < 30 && !signed; i++) {
  const tab = page.locator('.letter-tab').filter({ hasText: /Contract/i }).first()
  if (await tab.isVisible().catch(() => false)) {
    await tab.click({ force: true })
    await page.waitForTimeout(150)
    const sign = page.locator('.letter-actions button').filter({ hasText: /^Sign$/ }).first()
    if (await sign.count()) {
      await sign.click({ force: true })
      signed = true
    }
  }
  await page.waitForTimeout(200)
}
console.log('signed', signed)

for (let i = 0; i < 40; i++) {
  const n = await page.evaluate(() => {
    const g = (window as unknown as { __hatch?: { flights: { length: number } } }).__hatch
    return g?.flights.length ?? 0
  })
  if (n > 0) break
  await page.waitForTimeout(250)
}

await page.evaluate(() => {
  const g = (window as unknown as { __hatch?: {
    speed: number
    flights: { x: number; y: number }[]
    setHover: (v: { c: number; r: number } | null) => void
    persist: () => void
  } }).__hatch!
  g.speed = 0
  const f = g.flights[0]
  if (f) g.setHover({ c: Math.round(f.x), r: Math.round(f.y) })
  g.persist()
})
await page.waitForTimeout(400)
await shot(page, 'BUG-001-before')

const beforeCam = await page.screenshot()
await page.keyboard.down('w')
await page.waitForTimeout(600)
await page.keyboard.up('w')
const afterCam = await page.screenshot()
const moved =
  createHash('sha256').update(beforeCam).digest('hex') !==
  createHash('sha256').update(afterCam).digest('hex')
console.log('paused WASD changed picture', moved)
await shot(page, 'BUG-cam-paused')

const saved = await page.evaluate(() => localStorage.getItem('apron-save-v25'))
await setup.close()

// Short clip: checklist covering the jet card, then dismiss to reveal it.
const clip = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
})
const vp = await clip.newPage()
await vp.goto('http://127.0.0.1:45217/', { waitUntil: 'domcontentloaded' })
await vp.evaluate((raw) => {
  localStorage.setItem('apron-save-v25', raw)
  sessionStorage.setItem('hatchfield-screen', 'play')
}, saved)
await vp.reload({ waitUntil: 'networkidle' })
await vp.waitForTimeout(600)
await vp.evaluate(() => {
  const g = (window as unknown as { __hatch?: {
    speed: number
    flights: { x: number; y: number }[]
    setHover: (v: { c: number; r: number } | null) => void
  } }).__hatch!
  g.speed = 1
  const f = g.flights[0]
  if (f) g.setHover({ c: Math.round(f.x), r: Math.round(f.y) })
})
await vp.waitForTimeout(1200)
await vp.getByRole('button', { name: /Got it/i }).click().catch(() => {})
await vp.waitForTimeout(1500)
const video = vp.video()
await clip.close()
if (video) await rename(await video.path(), `${OUT}/BUG-001-before.webm`)
console.log('video BUG-001-before')

// Fresh visit with a save skips the title.
const fresh = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const fp = await fresh.newPage()
await fp.goto('http://127.0.0.1:45217/', { waitUntil: 'domcontentloaded' })
await fp.evaluate((raw) => {
  localStorage.setItem('apron-save-v25', raw)
  sessionStorage.clear()
}, saved)
await fp.reload({ waitUntil: 'networkidle' })
await fp.waitForTimeout(700)
await shot(fp, 'BUG-004-before')
const onTitle = await fp.getByRole('heading', { name: 'Hatchfield' }).isVisible().catch(() => false)
console.log('fresh visit on title', onTitle)

// Cargo volume job vanishes on reload.
await fp.evaluate(() => {
  const g = (window as unknown as { __hatch?: {
    cargoVolume: unknown
    clock: number
    signed: string[]
    emit: () => void
    persist: () => void
  } }).__hatch!
  g.cargoVolume = {
    id: 'vol-devlog',
    airline: g.signed[0] ?? 'upps',
    targetUnits: 40,
    delivered: 12,
    fee: 8000,
    deadline: g.clock + 90,
    age: 1,
  }
  g.emit()
  g.persist()
})
await fp.waitForTimeout(400)
await shot(fp, 'BUG-003-before')
await fp.reload({ waitUntil: 'networkidle' })
await fp.waitForTimeout(500)
await shot(fp, 'BUG-003-before-reload')
const vol = await fp.evaluate(() => {
  const g = (window as unknown as { __hatch?: { cargoVolume: unknown } }).__hatch
  return g?.cargoVolume ?? null
})
console.log('volume after reload', vol)

// Guest card code words.
await fp.evaluate(() => {
  const g = (window as unknown as { __hatch?: {
    fits: unknown[]
    setView: (v: string) => void
    hallGuests: { id: string }[]
    selectedGuest: string | null
    emit: () => void
  } }).__hatch!
  if (g.fits.length) g.setView('hall')
  g.selectedGuest = g.hallGuests[0]?.id ?? null
  g.emit()
})
await fp.waitForTimeout(500)
await shot(fp, 'BUG-005-before')
await fresh.close()
await browser.close()
console.log('before media done')
