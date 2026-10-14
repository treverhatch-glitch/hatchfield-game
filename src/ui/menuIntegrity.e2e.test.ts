import { existsSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { chromium, type Locator, type Page } from 'playwright'
import { BUILD_MENUS, ECO_TABS, INFO_TREE, KIT_TABS, SETTINGS_TABS } from './uiCatalog'

const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME,
  '/usr/bin/google-chrome',
  '/usr/local/bin/google-chrome',
].filter((path): path is string => Boolean(path))

const PLACEHOLDER = /\b(todo|tbd|lorem|placeholder|click me|untitled|coming soon)\b/i

describe('every menu opens, has content, and closes', () => {
  it('walks build trays, info submenus, fees, pause, and the hall kit', async () => {
    const port = 46221
    const vite = spawn(process.execPath, [viteBin(), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      await waitForVite(vite, port)
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
      }
      const chromePath = CHROME_PATHS.find((path) => existsSync(path))
      if (chromePath) launchOptions.executablePath = chromePath
      const browser = await chromium.launch(launchOptions)
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
        page.setDefaultTimeout(60_000)
        await openTitle(page, port)
        await page.evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        await openTitle(page, port)
        await page.getByTestId('sandbox-toggle').uncheck()
        await page.getByTestId('new-game').click()
        await page.getByTestId('start-pax').click()
        await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
        const gotIt = page.getByRole('button', { name: 'Got it' })
        if (await gotIt.count()) await gotIt.click()

        for (const menu of BUILD_MENUS) {
          const tab = page.getByTestId(`build-${menu.id}`)
          await tab.click()
          const tray = page.getByTestId('build-tray')
          await tray.waitFor({ state: 'visible' })
          await assertNamedButtons(tray, menu.label)
          expect(await tray.locator('button').count()).toBeGreaterThan(0)
          if (menu.id === 'ops') {
            await page.getByTestId('tray-fuel').waitFor({ state: 'visible' })
            expect(await page.getByTestId('tray-snack').count()).toBe(0)
          }
          if (menu.id === 'commercial') {
            await page.getByTestId('tray-snack').waitFor({ state: 'visible' })
            expect(await page.getByTestId('tray-fuel').count()).toBe(0)
          }
          const stamp = tray.locator('button').first()
          await stamp.click()
          await page.waitForFunction(() => {
            const el = document.querySelector('[data-testid="build-tray"] button')
            return Boolean(el && /(?:^|\s)(on|is-locked|locked)(?:\s|$)/.test(el.className))
          })
          await tab.click()
          expect(await page.getByTestId('build-tray').count()).toBe(0)
        }

        for (const node of INFO_TREE) {
          if (node.items) {
            const group = page.getByTestId(`menu-${node.id}`)
            await group.click()
            const submenu = page.getByTestId(`submenu-${node.id}`)
            await submenu.waitFor({ state: 'visible' })
            await assertNamedButtons(submenu, node.label)
            const items = [...node.items]
            for (const item of items) {
              if (!(await submenu.isVisible())) await group.click()
              await page.getByTestId(`tab-${item.id}`).click()
              await page.getByTestId('panel-body').waitFor({ state: 'visible' })
              const text = (await page.getByTestId('panel-body').innerText()).trim()
              expect(text.length, `${item.label} panel`).toBeGreaterThan(20)
              expect(text).not.toMatch(PLACEHOLDER)
              await assertNamedButtons(page.getByTestId('panel-body'), item.label)
              if (item.panel === 'tycoon' && item.tycoonTab) {
                expect(await page.getByTestId(`tycoon-tab-${item.tycoonTab}`).getAttribute('aria-selected')).toBe('true')
              }
              await page.getByTestId('panel-close').click()
              expect(await page.getByTestId('panel-body').count()).toBe(0)
            }
            if (await submenu.isVisible()) await group.click()
            expect(await page.getByTestId(`submenu-${node.id}`).count()).toBe(0)
          } else if (node.panel) {
            const tab = page.getByTestId(`tab-${node.id}`)
            await tab.click()
            await page.getByTestId('panel-body').waitFor({ state: 'visible' })
            const text = (await page.getByTestId('panel-body').innerText()).trim()
            expect(text.length, `${node.label} panel`).toBeGreaterThan(20)
            await assertNamedButtons(page.getByTestId('panel-body'), node.label)
            if (node.panel === 'economy') {
              for (const eco of ECO_TABS) {
                await page.getByTestId(`eco-tab-${eco.id}`).click()
                expect(await page.getByTestId(`eco-tab-${eco.id}`).getAttribute('aria-selected')).toBe('true')
                expect((await page.getByTestId('panel-body').innerText()).trim().length).toBeGreaterThan(10)
              }
            }
            if (node.panel === 'settings') {
              for (const settings of SETTINGS_TABS) {
                await page.getByTestId(`hud-settings-tab-${settings.id}`).click()
                expect((await page.getByTestId('panel-body').innerText()).trim().length).toBeGreaterThan(10)
              }
            }
            await page.getByTestId('panel-close').click()
            expect(await page.getByTestId('panel-body').count()).toBe(0)
          }
        }

        await page.getByTestId('phone-peek').click()
        await page.getByTestId('phone-tab-contracts').waitFor({ state: 'visible' })
        await assertNamedButtons(page.getByTestId('phone'), 'Phone')
        for (const tab of ['contracts', 'messages'] as const) {
          await page.getByTestId(`phone-tab-${tab}`).click()
          expect(await page.getByTestId(`phone-tab-${tab}`).getAttribute('aria-selected')).toBe('true')
          const pageText = (await page.getByTestId('phone').innerText()).trim()
          expect(pageText.length, `phone ${tab}`).toBeGreaterThan(8)
        }
        await page.getByTestId('phone-close').click()
        await page.getByTestId('phone-peek').waitFor({ state: 'visible' })

        await page.getByTestId('tab-boards').click()
        await page.getByTestId('fids-panel').waitFor({ state: 'visible' })
        await assertNamedButtons(page.getByTestId('fids-panel'), 'Flight board')
        for (const tab of ['departures', 'arrivals'] as const) {
          await page.getByTestId(`fids-tab-${tab}`).click()
          expect(await page.getByTestId(`fids-tab-${tab}`).getAttribute('aria-selected')).toBe('true')
          expect((await page.getByTestId('fids-panel').innerText()).trim().length).toBeGreaterThan(8)
        }
        await page.getByTestId('fids-close').click()
        expect(await page.getByTestId('fids-panel').count()).toBe(0)

        await page.getByTestId('tab-fees').click()
        await page.getByTestId('fees-panel').waitFor({ state: 'visible' })
        await assertNamedButtons(page.getByTestId('fees-panel'), 'Fees')
        expect(await page.getByTestId('fees-panel').innerText()).toContain('Aircraft parking per hour')
        expect(await page.getByTestId('fees-panel').innerText()).toContain('Aircraft parking per day')
        await page.getByTestId('fees-panel').getByRole('button', { name: 'Close' }).click()
        expect(await page.getByTestId('fees-panel').count()).toBe(0)

        await page.getByTestId('cash-hero').click()
        await page.getByTestId('cash-menu').waitFor({ state: 'visible' })
        expect((await page.getByTestId('cash-menu').innerText()).trim().length).toBeGreaterThan(10)
        await page.getByTestId('cash-hero').click()
        expect(await page.getByTestId('cash-menu').count()).toBe(0)

        await page.getByTestId('hud-menu').click()
        await page.getByTestId('pause-menu').waitFor({ state: 'visible' })
        await assertNamedButtons(page.getByTestId('pause-menu'), 'Pause')
        await page.getByTestId('pause-settings').click()
        await page.getByTestId('settings-tab-game').click()
        await page.getByTestId('settings-tab-controls').click()
        expect((await page.getByTestId('pause-menu').innerText()).toLowerCase()).toContain('control')
        await page.getByTestId('pause-back').click()
        await page.getByTestId('pause-resume').click()
        expect(await page.getByTestId('pause-menu').count()).toBe(0)

        await page.getByTestId('view-terminal').click()
        await page.getByTestId('kit-bar').waitFor({ state: 'visible' })
        for (const kit of KIT_TABS) {
          const tab = page.getByTestId(`kit-tab-${kit.id}`)
          await tab.click()
          const cards = page.getByTestId('kit-cards')
          await cards.waitFor({ state: 'visible' })
          await assertNamedButtons(cards, kit.label)
          expect(await cards.locator('button').count()).toBeGreaterThan(0)
          await tab.click()
          expect(await page.getByTestId('kit-cards').count()).toBe(0)
        }
        await page.getByTestId('view-airport').click()
        await page.close()
      } finally {
        await browser.close()
      }
    } finally {
      vite.kill('SIGTERM')
    }
  }, 180_000)
})

