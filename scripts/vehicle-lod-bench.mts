/**
 * Frame time for 60 apron vehicles on SwiftShader.
 * Eight sit inside the close band; the rest use the cheap instanced shell.
 *   npx vite --port 45931 --host 127.0.0.1
 *   npx tsx scripts/vehicle-lod-bench.mts
 */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome'
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:45931/'
const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(`${URL}scripts/placard-close.html`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready, undefined, { timeout: 30000 })
await page.screenshot({ path: '/opt/cursor/artifacts/vehicles-placards.png' })
await page.goto(`${URL}scripts/vehicle-lod-bench.html`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready, undefined, { timeout: 120000 })
const bench = await page.evaluate(() => {
  const w = window as unknown as { __bench: unknown; __benchAllNear: unknown }
  return { lod: w.__bench, allNear: w.__benchAllNear }
})
console.log(JSON.stringify(bench, null, 2))
await browser.close()
