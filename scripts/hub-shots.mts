/**
 * Browser shots for the hub progression gaps. Writes docs/devlog/media/hubs/.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media/hubs'
const PORT = 45341

function viteBin(): string {
  return 'node_modules/vite/bin/vite.js'
}

function waitForVite(child: ChildProcess, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not listen')), 30_000)
    const onData = (buf: Buffer) => {
      const text = buf.toString()
      if (text.includes(`${port}`) || text.includes('Local:')) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`vite exited ${code}`))
    })
  })
}

async function boot(page: Page) {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await page.getByTestId('sandbox-toggle').uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
  await page.getByTestId('starter-kit-coach').click()
  await page.waitForFunction(() => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit())
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.count()) await gotIt.click()
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const vite = spawn(process.execPath, [viteBin(), '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const chromePath = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((path) => existsSync(path))
  try {
    await waitForVite(vite, PORT)
    const browser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    })
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      page.setDefaultTimeout(45_000)
      await boot(page)

      await page.evaluate(() => {
        const game = (window as unknown as { __hatch: any }).__hatch
        for (const id of ['gulf_pearl', 'zephyr_go', 'tango_air', 'seoul_star', 'brisa']) {
          if (!game.signed.includes(id)) game.signed.push(id)
          game.wave3.state.relations.rows[id] = {
            score: id === 'zephyr_go' ? 20 : 80,
            band: 'partner',
            counts: { onTime: 20, delay: 0, cancel: 0, missed: 0, fine: 0, kept: 30 },
          }
        }
        game.hubTiers.gulf_pearl = 'base'
        game.hubTierSince.gulf_pearl = -30
        game.hubRivalRoll = 0.05
        game.offer = null
        game.scaleFleet.pushback_tug = 1
        game.dedicateHubVehicle('gulf_pearl', 'tug')
        game.clock = 180
        game.tickPayroll(0)
        game.hubOffer = { airline: 'gulf_pearl', age: 0, fee: 14000, deadline: 45, tier: 'hub' }
        game.emit()
      })

      await page.getByTestId('hud-airlines').click()
      const row = page.getByTestId('hub-row-gulf_pearl')
      await row.scrollIntoViewIfNeeded()
      await row.click()
      await page.getByTestId('hub-profile').waitFor()
      await page.screenshot({ path: `${OUT}/01-airlines-profile.png` })

      await page.getByTestId('hub-open-assign').click()
      await page.getByTestId('hub-assign').waitFor()
      const placed = await page.evaluate(() => {
        const game = (window as unknown as { __hatch: any }).__hatch
        const ready = game.hubDeskRows('gulf_pearl').length
        if (ready > 0) return ready
        const spot = game.findHallFootprint('checkin_desk')
        if (!spot) return 0
        const ok = game.placeHallFootprint('checkin_desk', spot.hx, spot.hz, spot.rot)
        game.setSpeed(1)
        game.tick(0.05)
        game.setSpeed(0)
        game.emit()
        return ok ? game.hubDeskRows('gulf_pearl').length : 0
      })
      if (placed > 0) {
        const row = page.locator('[data-testid^="hub-mode-"]').first()
        await row.waitFor()
      }
      await page.screenshot({ path: `${OUT}/02-assign.png` })

      if (placed > 0) {
        const preferred = page.locator('[data-testid$="-preferred"]').first()
        await preferred.click()
        await page.screenshot({ path: `${OUT}/03-assign-preferred.png` })
      }

      await page.getByTestId('phone-peek').click()
      if (await page.getByTestId('phone-tab-shut').count()) {
        await page.getByTestId('phone-tab-messages').click()
      } else if ((await page.getByTestId('phone-tab-messages').getAttribute('aria-selected')) !== 'true') {
        await page.getByTestId('phone-tab-messages').click()
      }
      await page.getByTestId('phone-card-hub').waitFor()
      await page.screenshot({ path: `${OUT}/04-phone-offer.png` })

      const nudge = page.locator('[data-testid^="phone-card-hub-nudge-"]').first()
      if (await nudge.count()) {
        await nudge.scrollIntoViewIfNeeded()
        await page.screenshot({ path: `${OUT}/05-phone-nudge.png` })
        const airline = page.locator('[data-testid^="phone-action-hub-nudge-"][data-testid$="-airlines"]').first()
        await airline.click()
        await page.getByTestId('phone-close').click()
        await page.getByTestId('hub-profile').waitFor()
        await page.screenshot({ path: `${OUT}/06-nudge-deeplink.png` })
      }

      console.log('shots written', OUT, 'desks', placed)
    } finally {
      await browser.close()
    }
  } finally {
    vite.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
