/**
 * Batch A proof clips: the production build under ?playtest=1, headless.
 *   npm run build
 *   npx tsx scripts/batch-a-proof.mts [clip-id ...]
 *
 * Chrome's screencast is kept at about 4 fps. ffmpeg encodes that at 4 fps.
 * Each clip is 10–20 s of the live game. A wait is a captioned cut, not a still.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type CDPSession, type Page } from 'playwright'

const PORT = 45321
const URL = `http://127.0.0.1:${PORT}/?playtest=1`
const OUT = 'docs/devlog/media/batch-a-proof'
const WORK = '/tmp/batch-a-proof'
const VIEW = { width: 1280, height: 720 }
const FRAME_GAP_MS = 250
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
const BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))

type Note = { t: number; text: string }

class Recorder {
  frames: { t: number; file: string }[] = []
  notes: Note[] = []
  private t0 = 0
  private running = false
  private pausedAt: number | null = null
  private cdp: CDPSession | null = null
  constructor(
    private readonly page: Page,
    private readonly dir: string,
  ) {}

  now() {
    return (Date.now() - this.t0) / 1000
  }

  async start() {
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.t0 = Date.now()
    this.running = true
    let last = -Infinity
    this.cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      void this.cdp!.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
      const now = Date.now()
      if (!this.running || this.pausedAt != null || now - last < FRAME_GAP_MS) return
      last = now
      const file = join(this.dir, `f${String(this.frames.length).padStart(5, '0')}.jpg`)
      writeFileSync(file, Buffer.from(data, 'base64'))
      this.frames.push({ t: (now - this.t0) / 1000, file })
    })
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 72,
      maxWidth: VIEW.width,
      maxHeight: VIEW.height,
      everyNthFrame: 1,
    })
  }

  async stop() {
    this.running = false
    await this.cdp?.send('Page.stopScreencast').catch(() => {})
    await this.cdp?.detach().catch(() => {})
  }

  pause() {
    this.pausedAt = Date.now()
  }

  resume(text: string) {
    if (this.pausedAt == null) return
    const skipped = (Date.now() - this.pausedAt) / 1000
    this.t0 += Date.now() - this.pausedAt
    this.pausedAt = null
    this.note(`${text} (cut: ${Math.round(skipped)} s of live play skipped)`)
  }

  note(text: string) {
    this.notes.push({ t: this.now(), text })
    console.log(`  ${this.now().toFixed(1)}s ${text}`)
  }

  async hold(ms: number) {
    await this.page.waitForTimeout(ms)
  }
}

const only = process.argv.slice(2)

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'med')`)
  await page.reload({ waitUntil: 'networkidle' })
  const sandbox = page.getByTestId('sandbox-toggle')
  if (await sandbox.isChecked().catch(() => false)) await sandbox.uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('starter-kit-coach').click()
  await page.waitForFunction('Boolean(window.__hatch && window.__hatch.site)')
  const got = page.getByRole('button', { name: 'Got it' })
  if (await got.count()) await got.click().catch(() => {})
}

async function hatch(page: Page, body: string) {
  return page.evaluate(`(() => { const g = window.__hatch; ${body} })()`)
}

function faceExpr() {
  return `(((g.clock % 180) + 180) % 180) / 180 * 24`
}

async function clips() {
  if (!CHROME) throw new Error('no Chrome binary')
  if (!existsSync('dist/index.html')) throw new Error('run npm run build first')
  mkdirSync(OUT, { recursive: true })
  rmSync(WORK, { recursive: true, force: true })
  const server: ChildProcess = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  })
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  })
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(URL)).ok) break
      } catch {
        /* not up */
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    const jobs: [string, string, (page: Page, rec: Recorder) => Promise<void>][] = [
      ['01-daytime-start', '#1', daytime],
      ['02-night-visible', '#1', night],
      ['03-second-runway', '#41', runway],
      ['04-both-exits', '#8', exits],
      ['05-flights-cycling', '#40', cycling],
      ['06-camera-speed', '#29', camera],
      ['07-empty-terminal', '#35', terminal],
    ]
    for (const [id, proves, run] of jobs) {
      if (only.length && !only.includes(id)) continue
      console.log(`clip ${id}`)
      const page = await browser.newPage({ viewport: VIEW })
      page.setDefaultTimeout(20_000)
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await boot(page)
      const rec = new Recorder(page, join(WORK, id))
      await rec.start()
      try {
        await run(page, rec)
      } finally {
        await rec.stop()
      }
      const out = encode(id, proves, rec)
      const span = rec.frames.at(-1)!.t - rec.frames[0]!.t
      const mb = statSync(out).size / 1e6
      console.log(`  ${out}: ${span.toFixed(1)}s, ${rec.frames.length} frames, ${mb.toFixed(2)} MB${errors.length ? ` errors: ${errors.join(' | ')}` : ''}`)
      if (span < 9 || span > 22) throw new Error(`${id} duration ${span.toFixed(1)}s is outside 10–20s`)
      if (mb > 15) throw new Error(`${id} is ${mb.toFixed(1)} MB`)
      await page.close()
    }
  } finally {
    await browser.close()
    if (server.pid) process.kill(-server.pid, 'SIGTERM')
  }
}

