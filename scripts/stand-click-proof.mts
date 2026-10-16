/**
 * Production-build click on a parked aircraft.
 * The flight card opens. The dedicate panel stays closed.
 * ?playtest=1, 1280×720, H.264 yuv420p +faststart.
 *
 *   PROOF_BASE=http://127.0.0.1:45217 npx tsx scripts/stand-click-proof.mts
 */
import { execSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const sha = (process.env.PROOF_SHA ?? execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' })).trim()
const base = process.env.PROOF_BASE ?? 'http://127.0.0.1:45217'
const outDir = 'docs/devlog/media/stand-click'
const artDir = '/opt/cursor/artifacts'
const frames = '/tmp/stand-click-proof'
mkdirSync(outDir, { recursive: true })
mkdirSync(artDir, { recursive: true })
mkdirSync(frames, { recursive: true })

const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find((path) => {
  try {
    execSync(`test -x ${path}`)
    return true
  } catch {
    return false
  }
})
if (!chrome) throw new Error('chrome not found')

const browser = await chromium.launch({
  executablePath: chrome,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
page.on('pageerror', (err) => console.error('pageerror', err.message))

await page.goto(`${base}/?playtest=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.evaluate(`(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'ultra')
  localStorage.setItem('hatchfield-texture-quality', 'high')
  localStorage.setItem('hatchfield-aircraft-quality', 'high')
})()`)
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.getByTestId('sandbox-toggle').uncheck().catch(() => {})
await page.getByTestId('new-game').click({ timeout: 60_000 })
await page.getByTestId('start-pax').scrollIntoViewIfNeeded()
await page.getByTestId('start-pax').click({ timeout: 180_000 })
await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site && window.__world)', null, { timeout: 180_000 })
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) {
  await coach.click()
  await page.waitForFunction('!window.__hatch.showStarterKit()')
}

await page.evaluate(`(() => {
  const g = window.__hatch
  const w = window.__world
  g.tool = 'pan'
  g.setDayNightCycle(false)
  w.setGraphicsQuality('ultra')
  w.setDayNight({ hour: 12 })
  g.scheduleAuto = false
  g.schedule = []
  g.spawnCool = 1e9
  const stand = { c: 11, r: 6 }
  g.flights.push({
    id: 'flt-stand-click',
    airline: 'northline',
    flightNo: 'NL220',
    airframeId: 'b738',
    airframeName: 'Boeing 737-800',
    pax: 80,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0.4,
    path: [stand],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: { landing: true, bags: false, bagsLoad: true, fuel: false, catering: true, bagDrop: true, mx: false, deiced: true },
    waitingOn: { bags: true, bagsLoad: false, fuel: true, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
    phaseTime: 4,
    ledger: [],
    bagStage: 'unload_aircraft',
    bagUnits: 12,
  })
  g.selectedFlight = null
  g.assignPick = null
  const CELL = 22 * 0.45
  const half = 31 / 2
  const pivot = { x: (11 - half) * CELL, z: (6 - half) * CELL }
  window.__aim = { x: pivot.x, z: pivot.z, yaw: 0.9, pitch: 0.62, dist: 28 }
  const chip = document.createElement('div')
  chip.textContent = 'build ${sha}'
  chip.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;pointer-events:none;font:600 14px ui-monospace,monospace;color:#f4f7fb;background:rgba(8,16,28,.82);padding:4px 8px;border-radius:4px'
  document.body.appendChild(chip)
})()`)

async function frame(i: number) {
  await page.evaluate(`(() => {
    const g = window.__hatch
    const w = window.__world
    const aim = window.__aim
    w.pivot.set(aim.x, 0, aim.z)
    w.yaw = aim.yaw
    w.pitch = aim.pitch
    w.dist = aim.dist
    w.placeCam()
    w.render(g)
  })()`)
  await page.screenshot({ path: `${frames}/frame-${String(i).padStart(3, '0')}.png`, type: 'png' })
}

for (let i = 0; i < 8; i++) await frame(i)

const point = (await page.evaluate(`(() => {
  const w = window.__world
  const g = window.__hatch
  w.render(g)
  const mesh = w.jets.get('flt-stand-click')
  if (!mesh) return { ok: false, reason: 'no mesh' }
  const offsets = [1.6, 2.4, 0.8, 3.2]
  const rect = w.renderer.domElement.getBoundingClientRect()
  for (const lift of offsets) {
    const p = mesh.position.clone()
    p.y += lift
    p.project(w.camera)
    if (p.z > 1) continue
    w.ndc.set(p.x, p.y)
    w.ray.setFromCamera(w.ndc, w.camera)
    const id = w.pickClickedFlight()
    const x = rect.left + (p.x * 0.5 + 0.5) * rect.width
    const y = rect.top + (-p.y * 0.5 + 0.5) * rect.height
    if (id === 'flt-stand-click') return { ok: true, x, y, id }
  }
  return { ok: false, reason: 'ray missed the aircraft' }
})()`)) as { ok: boolean; x?: number; y?: number; id?: string; reason?: string }

if (!point.ok || point.x == null || point.y == null) throw new Error(`no aircraft hit: ${point.reason ?? 'unknown'}`)
console.log('click', point.x, point.y)
await page.mouse.click(point.x, point.y)
await page.waitForTimeout(200)

const ui = (await page.evaluate(`(() => {
  const card = document.querySelector('[data-testid="flight-card"]')
  const assign = document.querySelector('[data-testid="assign-panel"]')
  const cardStyle = card ? getComputedStyle(card).display : 'missing'
  const assignStyle = assign ? getComputedStyle(assign).display : 'missing'
  return {
    selected: window.__hatch.selectedFlight,
    card: card ? card.textContent : '',
    cardStyle,
    assignStyle,
    phase: document.querySelector('[data-testid="flight-phase"]')?.textContent ?? '',
  }
})()`)) as { selected: string | null; card: string; cardStyle: string; assignStyle: string; phase: string }
console.log(ui)
if (ui.selected !== 'flt-stand-click') throw new Error(`selected ${ui.selected}`)
if (ui.cardStyle === 'none' || ui.cardStyle === 'missing') throw new Error(`flight card ${ui.cardStyle}`)
if (!ui.card.includes('NL220')) throw new Error(`card text ${ui.card.slice(0, 120)}`)
if (ui.assignStyle !== 'missing') throw new Error(`dedicate panel ${ui.assignStyle}`)

for (let i = 8; i < 28; i++) await frame(i)

const file = `${outDir}/stand-click-${sha}.mp4`
const art = `${artDir}/stand-click-${sha}.mp4`
await new Promise<void>((resolve, reject) => {
  const ff = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      '12',
      '-i',
      `${frames}/frame-%03d.png`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      file,
    ],
    { stdio: 'inherit' },
  )
  ff.on('error', reject)
  ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
})
execSync(`cp ${file} ${art}`)
console.log('wrote', file)
await browser.close()
