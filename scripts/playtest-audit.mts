/**
 * Phase-1 playtest: both starts, letters, a full turn, hall, loan, every
 * menu, 5x soak, camera, one-click place. Screenshots land in docs/playtest/.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { Game } from '../src/game/sim.ts'
import { tilesOf } from '../src/game/path.ts'
import { SAVE_KEY } from '../src/game/types.ts'

const OUT = 'docs/playtest'
mkdirSync(OUT, { recursive: true })

const issues: string[] = []
const notes: string[] = []
const consoleErrors: string[] = []

function log(...args: unknown[]) {
  console.log(...args)
}

function stubStorage() {
  const mem = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v)
    },
    removeItem: (k) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  return mem
}

function simProbe() {
  stubStorage()
  const g = new Game()
  g.sandbox = true
  g.beginNew('easy')
  g.startFocus = 'pax'
  g.buyLand('city')
  g.buildStarterKit()

  const taxi0 = tilesOf(g.tiles, 'taxi').length
  g.setTool('taxi')
  let target = { c: 4, r: 4 }
  outer: for (let r = 2; r < 30; r++) {
    for (let c = 2; c < 30; c++) {
      if (g.tiles[r][c] === 'grass') {
        target = { c, r }
        break outer
      }
    }
  }
  g.clickTile(target)
  g.clickTile(target)
  const placed = tilesOf(g.tiles, 'taxi').length - taxi0
  if (placed !== 1) issues.push(`sim double-place: +${placed} taxi`)
  else notes.push('sim place-once +1 taxi')

  g.sandbox = false
  g.cash = 80_000
  g.takeLoanProduct('bridge')
  const opened = g.loanBalance
  g.speed = 5
  for (let i = 0; i < 800; i++) g.tick(0.25)
  if (g.loanBalance > opened * 1.5) {
    issues.push(`sim loan snowball ${opened} → ${g.loanBalance}`)
  } else notes.push(`sim loan ${opened} → ${Math.round(g.loanBalance)}`)
  if (!g.site) issues.push('sim loan cleared the field')

  // Fresh pax session: sign and watch phases.
  const p = new Game()
  p.sandbox = true
  p.beginNew('easy')
  p.startFocus = 'pax'
  p.buyLand('city')
  p.buildStarterKit()
  p.speed = 5
  const seen = new Set<string>()
  let peak = { flights: 0, trucks: 0, people: 0, guests: 0 }
  const t0 = performance.now()
  let ticks = 0
  for (; ticks < 4000; ticks++) {
    if (p.offer && p.signed.length === 0) p.acceptOffer()
    p.tick(0.05)
    for (const f of p.flights) seen.add(f.phase)
    peak = {
      flights: Math.max(peak.flights, p.flights.length),
      trucks: Math.max(peak.trucks, p.trucks.length),
      people: Math.max(peak.people, p.people.length),
      guests: Math.max(peak.guests, p.hallGuests.length),
    }
    if (seen.has('takeoff') && p.flightsDone >= 1 && ticks > 400) break
  }
  const simMs = Math.round(performance.now() - t0)
  notes.push(
    `sim pax phases=${[...seen].join(',')} done=${p.flightsDone} ticks=${ticks} wall=${simMs}ms peak=${JSON.stringify(peak)} cash=${Math.round(p.cash)}`,
  )
  for (const ph of ['approach', 'landing', 'deboard', 'servicing', 'takeoff']) {
    if (!seen.has(ph)) issues.push(`sim pax never reached ${ph}`)
  }

  // Cargo start earns without a hall.
  const c = new Game()
  c.sandbox = false
  c.beginNew('standard')
  c.startFocus = 'cargo'
  c.buyLand('factory')
  const beforeKit = c.cash
  c.buildStarterKit()
  if (c.fits.length !== 0) issues.push(`cargo kit built a hall (${c.fits.length})`)
  if (!tilesOf(c.tiles, 'guard').length) issues.push('cargo kit missing guard')
  if (!tilesOf(c.tiles, 'cargo').length) issues.push('cargo kit missing shed')
  notes.push(`cargo kit ${beforeKit} → ${c.cash} guard=${tilesOf(c.tiles, 'guard').length}`)
  c.speed = 5
  const cargoPhases = new Set<string>()
  for (let i = 0; i < 4000; i++) {
    if (c.offer && c.signed.length === 0) c.acceptOffer()
    c.tick(0.05)
    for (const f of c.flights) cargoPhases.add(`${f.kind}:${f.phase}`)
    if (c.flightsDone >= 1) break
  }
  notes.push(
    `sim cargo done=${c.flightsDone} signed=${c.signed.join(',') || 'none'} phases=${[...cargoPhases].slice(0, 12).join('|')} wh=${c.cargoWarehouse}`,
  )
  if (c.flightsDone < 1) issues.push('sim cargo never completed a turnaround')

  // Save drops the live cargo-volume job.
  c.cargoVolume = {
    id: 'vol-test',
    airline: c.signed[0] ?? 'upps',
    targetUnits: 40,
    delivered: 10,
    fee: 5000,
    deadline: c.clock + 80,
    age: 2,
  }
  c.persist()
  const raw = globalThis.localStorage.getItem(SAVE_KEY) ?? ''
  const hasVol = raw.includes('vol-test')
  const c2 = new Game()
  c2.load()
  if (!hasVol || !c2.cargoVolume) {
    notes.push(
      `save omits cargoVolume (in json=${hasVol}, loaded=${c2.cargoVolume ? 'yes' : 'null'})`,
    )
  } else notes.push('cargoVolume round-trips')
  if (!c2.signed.length) issues.push('save/load dropped signed airlines')

  // New Game leaves the previous save in place.
  const hijack = new Game()
  hijack.sandbox = true
  hijack.beginNew('easy')
  const still = globalThis.localStorage.getItem(SAVE_KEY)
  notes.push(still ? 'beginNew leaves previous save' : 'beginNew clears save')
}

simProbe()

type HatchState = {
  cash: number
  speed: number
  clock: number
  flights: number
  phases: Record<string, number>
  trucks: number
  people: number
  guests: number
  signed: string[]
  loan: number
  sandbox: boolean
  focus: string
  warehouse: number
  view: string
  tool: string
  fits: number
  news: string[]
  fpsHint?: number
}

async function state(page: Page): Promise<HatchState | null> {
  return page.evaluate(() => {
    const g = (window as unknown as { __hatch?: Game }).__hatch
    if (!g) return null
    const phases: Record<string, number> = {}
    for (const f of g.flights) phases[f.phase] = (phases[f.phase] ?? 0) + 1
    return {
      cash: Math.round(g.cash),
      speed: g.speed,
      clock: Math.round(g.clock),
      flights: g.flights.length,
      phases,
      trucks: g.trucks.length,
      people: g.people.length,
      guests: g.hallGuests.length,
      signed: g.signed.slice(),
      loan: Math.round(g.loanBalance),
      sandbox: g.sandbox,
      focus: g.startFocus,
      warehouse: g.cargoWarehouse,
      view: g.view,
      tool: g.tool,
      fits: g.fits.length,
      news: g.news.slice(0, 4).map((n) => n.text),
    }
  })
}

async function fps(page: Page, ms = 1500): Promise<number> {
  // String body so the dev bundler does not inject a helper the page cannot see.
  return page.evaluate(
    new Function(
      'duration',
      `return new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const step = (now) => {
          frames += 1
          if (now - start < duration) requestAnimationFrame(step)
          else resolve(Math.round((frames * 1000) / (now - start)))
        }
        requestAnimationFrame(step)
      })`,
    ) as (duration: number) => Promise<number>,
    ms,
  )
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  notes.push(`shot ${name}`)
}

async function openTab(page: Page, id: string) {
  const btn = page.getByTestId(`tab-${id}`)
  const already = await btn.evaluate((b) => b.classList.contains('on')).catch(() => false)
  if (!already) {
    const openOther = page.locator('.info-menus button.on')
    if (await openOther.count()) {
      await openOther.first().click({ force: true })
      await page.waitForTimeout(120)
    }
    await btn.click({ force: true })
    await page.waitForTimeout(280)
  }
  const visible = await page.locator('.panel-rollout').isVisible().catch(() => false)
  const head = await page.locator('.panel-head h2').innerText().catch(() => '')
  const body = await page.locator('.panel-body').innerText().catch(() => '')
  if (!visible) issues.push(`tab ${id}: panel hidden`)
  else if (body.trim().length < 8) issues.push(`tab ${id}: empty body`)
  notes.push(`tab ${id}: ${head} (${body.trim().length} chars)`)
  await shot(page, `tab-${id}`)
}

async function signFirst(page: Page, label: string) {
  for (let i = 0; i < 40; i++) {
    const tab = page.locator('.letter-tab').filter({ hasText: /Contract/i }).first()
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true })
      await page.waitForTimeout(200)
      await shot(page, label)
      const sign = page.locator('.letter-actions button').filter({ hasText: /^Sign$/ }).first()
      if (await sign.count()) {
        await sign.click({ force: true })
        await page.waitForTimeout(250)
        return true
      }
    }
    await page.waitForTimeout(250)
  }
  return false
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text().slice(0, 300)}`)
})

const samples: { t: string; fps: number; state: HatchState | null }[] = []

try {
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await shot(page, '01-title')

  const sandbox = page.getByTestId('sandbox-toggle')
  const sandboxDefault = await sandbox.isChecked()
  notes.push(`sandbox default ${sandboxDefault ? 'on' : 'off'}`)
  if (!sandboxDefault) issues.push('sandbox not on by default')
  await sandbox.uncheck()
  await page.waitForTimeout(150)
  await shot(page, '02-title-sandbox-off')
  await sandbox.check()
  await page.waitForTimeout(150)
  await shot(page, '03-title-sandbox-on')

  if (!(await page.getByRole('heading', { name: 'Hatchfield' }).isVisible())) {
    issues.push('title heading missing')
  }
  await page.getByTestId('new-game').click()
  await page.waitForTimeout(400)
  await shot(page, '04-choose-start')
  const paxText = await page.getByTestId('start-pax').innerText()
  const cargoText = await page.getByTestId('start-cargo').innerText()
  for (const need of ['Runway', 'Stand', 'Terminal', 'Check-in', 'Security', 'Gate']) {
    if (!paxText.includes(need)) issues.push(`pax card missing ${need}`)
  }
  for (const need of ['Runway', 'Cargo stand', 'Truck gate', 'Shed', 'Warehouse']) {
    if (!cargoText.includes(need)) issues.push(`cargo card missing ${need}`)
  }

  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(800)
  await shot(page, '05-pax-empty')
  const hooked = await page.evaluate(
    () => Boolean((window as unknown as { __hatch?: unknown }).__hatch),
  )
  if (!hooked) issues.push('dev probe window.__hatch missing')

  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(300)
  await shot(page, '06-economy-before-kit')
  const kit = page.getByTestId('starter-kit')
  if (!(await kit.isVisible())) issues.push('starter kit button missing')
  else await kit.click()
  await page.waitForTimeout(500)
  await shot(page, '07-pax-starter')
  const afterKit = await state(page)
  notes.push(`after pax kit ${JSON.stringify(afterKit)}`)
  if (!afterKit?.fits) issues.push('pax starter did not place a hall')

  // Close panel so the field is visible.
  const close = page.locator('.panel-head button').filter({ hasText: /Close/i })
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.waitForTimeout(200)

  await page.getByRole('button', { name: /^3x$/ }).click()
  const signed = await signFirst(page, '08-pax-letter')
  if (!signed) issues.push('pax contract letter never signed')
  else notes.push('pax airline signed')
  await shot(page, '09-pax-signed')

  const want = ['approach', 'landing', 'servicing', 'takeoff'] as const
  const got = new Set<string>()
  for (let i = 0; i < 80 && got.size < want.length; i++) {
    const s = await state(page)
    const phases = Object.keys(s?.phases ?? {})
    for (const ph of phases) {
      if (want.includes(ph as (typeof want)[number]) && !got.has(ph)) {
        got.add(ph)
        await shot(page, `10-flight-${ph}`)
        notes.push(`saw ${ph} @ clock ${s?.clock} agents f${s?.flights}/t${s?.trucks}/p${s?.people}/g${s?.guests}`)
      }
    }
    if (s && (s.news.some((n) => /takeoff|airborne|departed/i.test(n)) || phases.includes('gone'))) {
      if (!got.has('takeoff')) {
        got.add('takeoff')
        await shot(page, '10-flight-takeoff')
      }
    }
    await page.waitForTimeout(400)
  }
  for (const ph of want) if (!got.has(ph)) issues.push(`browser never showed flight ${ph}`)

  // Hall
  await page.getByRole('button', { name: /^1x$/ }).click()
  await page.getByRole('button', { name: /^Hall$/ }).click()
  await page.waitForTimeout(900)
  await shot(page, '11-hall')
  const hall = await state(page)
  notes.push(`hall view=${hall?.view} guests=${hall?.guests}`)
  const hallChrome = await page.locator('.hall-chrome').innerText().catch(() => '')
  if (!/security/i.test(hallChrome)) issues.push(`hall chrome unexpected: ${hallChrome}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const back = await state(page)
  if (back?.view !== 'apron') issues.push(`Esc did not leave hall (view=${back?.view})`)

  // Loan
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(250)
  const beforeLoan = await state(page)
  const loanBtn = page.getByRole('button', { name: /Bridge loan/i }).first()
  if (!(await loanBtn.isVisible().catch(() => false))) issues.push('bridge loan button missing')
  else {
    await loanBtn.click({ force: true })
    await page.waitForTimeout(300)
  }
  await shot(page, '12-loan')
  const afterLoan = await state(page)
  notes.push(`loan ${beforeLoan?.cash} → ${afterLoan?.cash} owed ${afterLoan?.loan}`)
  if (!afterLoan?.loan) issues.push('loan balance stayed 0')
  if (afterLoan && beforeLoan && afterLoan.cash <= beforeLoan.cash) {
    issues.push('loan did not increase cash')
  }
  const clock0 = afterLoan?.clock ?? 0
  await page.getByRole('button', { name: /^5x$/ }).click()
  await page.waitForTimeout(1500)
  const clock1 = (await state(page))?.clock ?? 0
  if (clock1 <= clock0) issues.push(`clock stalled after loan (${clock0} → ${clock1})`)
  else notes.push(`clock after loan ${clock0} → ${clock1}`)

  for (const id of ['economy', 'budget', 'research', 'airlines', 'planner', 'services']) {
    await openTab(page, id)
  }

  // Build categories
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.waitForTimeout(150)
  for (const label of ['Pavement', 'Stands', 'Terminal', 'Ops', 'Landside', 'Bulldoze']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(200)
    await shot(page, `build-${label.toLowerCase()}`)
  }
  const move = await page.getByRole('button', { name: /^Move$/ }).count()
  if (move > 0) issues.push('legacy Move tool still present')

  // One canvas click must not stamp a runway of tiles: select taxi, click once.
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const place = await page.evaluate(() => {
    const g = (window as unknown as { __hatch?: Game }).__hatch!
    let grass = 0
    for (const row of g.tiles) for (const t of row) if (t === 'grass') grass++
    g.setTool('taxi')
    let hit = { c: 2, r: 2 }
    outer: for (let r = 2; r < 28; r++) {
      for (let c = 2; c < 28; c++) {
        if (g.tiles[r][c] === 'grass') {
          hit = { c, r }
          break outer
        }
      }
    }
    const before = g.tiles.flat().filter((t) => t === 'taxi').length
    g.clickTile(hit)
    g.clickTile(hit)
    const after = g.tiles.flat().filter((t) => t === 'taxi').length
    g.setTool('pan')
    return { before, after, grass }
  })
  notes.push(`clickTile double-fire ${place.before} → ${place.after}`)
  if (place.after - place.before !== 1) {
    issues.push(`one click placed ${place.after - place.before} taxi`)
  }
  await shot(page, '13-one-taxi')

  // WASD / arrows move the apron camera.
  await page.locator('canvas.field').click({ position: { x: 480, y: 320 }, force: true })
  await shot(page, '14-cam-before')
  const beforePng = await page.screenshot()
  await page.keyboard.down('w')
  await page.waitForTimeout(700)
  await page.keyboard.up('w')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.down('q')
  await page.waitForTimeout(400)
  await page.keyboard.up('q')
  await shot(page, '15-cam-after-wasd')
  const afterPng = await page.screenshot()
  const h1 = createHash('sha256').update(beforePng).digest('hex')
  const h2 = createHash('sha256').update(afterPng).digest('hex')
  if (h1 === h2) issues.push('WASD/arrows did not change the apron picture')
  else notes.push('camera picture changed after WASD')

  // 5x soak ~90s wall (~7.5 min sim)
  await page.getByRole('button', { name: /^5x$/ }).click()
  await shot(page, '16-5x-start')
  const soakMs = 90_000
  const step = 15_000
  for (let elapsed = 0; elapsed < soakMs; elapsed += step) {
    const f = await fps(page, 1200)
    const s = await state(page)
    samples.push({ t: `pax+${elapsed / 1000}s`, fps: f, state: s })
    log(`soak ${elapsed / 1000}s fps=${f} flights=${s?.flights} trucks=${s?.trucks} people=${s?.people} guests=${s?.guests} cash=${s?.cash}`)
    if (elapsed === 30_000) await shot(page, '17-5x-mid')
    await page.waitForTimeout(Math.max(0, step - 1200))
  }
  await shot(page, '18-5x-end')
  const end = await state(page)
  notes.push(`5x end ${JSON.stringify(end)}`)
  if (end && end.loan > 0 && end.loan > (afterLoan?.loan ?? 0) * 3) {
    issues.push(`loan blew up during 5x ${afterLoan?.loan} → ${end.loan}`)
  }

  // Cargo start
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByTestId('new-game').click()
  await page.waitForTimeout(300)
  await page.getByTestId('start-cargo').click()
  await page.waitForTimeout(700)
  await shot(page, '19-cargo-empty')
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(250)
  await page.getByTestId('starter-kit').click()
  await page.waitForTimeout(500)
  await shot(page, '20-cargo-starter')
  const cargoKit = await state(page)
  notes.push(`cargo kit ${JSON.stringify(cargoKit)}`)
  if (cargoKit && cargoKit.fits !== 0) issues.push('cargo starter placed a passenger hall')
  if (cargoKit && cargoKit.focus !== 'cargo') issues.push(`focus is ${cargoKit.focus}`)
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.getByRole('button', { name: /^5x$/ }).click()
  const cargoSigned = await signFirst(page, '21-cargo-letter')
  if (!cargoSigned) issues.push('cargo contract letter never signed')
  await page.waitForTimeout(20_000)
  await shot(page, '22-cargo-ops')
  const cargoOps = await state(page)
  const cf = await fps(page, 1200)
  samples.push({ t: 'cargo', fps: cf, state: cargoOps })
  notes.push(`cargo ops ${JSON.stringify(cargoOps)}`)

  // Narrow viewport — same session, just to see chrome crush.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await shot(page, '23-mobile-apron')
} catch (err) {
  issues.push(`playtest threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  await page.screenshot({ path: `${OUT}/99-crash.png` }).catch(() => {})
} finally {
  await browser.close()
}

const uniqueErrors = [...new Set(consoleErrors)].filter(
  (e) => !/Download the React DevTools/i.test(e) && !/favicon/i.test(e),
)
for (const e of uniqueErrors) issues.push(e)

const report = { ok: issues.length === 0, issues, notes, samples, consoleErrors: uniqueErrors }
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
log(JSON.stringify({ ok: report.ok, issues, sampleCount: samples.length }, null, 2))
process.exit(report.ok ? 0 : 1)