async function daytime(page: Page, rec: Recorder) {
  await hatch(page, `g.setSpeed(1)`)
  rec.note('#1 New game, morning. The field is in daylight.')
  await rec.hold(14000)
}

async function night(page: Page, rec: Recorder) {
  rec.note('#1 Morning on the new field.')
  await rec.hold(3000)
  rec.pause()
  await hatch(page, `g.setSpeed(5)`)
  await page.waitForFunction(`(() => { const g = window.__hatch; const f = ${faceExpr()}; return f >= 22 || f < 4 })()`, undefined, {
    timeout: 180_000,
    polling: 500,
  })
  await hatch(
    page,
    `const cells = [];
     g.tiles.forEach((row, r) => row.forEach((t, c) => { if (t === 'runway' || t === 'terminal') cells.push({ c, r }) }));
     const mid = cells[Math.floor(cells.length / 2)];
     if (mid) g.focusAt({ view: 'apron', cells: [mid] })`,
  )
  await hatch(page, `g.setSpeed(1)`)
  rec.resume('#1 Night. The runway and the hall stay visible.')
  await rec.hold(12000)
}

async function runway(page: Page, rec: Recorder) {
  await hatch(page, `g.setSpeed(0); g.cash = Math.max(g.cash, 2000000)`)
  await page.getByTestId('build-airfield').click()
  await page.getByTestId('tray-runway').click().catch(() => {})
  const plan = (await hatch(
    page,
    `g.setTool('runway');
     const before = g.tiles.flat().filter((t) => t === 'runway').length;
     const refused = []; let ok = null;
     for (const facing of ['h', 'v']) {
       if (ok) break;
       g.facing = facing;
       for (let r = 1; r < g.tiles.length - 1 && !ok; r++) {
         for (let c = 1; c < g.tiles[r].length - 1; c++) {
           if (g.tiles[r][c] !== 'grass') continue;
           g.setHover({ c, r });
           const cells = g.ghostCells({ c, r });
           const paved = cells.length > 8 && cells.every((p) => g.tiles[p.r] && g.tiles[p.r][p.c] === 'grass');
           const why = g.placementGhostReason();
           if (!why && paved && g.ghostReady(cells)) { ok = { c, r, facing, n: cells.length }; break }
           if (why && refused.length < 1) refused.push({ c, r, why });
         }
       }
     }
     return { refused, ok, before }`,
  )) as {
    refused: { c: number; r: number; why: string }[]
    ok: { c: number; r: number; facing: string; n: number } | null
    before: number
  }
  if (!plan.ok) throw new Error('no legal runway cell')
  const bad = plan.refused[0]
  if (bad) {
    await hatch(page, `g.setTool('runway'); g.focusAt({ view: 'apron', cells: [{ c: ${bad.c}, r: ${bad.r} }] }); g.setHover({ c: ${bad.c}, r: ${bad.r} })`)
    rec.note(`#41 Refused: ${bad.why}`)
    await rec.hold(3500)
  }
  await hatch(
    page,
    `g.setTool('runway'); g.facing = '${plan.ok.facing}';
     g.focusAt({ view: 'apron', cells: [{ c: ${plan.ok.c}, r: ${plan.ok.r} }] });
     g.setHover({ c: ${plan.ok.c}, r: ${plan.ok.r} })`,
  )
  rec.note(`#41 Legal plot, ${plan.ok.n} grass cells`)
  await rec.hold(3000)
  const placed = (await hatch(
    page,
    `g.clickTile({ c: ${plan.ok.c}, r: ${plan.ok.r} });
     const after = g.tiles.flat().filter((t) => t === 'runway').length;
     const site = g.sites.find((s) => s.kind === 'runway');
     const mid = site && site.cells[Math.floor(site.cells.length / 2)];
     if (mid) g.focusAt({ view: 'apron', cells: [mid] });
     g.setTool('select');
     return { after, site: Boolean(site), news: (g.news && g.news[0] && g.news[0].text) || '' }`,
  )) as { after: number; site: boolean; news: string }
  if (!placed.site && placed.after <= plan.before) throw new Error(`runway was not placed: ${placed.news}`)
  rec.note('#41 Second runway placed')
  await rec.hold(7000)
}

