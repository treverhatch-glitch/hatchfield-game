/**
 * Batch B proof clips: the production build under ?playtest=1, captured headless.
 * Each clip loads the save the Greedy bot left (scripts/batch-b-proof-save.mts) and is
 * then played with real clicks. The script reads window.__hatch only to know when to wait.
 *
 *   npm run build
 *   npx vitest run --config scripts/batch-b-proof.vitest.ts
 *   npx tsx scripts/batch-b-proof.mts [clip-id ...]
 *
 * Frames are page screenshots (about 2-4 fps under SwiftShader). ffmpeg encodes them at a
 * constant 5 fps on their real timestamps. The caption strip is padded under the game frame.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type CDPSession, type Locator, type Page } from 'playwright'

const PORT = 46311
const URL = `http://127.0.0.1:${PORT}/?playtest=1`
const SAVE_KEY = 'apron-save-v25'
const SAVE = process.env.PROOF_SAVE ?? '/tmp/batch-b-busy-save.txt'
const OUT = 'docs/devlog/media/batch-b-proof'
const WORK = '/tmp/batch-b-proof'
const VIEW = { width: 1280, height: 800 }
const FRAME_GAP_MS = 220
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
const BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))

type Box = { x: number; y: number; w: number; h: number }
type Mark = { t: number; box: Box }
type Note = { t: number; text: string }

class Recorder {
  frames: { t: number; file: string }[] = []
  marks: Mark[] = []
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

  /** Chrome's screencast hands over frames as the page paints them, without forcing an extra render. */
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
      quality: 82,
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

  /** Stop taking frames while the game plays on; the clip shows a cut with a caption. */
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

  /**
   * A real mouse click at the element's centre. Playwright's default click waits for two
   * identical animation frames, which takes seconds while the hall renders at 1-2 fps here.
   */
  async click(target: Locator, text?: string) {
    // Finding the button can take seconds while the hall renders at 1-2 fps. Frames are not
    // kept during that lookup; the press and everything after it stay on the timeline.
    const lookup = this.pausedAt == null ? Date.now() : null
    if (lookup != null) this.pausedAt = lookup
    const c0 = Date.now()
    await target.waitFor({ state: 'visible' })
    const c1 = Date.now()
    if (!(await target.isEnabled())) throw new Error(`disabled: ${text ?? target.toString()}`)
    const b = await target.boundingBox()
    const c2 = Date.now()
    if (!b) throw new Error(`no box: ${text ?? target.toString()}`)
    if (lookup != null) {
      this.t0 += Date.now() - lookup
      this.pausedAt = null
    }
    if (text) this.note(text)
    this.marks.push({ t: this.now(), box: { x: b.x, y: b.y, w: b.width, h: b.height } })
    await this.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    if (process.env.PROOF_TIMING) console.log(`    click wait ${c1 - c0} box ${c2 - c1} press ${Date.now() - c2} ms`)
  }

  async hold(ms: number) {
    await this.page.waitForTimeout(ms)
  }
}

type Clip = {
  id: string
  file: string
  proves: string
  /** 'save' opens the Greedy bot's day-25 field. 'new' starts a new game with real clicks. */
  boot: 'save' | 'new'
  run: (page: Page, rec: Recorder) => Promise<void>
}

const hatch = <T,>(page: Page, body: string) => page.evaluate(`(() => { const g = window.__hatch; ${body} })()`) as Promise<T>

async function openPhone(page: Page, rec: Recorder) {
  const tab = page.getByTestId('dock-tab-phone')
  if ((await tab.getAttribute('aria-selected')) !== 'true') await rec.click(tab)
  const peek = page.getByTestId('phone-peek')
  if (await peek.isVisible().catch(() => false)) await rec.click(peek, 'Open the phone in the left dock')
  const messages = page.getByTestId('phone-tab-messages')
  await messages.waitFor({ state: 'visible' })
  if ((await messages.getAttribute('aria-selected')) !== 'true') await rec.click(messages, 'Messages')
}

async function setSpeed(page: Page, rec: Recorder, label: 'Pause' | '1x' | '3x' | '5x', text?: string) {
  await rec.click(page.locator('.stat-speeds button', { hasText: label }), text)
}

/** After a view switch the hall build stalls the main thread; wait until a round trip is quick again. */
async function settle(page: Page) {
  const until = Date.now() + 40_000
  let quick = 0
  while (Date.now() < until && quick < 2) {
    const t = Date.now()
    await page.evaluate(() => 1)
    quick = Date.now() - t < 300 ? quick + 1 : 0
    await page.waitForTimeout(300)
  }
}

