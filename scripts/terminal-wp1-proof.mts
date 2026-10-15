/**
 * WP1 stills and proof clips of the running hall.
 * npx tsx scripts/terminal-wp1-proof.mts [--clips]
 *
 * Stills: docs/devlog/media/terminal-rebuild/wp1-*.png
 * Clips:  docs/devlog/media/terminal-wp1-proof/*.mp4 at 3 fps, 15–18 s each.
 */
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const stillDir = 'docs/devlog/media/terminal-rebuild'
const clipDir = 'docs/devlog/media/terminal-wp1-proof'
const rawDir = '/tmp/terminal-wp1-raw'
mkdirSync(stillDir, { recursive: true })
mkdirSync(clipDir, { recursive: true })
mkdirSync(rawDir, { recursive: true })

const server = await createServer({ server: { port: 45321, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const url = new URL(base)
url.searchParams.set('playtest', '1')

const browser = await chromium.launch({
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})

async function boot(page: Page, quality: 'high' | 'ultra') {
  await page.addInitScript((q) => {
    localStorage.clear()
    localStorage.setItem('hatchfield-gfx', q)
  }, quality)
  page.on('pageerror', (err) => console.error('pageerror', err.message))
  await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 240000 })
  await page.getByTestId('new-game').click({ timeout: 60000 })
  await page.waitForSelector('[data-testid="start-pax"]', { timeout: 60000 })
  for (let attempt = 0; attempt < 20; attempt++) {
    const site = await page.evaluate(() => {
      const g = (window as unknown as { __hatch?: { site?: string } }).__hatch
      if (g?.site) return true
      ;(document.querySelector('[data-testid="start-pax"]') as HTMLButtonElement | null)?.click()
      return false
    })
    if (site) break
    await page.waitForTimeout(1000)
  }
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site), null, { timeout: 60000 })
  await page.evaluate(() => {
    const g = (window as unknown as { __hatch: Hatch }).__hatch
    g.buildStarterKit()
    g.setView('hall')
    g.speed = 1
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __hall?: unknown }).__hall), null, { timeout: 120000 })
  await dismiss(page)
  await page.waitForTimeout(1200)
}

type Hatch = {
  buildStarterKit: () => void
  setView: (v: 'hall' | 'apron') => void
  speed: number
  demoHallCrowd: (n?: number) => number
  terminalPaxCount: () => number
  placeHallItemAt: (id: string, c: number, r: number, rot?: number) => boolean
  activeHall: () => { items: { id: string; def: string; c: number; r: number }[] } | null
  clock: number
}

async function aim(page: Page, c: number, r: number, dist: number, pitch: number, yaw: number) {
  await page.evaluate(
    ({ c, r, dist, pitch, yaw }) => {
      const w = (window as unknown as { __hall: Hall }).__hall
      const z = w.zoneGrid()
      const cw = 48 / z.cols
      const ch = 32 / z.rows
      w.followId = null
      w.goalTo = null
      w.pivot.set(-24 + (c + 0.5) * cw, 0, -16 + (r + 0.5) * ch)
      w.dist = dist
      w.pitch = pitch
      w.yaw = yaw
      w.placeCam()
    },
    { c, r, dist, pitch, yaw },
  )
}

type Hall = {
  zoneGrid: () => { cols: number; rows: number }
  followId: string | null
  goalTo: unknown
  pivot: { set: (x: number, y: number, z: number) => void }
  dist: number
  pitch: number
  yaw: number
  placeCam: () => void
  scene: { traverse: (fn: (o: { name?: string }) => void) => void }
}

async function itemAt(page: Page, def: string): Promise<{ c: number; r: number } | null> {
  return page.evaluate((def) => {
    const g = (window as unknown as { __hatch: Hatch }).__hatch
    const hit = g.activeHall()?.items.find((item) => item.def === def)
    return hit ? { c: hit.c, r: hit.r } : null
  }, def)
}

/**
 * The airline offer sheet opens a few seconds in and again on each new letter.
 * Closing it only hides the sheet (the offer stays pending), so keep it hidden.
 */