async function exits(page: Page, rec: Recorder) {
  await primeAirline(page, rec)
  await catchExit(page, rec, 25, 8, 15, '#8 Arrival on the north exit', 6000, 240_000)
  await catchExit(page, rec, 28, 7, 21, '#8 Arrival on the south exit', 8000, 900_000)
}

/** Freeze on the tick a jet steps onto the exit, then film it at 1×. */
async function catchExit(page: Page, rec: Recorder, r: number, c0: number, c1: number, caption: string, holdMs: number, timeoutMs: number) {
  rec.pause()
  await hatch(
    page,
    `g.__exitShot = null;
     if (!g.__exitOrig) g.__exitOrig = g.tick.bind(g);
     g.tick = function (dt) {
       g.__exitOrig(dt);
       if (g.__exitShot || g.speed === 0) return;
       const f = g.flights.find((x) => x.phase !== 'gone' && x.phase !== 'hold' && x.phase !== 'approach' && Math.round(x.y) === ${r} && Math.round(x.x) >= ${c0} && Math.round(x.x) <= ${c1});
       if (!f) return;
       g.speed = 0;
       g.__exitShot = { id: f.id, x: f.x, y: f.y, phase: f.phase };
       g.focusAt({ view: 'apron', cells: [{ c: Math.round(f.x), r: Math.round(f.y) }] });
     };
     g.setSpeed(5)`,
  )
  await page.waitForFunction('Boolean(window.__hatch.__exitShot)', undefined, { timeout: timeoutMs, polling: 100 })
  const shot = (await hatch(page, `return g.__exitShot`)) as { id: string; phase: string; x: number; y: number }
  await hatch(page, `g.tick = g.__exitOrig; g.setSpeed(1)`)
  rec.resume(`${caption} (${shot.phase})`)
  const steps = Math.max(1, Math.round(holdMs / 1000))
  for (let i = 0; i < steps; i++) {
    await hatch(
      page,
      `const f = g.flights.find((x) => x.id === ${JSON.stringify(shot.id)});
       if (f) g.focusAt({ view: 'apron', cells: [{ c: Math.round(f.x), r: Math.round(f.y) }] })`,
    )
    await rec.hold(1000)
  }
}

async function cycling(page: Page, rec: Recorder) {
  await primeAirline(page, rec)
  rec.pause()
  await hatch(page, `g.setSpeed(5)`)
  await page.waitForFunction(`window.__hatch.flights.some((f) => f.phase === 'landing')`, undefined, { timeout: 180_000, polling: 200 })
  await hatch(page, `const f = g.flights.find((x) => x.phase === 'landing'); if (f) g.focusAt({ view: 'apron', cells: [{ c: Math.round(f.x), r: Math.round(f.y) }] }); g.setSpeed(3)`)
  rec.resume('#40 Landing, no go-around')
  await rec.hold(8000)
  rec.pause()
  await hatch(page, `g.setSpeed(5)`)
  await page.waitForFunction(`window.__hatch.flights.some((f) => f.phase === 'taxi_out' || f.phase === 'takeoff')`, undefined, {
    timeout: 240_000,
    polling: 200,
  })
  await hatch(page, `const f = g.flights.find((x) => x.phase === 'taxi_out' || x.phase === 'takeoff'); if (f) g.focusAt({ view: 'apron', cells: [{ c: Math.round(f.x), r: Math.round(f.y) }] }); g.setSpeed(3)`)
  rec.resume('#40 Departure rolling. Go-arounds stayed at ' + (await goArounds(page)))
  await rec.hold(8000)
}