/** Wait on the game's own clock for something to happen, up to a wall-time cap. */
async function waitFor(page: Page, test: string, capMs: number): Promise<boolean> {
  return page
    .waitForFunction(`(() => { const g = window.__hatch; return Boolean(${test}) })()`, undefined, { timeout: capMs, polling: 500 })
    .then(() => true)
    .catch(() => false)
}

const CLIPS: Clip[] = [
  {
    id: 'hud',
    boot: 'save',
    file: '01-busy-hud-uncluttered-1280x800.mp4',
    proves: '#2, #19, #27, #14',
    run: async (page, rec) => {
      const state = await hatch<{ day: number; signed: number }>(page, `return { day: g.gameDay() + 1, signed: g.signed.length }`)
      await setSpeed(page, rec, '5x', `Greedy bot save, day ${state.day}, ${state.signed} carriers, 5x. Alerts top right, goals and phone in the left dock`)
      await rec.hold(1500)
      await openPhone(page, rec)
      await rec.hold(1500)
      await rec.click(page.getByTestId('dock-tab-timetable'), 'Timetable tab: the sheet opens in the centre column, clear of the dock')
      await rec.hold(2500)
      await rec.click(page.getByTestId('menu-operations'), 'Operations: the manage panel takes the inspector slot under the alerts')
      const tab = page.locator('[data-testid="submenu-operations"] button').first()
      await tab.waitFor({ state: 'visible' })
      await rec.click(tab)
      await rec.hold(3000)
      await rec.click(page.getByTestId('dock-tab-phone'), 'Back to the phone. No two panels share a region')
      await rec.hold(1500)
    },
  },
  {
    id: 'phone',
    boot: 'save',
    file: '02-offer-and-master-contract-on-phone-1280x800.mp4',
    proves: '#10, #21',
    run: async (page, rec) => {
      await openPhone(page, rec)
      const master = page.locator('[data-testid^="phone-card-diplomacy-"]').first()
      if (await master.isVisible().catch(() => false)) rec.note('The master contract letter is a phone message, not a popup')
      await rec.hold(2000)
      await setSpeed(page, rec, '5x', '5x until the next contract letter arrives')
      await rec.hold(1000)
      rec.pause()
      const arrived = await waitFor(page, `g.offer`, 180_000)
      if (!arrived) throw new Error('no contract letter arrived inside the cap')
      await page.getByTestId('phone-card-contract').waitFor({ state: 'visible' })
      rec.resume('A contract letter arrives on the phone, at the top of Messages')
      await rec.hold(3000)
      await rec.click(page.getByTestId('phone-action-contract-negotiate'), 'Negotiate: the offer and counter open as a phone message')
      await page.getByTestId('phone-card-negotiation').waitFor({ state: 'visible' })
      await rec.hold(3000)
      await rec.click(page.getByTestId('phone-action-negotiation-counter'), 'Counter, on the phone')
      await rec.hold(2500)
    },
  },
  {
    id: 'relations',
    boot: 'save',
    file: '03-relations-tab-bottom-left-1280x800.mp4',
    proves: '#20',
    run: async (page, rec) => {
      await setSpeed(page, rec, '3x')
      await rec.hold(1000)
      await rec.click(page.getByTestId('dock-tab-airlines'), 'Airlines tab, bottom left: the relations list')
      await page.getByTestId('relations-tab').waitFor({ state: 'visible' })
      await rec.hold(2500)
      const rows = page.locator('[data-testid^="relations-row-"]')
      if (await rows.count()) {
        await rec.click(rows.first(), 'A carrier row opens its standing in place')
        await rec.hold(3000)
        if ((await rows.count()) > 1) {
          await rec.click(rows.nth(1))
          await rec.hold(2000)
        }
      }
      await rec.click(page.getByTestId('dock-tab-phone'), 'Phone tab again')
      await rec.hold(1500)
    },
  },
  {
    id: 'build',
    boot: 'save',
    file: '04-centred-build-menu-with-icons-1280x800.mp4',
    proves: '#4, #15',
    run: async (page, rec) => {
      await rec.click(page.getByTestId('build-airfield'), 'Paused to build. Apron build tray: every item has an icon')
      await page.locator('.hud .build-tray').waitFor({ state: 'visible' })
      await rec.hold(3000)
      await rec.click(page.getByTestId('build-airfield'))
      await rec.click(page.getByTestId('view-terminal'), 'Terminal view')
      await rec.hold(1200)
      // The roof beat and hall build run for about 20 s of wall time under SwiftShader.
      rec.pause()
      await page.getByTestId('interior-bar').waitFor({ state: 'visible', timeout: 120_000 })
      await settle(page)
      await page.waitForTimeout(1000)
      rec.resume('The terminal build menu sits centred, each tool with an icon')
      await rec.hold(3000)
      const tabs = page.locator('.kit-bar .kit-tabs button[data-testid^="kit-tab-"]')
      const n = Math.min(3, await tabs.count())
      for (let i = 0; i < n; i++) {
        await rec.click(tabs.nth(i), i === 0 ? 'Kit tabs: every card has an icon' : undefined)
        await rec.hold(2200)
      }
      await rec.click(tabs.nth(n - 1))
      await rec.hold(1500)
    },
  },
  {
    id: 'clicks',
    boot: 'new',
    file: '05-economy-and-select-respond-1280x800.mp4',
    proves: '#43, #45',
    run: async (page, rec) => {
      await rec.hold(1000)
      await rec.click(page.getByTestId('menu-money'), 'Economy opens its menu')
      await page.getByTestId('submenu-money').waitFor({ state: 'visible' })
      await rec.hold(1500)
      await rec.click(page.getByTestId('tab-overview'), 'and the menu item takes the click')
      await rec.hold(3000)
      await rec.click(page.getByTestId('dock-tab-timetable'), 'Timetable open above the build bar')
      await rec.hold(2000)
      await rec.click(page.getByRole('button', { name: 'Select', exact: true }).first(), 'Select still takes the click with the timetable open')
      await rec.hold(2500)
      await rec.click(page.getByTestId('build-airfield'), 'and the tool row beside it does too')
      await rec.hold(2500)
    },
  },
  {
    id: 'sign',
    boot: 'new',
    file: '06-sign-then-airport-respond-1280x800.mp4',
    proves: '#43',
    run: async (page, rec) => {
      await openPhone(page, rec)
      if (!(await hatch<boolean>(page, `return Boolean(g.offer)`))) {
        await setSpeed(page, rec, '5x', '5x until the first contract letter arrives')
        await rec.hold(1000)
        rec.pause()
        if (!(await waitFor(page, `g.offer`, 180_000))) throw new Error('no contract letter arrived inside the cap')
        rec.resume('The first contract letter is on the phone')
      } else {
        rec.note('The first contract letter is on the phone')
      }
      const sign = page.getByTestId('phone-action-contract-sign')
      await sign.waitFor({ state: 'visible' })
      await rec.hold(1500)
      await setSpeed(page, rec, 'Pause', 'Pause')
      await rec.click(page.getByTestId('view-terminal'), 'Terminal view')
      await rec.hold(1000)
      rec.pause()
      await page.getByTestId('interior-bar').waitFor({ state: 'visible', timeout: 120_000 })
      await settle(page)
      await page.waitForTimeout(1000)
      rec.resume('In the terminal, the letter is still on the phone')
      await rec.hold(1500)
      await rec.click(sign, 'Sign on the phone takes the click')
      await rec.hold(2500)
      await rec.click(page.getByTestId('view-airport'), 'Airport takes the click after the phone signs')
      await rec.hold(1500)
      rec.pause()
      await waitFor(page, `g.view === 'apron'`, 120_000)
      await settle(page)
      rec.resume('Back on the apron, the carrier is signed')
      await rec.hold(2500)
    },
  },
]