async function assertNamedButtons(root: Locator, where: string) {
  const buttons = root.locator('button')
  const count = await buttons.count()
  expect(count, `${where} has buttons`).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i)
    const text = ((await button.innerText()) || '').replace(/\s+/g, ' ').trim()
    const aria = ((await button.getAttribute('aria-label')) || '').trim()
    const name = text || aria
    expect(name, `${where} button ${i} is unlabeled`).not.toEqual('')
    expect(name, `${where} button "${name}"`).not.toMatch(PLACEHOLDER)
    const disabled = await button.isDisabled()
    if (!disabled) {
      const type = await button.getAttribute('type')
      expect(type === 'button' || type === 'submit' || type == null, `${where} "${name}"`).toBe(true)
    }
  }
}

function viteBin(): string {
  return 'node_modules/vite/bin/vite.js'
}

/** Vite's "ready" line can print before the port accepts connections under load. */
async function waitForVite(proc: ChildProcess, port: number): Promise<void> {
  let log = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    log += chunk.toString()
  })
  proc.stderr?.on('data', (chunk: Buffer) => {
    log += chunk.toString()
  })
  const started = Date.now()
  while (Date.now() - started < 40_000) {
    if (proc.exitCode != null) throw new Error(`vite exited ${proc.exitCode}: ${log.slice(-500)}`)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      if (res.ok || res.status === 404) return
    } catch {
      // socket not open yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`vite did not start: ${log.slice(-500)}`)
}

async function openTitle(page: Page, port: number): Promise<void> {
  let last: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
      return
    } catch (err) {
      last = err
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  throw last
}