async function camera(page: Page, rec: Recorder) {
  await hatch(page, `g.setSpeed(0)`)
  await page.getByTestId('hud-menu').click()
  await page.getByTestId('pause-settings').click()
  const slider = page.getByTestId('settings-camera-speed')
  await slider.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }))
  await slider.fill('0.5')
  rec.note('#29 Camera speed 0.5×')
  await rec.hold(2200)
  await page.getByTestId('pause-resume').click()
  await page.mouse.move(640, 400)
  await page.keyboard.down('d')
  await rec.hold(3000)
  await page.keyboard.up('d')
  await page.getByTestId('hud-menu').click()
  await page.getByTestId('pause-settings').click()
  const fast = page.getByTestId('settings-camera-speed')
  await fast.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }))
  await fast.fill('4')
  rec.note('#29 Camera speed 4×')
  await rec.hold(2200)
  await page.getByTestId('pause-resume').click()
  await page.keyboard.down('a')
  await rec.hold(3000)
  await page.keyboard.up('a')
  await rec.hold(1500)
}

async function terminal(page: Page, rec: Recorder) {
  rec.pause()
  await page.getByTestId('view-terminal').click()
  await page.getByTestId('interior-bar').waitFor({ state: 'visible', timeout: 120_000 })
  const preview = await hatch(
    page,
    `return { guests: g.hallGuests.length, preview: g.hallGuests.filter((x) => x.preview).length }`,
  )
  const crowd = preview as { guests: number; preview: number }
  rec.resume(`#35 Hall guests ${crowd.guests}. Preview passengers ${crowd.preview}.`)
  await rec.hold(14000)
}

async function primeAirline(page: Page, rec: Recorder) {
  rec.note('Signing the first carrier.')
  await rec.hold(2000)
  rec.pause()
  await hatch(page, `g.setSpeed(5)`)
  await page.waitForFunction('Boolean(window.__hatch.offer)', undefined, { timeout: 90_000 })
  await hatch(page, `g.acceptOffer(); if (g.fuelBrand) { g.buyLoads(); g.buyLoads() }`)
  rec.resume('Carrier signed. The bank is live.')
  await rec.hold(2000)
}

function onRow(r: number, c0: number, c1: number) {
  return `window.__hatch.flights.some((f) => f.phase !== 'gone' && f.phase !== 'hold' && Math.round(f.y) === ${r} && Math.round(f.x) >= ${c0} && Math.round(f.x) <= ${c1})`
}

async function frameJet(page: Page, r: number, c0: number, c1: number) {
  await hatch(
    page,
    `const f = g.flights.find((x) => x.phase !== 'gone' && x.phase !== 'hold' && Math.round(x.y) === ${r} && Math.round(x.x) >= ${c0} && Math.round(x.x) <= ${c1});
     if (f) g.focusAt({ view: 'apron', cells: [{ c: Math.round(f.x), r: Math.round(f.y) }] })`,
  )
}

async function goArounds(page: Page) {
  return page.evaluate(`window.__hatch.flights.reduce((n, f) => n + (f.goArounds || 0), 0) + (window.__hatch.goArounds || 0)`)
}

function encode(id: string, proves: string, rec: Recorder) {
  const dir = join(WORK, id)
  const list = rec.frames
    .map((f, i) => {
      const next = rec.frames[i + 1]?.t ?? f.t + FRAME_GAP_MS / 1000
      return `file '${f.file}'\nduration ${Math.max(0.05, next - f.t).toFixed(3)}`
    })
    .join('\n')
  writeFileSync(join(dir, 'frames.txt'), `ffconcat version 1.0\n${list}\nfile '${rec.frames.at(-1)!.file}'\n`)
  const strip = 56
  const title = join(dir, 'title.txt')
  writeFileSync(title, `Batch A ${proves} · live game, ?playtest=1, headless capture`)
  const filters = [
    `pad=iw:ih+${strip}:0:0:color=0x111418`,
    `drawtext=fontfile=${BOLD}:textfile=${title}:x=16:y=h-${strip}+8:fontsize=18:fontcolor=0xff5a4a`,
  ]
  rec.notes.forEach((n, i) => {
    const file = join(dir, `note${i}.txt`)
    writeFileSync(file, n.text.replace(/:/g, ' -'))
    const end = rec.notes[i + 1]?.t ?? 1e9
    filters.push(
      `drawtext=fontfile=${FONT}:textfile=${file}:x=16:y=h-${strip}+32:fontsize=16:fontcolor=white:enable='between(t,${n.t.toFixed(2)},${end.toFixed(2)})'`,
    )
  })
  const out = join(OUT, `${id}.mp4`)
  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(dir, 'frames.txt'),
      '-vf',
      `${filters.join(',')},fps=4,format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '30',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  )
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${id}`)
  return out
}

await clips()