async function boot(page: Page, save: string | null) {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(
    ([key, raw]) => {
      localStorage.clear()
      sessionStorage.clear()
      if (raw) localStorage.setItem(key, raw)
    },
    [SAVE_KEY, save] as const,
  )
  await page.reload({ waitUntil: 'networkidle' })
  // A player setting: hold noon so the footage is not a night scene.
  await page.getByTestId('menu-tab-settings').click()
  const cycle = page.getByTestId('settings-day-night')
  await cycle.waitFor({ state: 'visible' })
  if (await cycle.isChecked()) await cycle.uncheck()
  await page.keyboard.press('Escape').catch(() => {})
  if (save) {
    await page.getByTestId('continue-game').click()
  } else {
    const sandbox = page.getByTestId('sandbox-toggle')
    if (await sandbox.isChecked().catch(() => false)) await sandbox.uncheck()
    await page.getByTestId('new-game').click()
    await page.getByTestId('start-pax').click()
    await page.getByTestId('starter-kit-coach').click()
  }
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
  await page.waitForTimeout(3000)
  // Scroll the camera out over the field, the way a player would.
  await page.mouse.move(VIEW.width * 0.55, VIEW.height * 0.45)
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(1500)
  if (save) {
    // The bot stops at midnight. Play on at 5x, unrecorded, until the morning bank.
    await page.locator('.stat-speeds button', { hasText: '5x' }).click()
    await page.waitForFunction(
      `(() => { const h = ((window.__hatch.clock % 180) / 180) * 24; return h >= 8 && h < 20 })()`,
      undefined,
      { timeout: 240_000, polling: 1000 },
    )
    await page.locator('.stat-speeds button', { hasText: 'Pause' }).click()
    await page.waitForTimeout(800)
  }
}

