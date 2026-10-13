/**
 * PROMPT 1 debug autoplay — new game → starter kit → sign airline →
 * 5 minutes sim at 5x → take a loan → open every tab. Fail on console errors.
 */
import { chromium, type Page } from 'playwright'
import { Game } from '../src/game/sim.ts'
import { tilesOf } from '../src/game/path.ts'

const issues: string[] = []
const notes: string[] = []
const consoleErrors: string[] = []

function log(...args: unknown[]) {
  console.log(...args)
}

/** Headless sim checks (placement debounce + loan stability). */
function simChecks() {
  const g = new Game()
  g.sandbox = true
  g.beginNew('easy')
  g.startFocus = 'pax'
  g.buyLand('city')
  g.buildStarterKit()

  const taxi0 = tilesOf(g.tiles, 'taxi').length
  g.setTool('taxi')
  // Find empty grass for a clean stamp; double-fire within debounce → one place.
  let target = { c: 20, r: 20 }
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
  const taxi1 = tilesOf(g.tiles, 'taxi').length
  if (taxi1 - taxi0 !== 1) {
    issues.push(`double-place: expected +1 taxi, got +${taxi1 - taxi0}`)
  } else {
    notes.push('place-once ok (+1 taxi from double-fire)')
  }

  // Loan without freak-out (sandbox: no interest snowball).
  g.sandbox = false
  g.cash = 80_000
  g.takeLoanProduct('bridge')
  const opened = g.loanBalance
  const newsBefore = g.news.length
  g.speed = 5
  for (let i = 0; i < 600; i++) g.tick(0.25) // ~750s sim
  const interestNews = g.news.slice(newsBefore).filter((n) => /interest/i.test(n.text))
  if (interestNews.length > 12) {
    issues.push(`loan news flood: ${interestNews.length} interest lines`)
  }
  if (g.loanBalance > opened * 1.5) {
    issues.push(`loan snowball ${opened} → ${g.loanBalance}`)
  } else {
    notes.push(`loan stable ${opened} → ${Math.round(g.loanBalance)} news=${interestNews.length}`)
  }

  // Budget / economy methods the tabs call.
  g.setBudget('security', 70)
  g.setBudget('maintenance', 60)
  if (g.budgets.security !== 70) issues.push('setBudget security failed')
  g.hireMechanic()
  g.hireJanitor()
  const pay = g.payrollPreview()
  if (!(pay > 0)) issues.push('payrollPreview not positive')
  notes.push(`tabs-data payroll=${Math.round(pay)} mechanics=${g.mechanics}`)
}

simChecks()

