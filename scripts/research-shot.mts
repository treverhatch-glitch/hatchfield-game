import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import { chromium } from 'playwright'

const port = 46131
const out = new URL('../docs/playtest/research-tree-minute10.png', import.meta.url)

const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((path) => existsSync(path))

const vite: ChildProcess = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: process.cwd(),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

function waitForVite(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start')), 60_000)
    const on = (buf: Buffer) => {
      const text = buf.toString()
      if (text.includes('Local:') || text.includes(`:${port}`)) {
        clearTimeout(timer)
        resolve()
      }
    }
    vite.stdout?.on('data', on)
    vite.stderr?.on('data', on)
    vite.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`vite exited ${code}`))
    })
  })
}

try {
  await waitForVite()
  const browser = await chromium.launch({
    headless: true,
    executablePath: chrome,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(180_000)
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('sandbox-toggle').uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch))
  await page.getByTestId('starter-kit-coach').click()
  await page.waitForFunction(
    () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
  )
  const accept = page.getByTestId('contract-accept')
  if (await accept.count()) await accept.first().click()
  const advanced = await page.evaluate(() => {
    const game = (window as unknown as {
      __hatch: { clock: number; speed: number; setSpeed: (n: number) => void; tick: (dt: number) => void }
    }).__hatch
    game.setSpeed(5)
    let steps = 0
    while (game.clock < 600 && steps < 8000) {
      game.tick(0.25)
      steps += 1
    }
    return { clock: game.clock, steps, speed: game.speed }
  })
  console.log(JSON.stringify(advanced))
  const points = await page.evaluate(
    () => Math.floor((window as unknown as { __hatch: { researchTree: { points: () => number } } }).__hatch.researchTree.points()),
  )
  await page.getByTestId('menu-growth').click()
  await page.getByTestId('tab-research').click()
  await page.getByTestId('research-tree').waitFor({ state: 'visible' })
  const footer = await page.getByTestId('research-tree-points').innerText()
  console.log(JSON.stringify({ points, footer }))
  if (!(points > 0) || !footer.includes(String(points))) {
    throw new Error(`tree did not show the wallet: ${points} / ${footer}`)
  }
  await page.screenshot({ path: fileURLToPath(out), fullPage: false })
  await browser.close()
} finally {
  vite.kill('SIGTERM')
}