async function dismiss(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __hatch: { closeNegotiationPanel: () => void }; __wp1Hide?: number }
    w.__hatch.closeNegotiationPanel()
    w.__wp1Hide ??= window.setInterval(() => w.__hatch.closeNegotiationPanel(), 250)
  })
  await page.waitForTimeout(150)
}

async function shot(page: Page, name: string) {
  const path = `${stillDir}/${name}`
  await page.screenshot({ path, timeout: 120000 })
  console.log('still', name, statSync(path).size)
}

function cutClip(webm: string, name: string, start: number, seconds: number) {
  const out = `${clipDir}/${name}.mp4`
  const ff = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      start.toFixed(2),
      '-t',
      String(seconds),
      '-i',
      webm,
      '-vf',
      'fps=3',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '30',
      '-pix_fmt',
      'yuv420p',
      '-an',
      '-movflags',
      '+faststart',
      out,
    ],
    { encoding: 'utf8' },
  )
  if (ff.status !== 0) {
    console.error(ff.stderr)
    throw new Error(`ffmpeg failed for ${name}`)
  }
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1', out],
    { encoding: 'utf8' },
  )
  console.log('clip', name, probe.stdout.trim().replaceAll('\n', ' '), 'bytes', statSync(out).size)
}

/** `--clips` re-records only the MP4s and keeps the stills on disk. */
if (!process.argv.includes('--clips')) {
const stills = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await boot(stills, 'ultra')
const names = await stills.evaluate(() => {
  const found = new Set<string>()
  ;(window as unknown as { __hall: Hall }).__hall.scene.traverse((o) => {
    if (o.name) found.add(o.name)
  })
  return [...found]
})
console.log('scene names', names.join(','))
if (!names.includes('hall-root') || !names.includes('hall-kit-detail')) {
  throw new Error(`hall kit missing: ${names.join(',')}`)
}
if (names.some((n) => /jet_bridge|supply-cart|supplycart|terminal-building/i.test(n))) {
  throw new Error(`leftover picture in the hall: ${names.join(',')}`)
}
await aim(stills, 3.5, 2, 28, 0.95, 0.4)
await stills.waitForTimeout(500)
await shot(stills, 'wp1-overview-ultra.png')

const desk = await itemAt(stills, 'checkin_belt')
const lane = (await itemAt(stills, 'security_small')) ?? (await itemAt(stills, 'security_medium'))
const cafe = await itemAt(stills, 'cafe')
const claim = await itemAt(stills, 'claim_carousel')
if (!desk || !lane || !cafe || !claim) throw new Error(`missing starter kit ${JSON.stringify({ desk, lane, cafe, claim })}`)

const placed = await stills.evaluate(() => {
  const g = (window as unknown as { __hatch: Hatch }).__hatch
  return {
    drop: g.placeHallItemAt('bag_drop', 2, 1, 0),
    burger: g.placeHallItemAt('fast_food', 3, 4, 0),
    pax: g.terminalPaxCount(),
  }
})
console.log('placed', placed)
if (placed.pax !== 0) throw new Error(`passengers at start: ${placed.pax}`)
const burger = await itemAt(stills, 'fast_food')
if (!burger) throw new Error('Runway Burger was not placed')

await stills.evaluate(() => {
  const g = (window as unknown as { __hatch: Hatch }).__hatch
  g.demoHallCrowd(14)
  g.speed = 1
})
await stills.waitForTimeout(2500)
await dismiss(stills)
await aim(stills, desk.c, desk.r, 9, 0.62, 0.4)
await stills.waitForTimeout(800)
await shot(stills, 'wp1-person-desk.png')
await aim(stills, lane.c, lane.r, 11, 0.7, -0.5)
await stills.waitForTimeout(600)
await dismiss(stills)
await shot(stills, 'wp1-lane.png')
await aim(stills, cafe.c, cafe.r, 15, 1.0, 0.2)
await stills.waitForTimeout(600)
await dismiss(stills)
await shot(stills, 'wp1-shop.png')
await aim(stills, burger.c, burger.r, 16, 1.0, 0.2)
await stills.waitForTimeout(600)
await dismiss(stills)
await shot(stills, 'wp1-burger.png')
const drop = await itemAt(stills, 'bag_drop')
if (drop) {
  await aim(stills, drop.c, drop.r, 11, 1.2, Math.PI + 0.3)
  await stills.waitForTimeout(400)
  await dismiss(stills)
  await shot(stills, 'wp1-bagdrop.png')
}
await aim(stills, claim.c, claim.r, 18, 0.8, 0.8)
await stills.waitForTimeout(400)
await dismiss(stills)
await shot(stills, 'wp1-carousel.png')
await stills.evaluate(() => {
  ;(window as unknown as { __hatch: Hatch }).__hatch.speed = 0
})
await aim(stills, lane.c, lane.r, 8, 0.45, -0.4)
await stills.waitForTimeout(400)
await dismiss(stills)
await shot(stills, 'wp1-pause-a.png')
await stills.waitForTimeout(2000)
await shot(stills, 'wp1-pause-b.png')
await stills.close()

const high = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await boot(high, 'high')
await aim(high, 3.5, 2, 28, 0.95, 0.4)
await high.waitForTimeout(400)
await dismiss(high)
await shot(high, 'wp1-overview-high.png')
await high.close()
}

const videoContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
})
const reel = await videoContext.newPage()
const reelT0 = Date.now()
const mark = () => (Date.now() - reelT0) / 1000
await boot(reel, 'ultra')
const pax = await reel.evaluate(() => (window as unknown as { __hatch: Hatch }).__hatch.terminalPaxCount())
console.log('empty pax', pax)
if (pax !== 0) throw new Error('empty clip has passengers')
await aim(reel, 3.5, 2, 26, 0.9, 0.35)
await dismiss(reel)
await reel.waitForTimeout(1500)
const emptyAt = mark()
await reel.waitForTimeout(15000)
const paxAfter = await reel.evaluate(() => (window as unknown as { __hatch: Hatch }).__hatch.terminalPaxCount())
console.log('empty pax after 15 s', paxAfter)
if (paxAfter !== 0) throw new Error('passengers appeared before the first flight')

await reel.evaluate(() => {
  const g = (window as unknown as { __hatch: Hatch }).__hatch
  g.demoHallCrowd(16)
  g.speed = 1
  g.placeHallItemAt('fast_food', 3, 4, 0)
})
const deskCell = await itemAt(reel, 'checkin_belt')
const laneCell = (await itemAt(reel, 'security_small')) ?? (await itemAt(reel, 'security_medium'))
if (!deskCell || !laneCell) throw new Error('no desk or lane')
await aim(reel, deskCell.c, deskCell.r, 10, 0.62, 0.4)
await reel.waitForTimeout(4000)
await dismiss(reel)
const deskAt = mark()
await reel.waitForTimeout(10000)
await aim(reel, laneCell.c, laneCell.r, 10, 0.72, -0.5)
await reel.waitForTimeout(500)
await reel.evaluate(() => {
  ;(window as unknown as { __hatch: Hatch }).__hatch.speed = 0
})
await reel.waitForTimeout(8500)

await reel.evaluate(() => {
  ;(window as unknown as { __hatch: Hatch }).__hatch.speed = 1
})
const shopCell = await itemAt(reel, 'fast_food')
if (!shopCell) throw new Error('no Runway Burger')
await aim(reel, shopCell.c, shopCell.r, 16, 1.0, 0.2)
await dismiss(reel)
await reel.waitForTimeout(1500)
const shopAt = mark()
await reel.waitForTimeout(15000)

const reelVideo = reel.video()
await videoContext.close()
const webm = reelVideo ? await reelVideo.path() : ''
cutClip(webm, '01-empty-hall-before-first-flight', emptyAt, 15)
cutClip(webm, '02-desk-lane-real-scale-then-pause', deskAt, 18)
cutClip(webm, '03-runway-burger-no-security', shopAt, 15)

await browser.close()
await server.close()
console.log('wp1 proof done')
