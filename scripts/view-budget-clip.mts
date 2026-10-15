/**
 * Roof-beat stills, a short clip, the hall, and the max-zoom fps log.
 * Usage: npx tsx scripts/view-budget-clip.mts
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media/view-budget'
const FRAMES = `${OUT}/frames`
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const budgetLogs: string[] = []
page.on('console', (msg) => {
  const text = msg.text()
  if (text.includes('[view-budget]')) budgetLogs.push(text)
})
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high'); localStorage.setItem('hatchfield-aircraft-quality', 'high')`))
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(call(`return Boolean(window.__hatch && window.__hatch.site)`), null, { timeout: 20000 })
const kit = page.getByTestId('starter-kit-coach')
if (await kit.count()) await kit.click()
else await page.evaluate(call(`window.__hatch.buildStarterKit()`))
await page.waitForFunction(call(`return !window.__hatch.showStarterKit()`), null, { timeout: 20000 })
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.waitForFunction(call(`return Boolean(window.__world && window.__hatch.fits && window.__hatch.fits.length)`), null, { timeout: 20000 })

await page.evaluate(call(`
  const w = window.__world
  const aim = w.wr.terminalAim()
  if (aim) { w.pivot.x = aim.x; w.pivot.z = aim.z }
  w.yaw = 0.9
  w.pitch = 0.72
  w.dist = 280
  w.placeCam()
`))
await page.waitForFunction(call(`return performance.now() > 0 && document.body.innerText.length >= 0 && window.__world.dist >= 279`), null, { timeout: 5000 }).catch(() => {})
await page.waitForTimeout(4000)
console.log('budget-logs', JSON.stringify(budgetLogs))

await page.evaluate(call(`
  const w = window.__world
  const aim = w.wr.terminalAim()
  if (aim) { w.pivot.x = aim.x; w.pivot.z = aim.z }
  w.yaw = 0.55
  w.pitch = 0.85
  w.dist = 72
  w.placeCam()
`))
await page.waitForTimeout(300)

const pose = call(`
  const b = window.__world.wr.buildings[0]
  return {
    roof: b.roofSections.map((g) => Math.round(g.position.y * 100) / 100),
    wall: b.shellSections.map((g) => Math.round(g.scale.y * 100) / 100),
    view: window.__hatch.view,
    cue: window.__hatch.viewCue,
  }
`)

const seq = { enter: 0, leave: 0 }
const shot = async (name: 'enter' | 'leave') => {
  const state = await page.evaluate(pose)
  const file = `${FRAMES}/${String(seq[name]).padStart(2, '0')}-${name}.png`
  seq[name] += 1
  await page.screenshot({ path: file })
  console.log(name, JSON.stringify(state))
  return state
}

await page.evaluate(call(`window.__hatch.askView('hall')`))
for (let i = 0; i < 8; i++) await shot('enter')
await page.waitForFunction(call(`return window.__hatch.view === 'hall' && !window.__hatch.viewCue`), null, { timeout: 8000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/after-hall.png` })
console.log('hall', 'saved')

await page.evaluate(call(`window.__hatch.askView('apron')`))
for (let i = 0; i < 8; i++) await shot('leave')
await page.waitForFunction(call(`return window.__hatch.view === 'apron' && !window.__hatch.viewCue`), null, { timeout: 8000 })

await browser.close()

execFileSync(
  'ffmpeg',
  ['-y', '-framerate', '6', '-i', `${FRAMES}/%02d-enter.png`, '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '32', `${OUT}/transition-enter.webm`],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  ['-y', '-framerate', '6', '-i', `${FRAMES}/%02d-leave.png`, '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '32', `${OUT}/transition-leave.webm`],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    `${OUT}/transition-enter.webm`,
    '-i',
    `${OUT}/transition-leave.webm`,
    '-filter_complex',
    '[0:v][1:v]concat=n=2:v=1:a=0[v]',
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '32',
    `${OUT}/transition.webm`,
  ],
  { stdio: 'inherit' },
)
rmSync(`${OUT}/transition-enter.webm`)
rmSync(`${OUT}/transition-leave.webm`)
rmSync(FRAMES, { recursive: true, force: true })
console.log('budget-logs-final', JSON.stringify(budgetLogs))