function encode(clip: Clip, rec: Recorder): string {
  const dir = join(WORK, clip.id)
  const list = rec.frames
    .map((f, i) => {
      const next = rec.frames[i + 1]?.t ?? f.t + FRAME_GAP_MS / 1000
      return `file '${f.file}'\nduration ${Math.max(0.05, next - f.t).toFixed(3)}`
    })
    .join('\n')
  writeFileSync(join(dir, 'frames.txt'), `ffconcat version 1.0\n${list}\nfile '${rec.frames.at(-1)!.file}'\n`)
  const strip = 64
  const filters = [`pad=iw:ih+${strip}:0:0:color=0x111418`]
  const title = join(dir, 'title.txt')
  writeFileSync(title, `Batch B ${clip.proves} · live game, ?playtest=1, headless capture`)
  filters.push(`drawtext=fontfile=${BOLD}:textfile=${title}:x=16:y=h-${strip}+10:fontsize=18:fontcolor=0xff5a4a`)
  rec.notes.forEach((n, i) => {
    const file = join(dir, `note${i}.txt`)
    writeFileSync(file, n.text)
    const end = rec.notes[i + 1]?.t ?? 1e9
    filters.push(
      `drawtext=fontfile=${FONT}:textfile=${file}:x=16:y=h-${strip}+36:fontsize=17:fontcolor=white:enable='between(t,${n.t.toFixed(2)},${end.toFixed(2)})'`,
    )
  })
  for (const m of rec.marks) {
    const pad = 4
    filters.push(
      `drawbox=x=${Math.round(m.box.x - pad)}:y=${Math.round(m.box.y - pad)}:w=${Math.round(m.box.w + pad * 2)}:h=${Math.round(m.box.h + pad * 2)}:color=0xff3b30@0.95:t=3:enable='between(t,${(m.t - 0.2).toFixed(2)},${(m.t + 0.9).toFixed(2)})'`,
    )
  }
  const out = join(OUT, clip.file)
  const res = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-vf', `${filters.join(',')},fps=5,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', out],
    { stdio: 'inherit' },
  )
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${clip.id}`)
  return out
}

async function main() {
  if (!CHROME) throw new Error('no Chrome binary')
  if (!existsSync('dist/index.html')) throw new Error('run npm run build first')
  if (!existsSync(SAVE)) throw new Error(`no bot save at ${SAVE}; run scripts/batch-b-proof-save.mts`)
  const save = readFileSync(SAVE, 'utf8')
  const pick = process.argv.slice(2)
  const clips = pick.length ? CLIPS.filter((c) => pick.includes(c.id)) : CLIPS
  mkdirSync(OUT, { recursive: true })
  const server: ChildProcess = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  })
  try {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(URL)).ok) break
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    const browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    })
    try {
      for (const clip of clips) {
        console.log(`clip ${clip.id}`)
        const page = await browser.newPage({ viewport: VIEW })
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.setDefaultTimeout(20_000)
        await boot(page, clip.boot === 'save' ? save : null)
        const rec = new Recorder(page, join(WORK, clip.id))
        await rec.start()
        try {
          await clip.run(page, rec)
        } finally {
          await rec.stop()
        }
        const out = encode(clip, rec)
        const span = rec.frames.at(-1)!.t
        console.log(
          `  ${out}: ${span.toFixed(1)}s, ${rec.frames.length} frames (${(rec.frames.length / span).toFixed(1)} fps), ${(statSync(out).size / 1e6).toFixed(2)} MB${errors.length ? `, page errors: ${errors.join(' | ')}` : ''}`,
        )
        await page.close()
      }
    } finally {
      await browser.close()
    }
  } finally {
    if (server.pid) process.kill(-server.pid, 'SIGTERM')
  }
}

await main()