async function openTab(page: Page, id: string) {
  const btn = page.getByTestId(`tab-${id}`)
  // If this tab is already on, leave it; otherwise close any other panel first.
  const already = await btn.evaluate((b) => b.classList.contains('on')).catch(() => false)
  if (!already) {
    const openOther = page.locator('.info-menus button.on')
    if (await openOther.count()) {
      await openOther.first().click({ force: true })
      await page.waitForTimeout(150)
    }
    await btn.click({ force: true })
    await page.waitForTimeout(350)
  }
  const panel = page.locator('.panel-rollout')
  await panel.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  const visible = await panel.isVisible().catch(() => false)
  const head = await page.locator('.panel-head h2').innerText().catch(() => '')
  if (!visible) issues.push(`tab ${id}: panel not visible`)
  else {
    const body = await page.locator('.panel-body').innerText().catch(() => '')
    if (!body || body.length < 8) issues.push(`tab ${id}: empty body`)
  }
  notes.push(`tab ${id}: ${head || 'no-head'}`)
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`)
})

try {
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })

  if (!(await page.getByRole('heading', { name: 'Hatchfield' }).isVisible())) {
    issues.push('title missing Hatchfield')
  }

  // Sandbox ON by default
  const sandbox = page.getByTestId('sandbox-toggle')
  if (!(await sandbox.isChecked())) {
    await sandbox.check()
  }
  notes.push('sandbox on')

  await page.getByTestId('new-game').click()
  await page.waitForTimeout(300)
  if (!(await page.getByRole('heading', { name: /Choose your start/i }).isVisible())) {
    issues.push('New Game did not reach route pick')
  }

  // Passenger card lists needs
  const pax = page.getByTestId('start-pax')
  const paxText = await pax.innerText()
  for (const need of ['Runway', 'Stand', 'Terminal', 'Check-in', 'Security', 'Gate']) {
    if (!paxText.includes(need)) issues.push(`pax card missing ${need}`)
  }
  await pax.click()
  await page.waitForTimeout(700)

  // Economy → starter kit
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(300)
  const starter = page.getByTestId('starter-kit')
  if (!(await starter.isVisible())) issues.push('starter kit missing')
  else {
    await starter.click()
    await page.waitForTimeout(400)
    notes.push('starter kit stamped')
  }

  // Close then open every info tab
  for (const id of ['economy', 'budget', 'research', 'airlines', 'planner', 'services']) {
    await openTab(page, id)
    // Exercise a button in budget / economy
    if (id === 'budget') {
      const hire = page.getByRole('button', { name: /Hire mechanic/i })
      if (await hire.isVisible().catch(() => false)) {
        await hire.click({ force: true })
        notes.push('hired mechanic via Budget')
      }
      const slider = page.locator('.budgets input[type="range"]').first()
      if (await slider.isVisible().catch(() => false)) {
        await slider.fill('80')
        notes.push('budget slider ok')
      }
    }
    if (id === 'economy') {
      const cashLine = await page.getByTestId('economy-cash').innerText().catch(() => '')
      if (!/Bank/i.test(cashLine)) issues.push('economy cash line missing')
    }
  }

  // 5x and sign airline
  await page.getByRole('button', { name: /^5x$/ }).click()
  await page.waitForTimeout(200)

  let signed = false
  for (let i = 0; i < 80; i++) {
    const tab = page.locator('.letter-tab').filter({ hasText: /Contract/i }).first()
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => {})
      await page.waitForTimeout(120)
    }
    const sign = page.locator('.letter-actions button').filter({ hasText: /^Sign$/ }).first()
    if (await sign.isVisible().catch(() => false)) {
      await sign.click({ force: true })
      signed = true
      notes.push('signed airline')
      break
    }
    await page.waitForTimeout(200)
  }
  if (!signed) notes.push('no contract letter yet — continuing')

  // ~5 minutes sim at 5x: wall ≈ 60s (300s / 5). Cap wall to keep CI sane.
  const wallMs = 55_000
  log(`running ${wallMs}ms wall at 5x (~${(wallMs / 1000) * 5}s sim)`)
  await page.waitForTimeout(wallMs)

  // Take a loan
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(300)
  const loanBtn = page.getByRole('button', { name: /Bridge loan/i }).first()
  if (await loanBtn.isVisible().catch(() => false)) {
    await loanBtn.click({ force: true })
    await page.waitForTimeout(300)
    const eco = await page.getByTestId('economy-cash').innerText().catch(() => '')
    if (!/loan owed/i.test(eco)) issues.push(`loan not reflected: ${eco}`)
    else notes.push(`loan ok: ${eco}`)
  } else {
    // Already open or label differs
    const anyLoan = page.locator('.loan-grid button').first()
    if (await anyLoan.isVisible().catch(() => false)) {
      await anyLoan.click({ force: true })
      notes.push('took first loan product')
    } else {
      issues.push('no loan button visible')
    }
  }

  // Confirm Move button gone, Select present
  const move = await page.getByRole('button', { name: /^Move$/ }).count()
  if (move > 0) issues.push('Move button still present')
  const select = await page.getByRole('button', { name: /^Select$/ }).count()
  if (select < 1) issues.push('Select button missing')

  // Close panel so it doesn't intercept the canvas, then WASD
  const close = page.locator('.panel-head button').filter({ hasText: /Close/i })
  if (await close.isVisible().catch(() => false)) {
    await close.click({ force: true })
    await page.waitForTimeout(200)
  }
  await page.locator('canvas.field').click({ position: { x: 400, y: 300 }, force: true })
  for (const key of ['w', 'a', 's', 'd', 'q', 'e', 'ArrowLeft', 'ArrowUp']) {
    await page.keyboard.down(key)
    await page.waitForTimeout(40)
    await page.keyboard.up(key)
  }
  notes.push('WASD/QE keystrokes sent')
} catch (err) {
  issues.push(`autoplay threw: ${err instanceof Error ? err.message : String(err)}`)
} finally {
  await browser.close()
}

const uniqueErrors = [...new Set(consoleErrors)].filter(
  (e) =>
    !/Download the React DevTools/i.test(e) &&
    !/favicon/i.test(e),
)
if (uniqueErrors.length) {
  for (const e of uniqueErrors) issues.push(e)
}

const out = {
  ok: issues.length === 0,
  issues,
  notes,
  consoleErrors: uniqueErrors,
}
log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
