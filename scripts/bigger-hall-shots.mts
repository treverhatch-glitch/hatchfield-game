/**
 * Bigger-hall stills from a running game.
 * Start the dev server first: `npx vite --host 127.0.0.1 --port 45217`
 * Usage: npx tsx scripts/bigger-hall-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media/bigger-hall'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME && existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'med')`))
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('starter-kit-dock').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.waitForTimeout(600)

await page.getByTestId('build-terminal').click()
await page.getByTestId('build-group-halls').click()
await page.getByTestId('tray-note-prefab_ii').waitFor()
const hallNote = await page.getByTestId('tray-note-prefab_ii').innerText()
if (!hallNote.includes('carriers')) throw new Error(`prefab note missing headroom: ${hallNote}`)
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/build-menu-hall.png` })

await page.getByTestId('build-terminal').click()
await page.getByTestId('menu-operations').click()
await page.getByTestId('tab-stands').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/stands-headroom.png` })
await page.getByTestId('panel-close').click()

await page.evaluate(call('window.__hatch.speed = 8'))
let refused = false
for (let i = 0; i < 500; i++) {
  refused = await page.evaluate(
    call(`const g = window.__hatch
      if (!g.offer) return false
      const gate = g.checkinSignReport(g.offer.airline)
      if (gate.ok) { g.acceptOffer(); return false }
      return true`),
  )
  if (refused) break
  await page.waitForTimeout(200)
}
await page.evaluate(call('window.__hatch.speed = 0'))
if (!refused) throw new Error('no refused carrier offer appeared')
const desks = page.getByTestId('negotiation-desks')
await desks.waitFor()
const deskText = await desks.innerText()
if (!deskText.toLowerCase().includes('expand the hall')) throw new Error(`offer card missing refuse: ${deskText}`)
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/offer-refuse.png` })

await page.getByTestId('phone-peek').click()
await page.getByTestId('phone-tab-contracts').click()
const phoneCard = page.getByTestId('phone-card-contract-file')
await phoneCard.waitFor()
const phoneText = await phoneCard.innerText()
if (!phoneText.toLowerCase().includes('expand the hall')) throw new Error(`phone missing refuse: ${phoneText}`)
const sign = page.getByTestId('phone-action-contract-sign')
if (!(await sign.isDisabled())) throw new Error('phone sign button stayed enabled')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/phone-refuse.png` })
await page.getByTestId('phone-close').click()

await page.evaluate(
  call(`const g = window.__hatch
    g.fieldXp = 220
    g.cash = Math.max(g.cash, 80000)
    if (!g.researchTree.state.unlocked.includes('terminal-2')) g.researchTree.state.unlocked.push('terminal-2')
    g.offer = null
    return g.fieldLevel()`),
)
await page.getByTestId('menu-operations').click()
await page.getByTestId('tab-stands').click()
await page.getByTestId('expand-hall').click()
await page.waitForTimeout(600)
const tier = await page.evaluate(call('window.__hatch.fits[0].tier'))
if (tier < 2) throw new Error(`hall did not expand, tier ${tier}`)
await page.screenshot({ path: `${OUT}/stands-after-expand.png` })
await page.getByTestId('panel-close').click()
await page.evaluate(call('window.__hatch.setView("hall")'))
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/hall-after-expand.png` })

console.log('errors', errors.slice(0, 8))
await browser.close()
