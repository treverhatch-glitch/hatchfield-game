/**
 * WP2 stills and a short playtest of the 1 m starter hall.
 * npx tsx scripts/terminal-wp2-proof.mts
 *
 * Stills: docs/devlog/media/terminal-rebuild/wp2-*.png
 * Clips:  docs/devlog/media/terminal-wp2-proof/*.mp4 at 10 fps.
 */
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const stillDir = 'docs/devlog/media/terminal-rebuild'
const clipDir = 'docs/devlog/media/terminal-wp2-proof'
const artifactDir = '/opt/cursor/artifacts'
const rawDir = '/tmp/terminal-wp2-raw'
mkdirSync(stillDir, { recursive: true })
mkdirSync(clipDir, { recursive: true })
mkdirSync(artifactDir, { recursive: true })
mkdirSync(rawDir, { recursive: true })

const server = await createServer({ server: { port: 45322, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const url = new URL(base)
url.searchParams.set('playtest', '1')

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})

type Hatch = {
  buildStarterKit: () => void
  setView: (v: 'hall' | 'apron') => void
  speed: number
  closeNegotiationPanel: () => void
  terminalPaxCount: () => number
  activeHall: () => { layout?: { version?: number; w?: number; h?: number; tileM?: number } } | null
}

type Hall = {
  followId: string | null
  goalTo: unknown
  pivot: { set: (x: number, y: number, z: number) => void }
  dist: number
  maxDist: number
  pitch: number
  yaw: number
  placeCam: () => void
  scene: {
    traverse: (fn: (o: { name?: string; position?: { x: number; y: number; z: number }; userData?: { facilityId?: string } }) => void) => void
  }
}

async function boot(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('hatchfield-gfx', 'high')
  })
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
  await page.waitForTimeout(1500)
}

async function dismiss(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __hatch: Hatch; __wp2Hide?: number }
    w.__hatch.closeNegotiationPanel()
    w.__wp2Hide ??= window.setInterval(() => w.__hatch.closeNegotiationPanel(), 250)
  })
}

async function aim(page: Page, x: number, z: number, dist: number, pitch: number, yaw: number) {
  await page.evaluate(
    ({ x, z, dist, pitch, yaw }) => {
      const w = (window as unknown as { __hall: Hall }).__hall
      w.followId = null
      w.goalTo = null
      w.maxDist = Math.max(w.maxDist, dist)
      w.pivot.set(x, 0, z)
      w.dist = dist
      w.pitch = pitch
      w.yaw = yaw
      w.placeCam()
    },
    { x, z, dist, pitch, yaw },
  )
}

function probe(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as { __hatch: Hatch }).__hatch
    const hall = (window as unknown as { __hall: Hall }).__hall
    const names = new Set<string>()
    const picks: { id: string; x: number; z: number }[] = []
    let floor = false
    hall.scene.traverse((o) => {
      if (o.name) names.add(o.name)
      if (o.name === 'hall-floor') floor = true
      const id = o.userData?.facilityId
      if (id && o.position) picks.push({ id, x: o.position.x, z: o.position.z })
    })
    const layout = g.activeHall()?.layout
    return {
      names: [...names],
      floor,
      picks,
      layout,
      pax: g.terminalPaxCount(),
    }
  })
}

async function shot(page: Page, name: string) {
  const path = `${stillDir}/${name}`
  await page.screenshot({ path, timeout: 120000 })
  copyFileSync(path, `${artifactDir}/${name}`)
  console.log('still', name, statSync(path).size)
}

function cutClip(webm: string, name: string, start: number, seconds: number) {
  const out = `${clipDir}/${name}.mp4`
  // Seek after -i so the cut lands on the held shot, not an earlier keyframe.
  const ff = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webm,
      '-ss',
      start.toFixed(2),
      '-t',
      String(seconds),
      '-vf',
      'fps=10',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
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
  copyFileSync(out, `${artifactDir}/${name}.mp4`)
  const probeOut = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,nb_frames:format=duration,size', '-of', 'default=nw=1', out],
    { encoding: 'utf8' },
  )
  console.log('clip', name, probeOut.stdout.trim().replaceAll('\n', ' '))
}

const stills = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await boot(stills)
const seen = await probe(stills)
console.log('layout', seen.layout)
console.log('scene', seen.names.join(','))
console.log('picks', seen.picks.map((p) => `${p.id}@${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' '))
if (!seen.floor) throw new Error('hall floor mesh was not drawn')
if (!seen.names.includes('hall-root') || !seen.names.includes('hall-kit-detail')) {
  throw new Error(`hall kit missing: ${seen.names.join(',')}`)
}
if (seen.layout?.version !== 2 || seen.layout.w !== 88 || seen.layout.h !== 44) {
  throw new Error(`starter layout is not the 88×44 document: ${JSON.stringify(seen.layout)}`)
}
const lane0 = seen.picks.find((p) => p.id === 'item:s1-lane-0')
const lane1 = seen.picks.find((p) => p.id === 'item:s1-lane-1')
const desk = seen.picks.find((p) => p.id === 'item:s1-desk-0')
if (!lane0 || !lane1 || !desk) throw new Error(`missing rendered fittings ${JSON.stringify({ lane0, lane1, desk })}`)
if (Math.hypot(lane0.x - lane1.x, lane0.z - lane1.z) > 8) throw new Error('lanes are not in one room')
if (Math.abs(lane0.z - lane1.z) > 1) throw new Error('lanes are not side by side')

await aim(stills, 0, 0, 110, 0.9, 0.55)
await stills.waitForTimeout(700)
await dismiss(stills)
await shot(stills, 'wp2-s1-overview.png')

await aim(stills, desk.x, desk.z + 6, 16, 0.72, 0.15)
await stills.waitForTimeout(600)
await dismiss(stills)
await shot(stills, 'wp2-checkin-entrance.png')

await aim(stills, (lane0.x + lane1.x) / 2, lane0.z + 4, 18, 0.78, 0.2)
await stills.waitForTimeout(600)
await dismiss(stills)
await shot(stills, 'wp2-security-room.png')
await stills.close()

const videoContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
})
const reel = await videoContext.newPage()
const t0 = Date.now()
const mark = () => (Date.now() - t0) / 1000
await boot(reel)
const live = await probe(reel)
const d = live.picks.find((p) => p.id === 'item:s1-desk-0')
const a = live.picks.find((p) => p.id === 'item:s1-lane-0')
const b = live.picks.find((p) => p.id === 'item:s1-lane-1')
if (!d || !a || !b) throw new Error('clip boot missed the rendered fittings')
await aim(reel, 0, 0, 110, 0.9, 0.55)
await dismiss(reel)
await reel.waitForTimeout(800)
const overviewAt = mark()
await reel.waitForTimeout(8000)
await aim(reel, d.x, d.z + 6, 16, 0.72, 0.15)
await dismiss(reel)
await reel.waitForTimeout(500)
const checkinAt = mark()
await reel.waitForTimeout(8000)
await aim(reel, (a.x + b.x) / 2, a.z + 4, 18, 0.78, 0.2)
await dismiss(reel)
await reel.waitForTimeout(500)
const securityAt = mark()
await reel.waitForTimeout(8000)

const reelVideo = reel.video()
await videoContext.close()
const webm = reelVideo ? await reelVideo.path() : ''
cutClip(webm, '01-s1-overview', overviewAt, 8)
cutClip(webm, '02-checkin-from-entrance', checkinAt, 8)
cutClip(webm, '03-security-room', securityAt, 8)

await browser.close()
await server.close()
console.log('wp2 proof done')
