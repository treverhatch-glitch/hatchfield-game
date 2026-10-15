/**
 * Headless Chrome probe: gesture unlock, clip decode, and a captured output level.
 *   node scripts/audio-level.mjs
 * Serves the Vite app, then drives Chrome. Prints one JSON object.
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = 45991
const url = `http://127.0.0.1:${port}/`

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not listen')), 30000)
    const onData = (buf) => {
      const text = buf.toString()
      if (text.includes('Local:') || text.includes(`localhost:${port}`) || text.includes(`127.0.0.1:${port}`)) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`vite exited ${code}`))
    })
  })
}

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
})

const report = { ok: false }

try {
  await waitForServer(vite)
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-gl=swiftshader', '--mute-audio'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const warnings = []
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text())
  })
  await page.addInitScript(() => {
    const Orig = window.AudioContext || window.webkitAudioContext
    const contexts = []
    function Wrapped() {
      const ctx = new Orig()
      const gains = []
      const createGain = ctx.createGain.bind(ctx)
      ctx.createGain = () => {
        const node = createGain()
        gains.push(node)
        return node
      }
      ctx.__gains = gains
      contexts.push(ctx)
      window.__acs = contexts
      return ctx
    }
    Wrapped.prototype = Orig.prototype
    window.AudioContext = Wrapped
    if (window.webkitAudioContext) window.webkitAudioContext = Wrapped
  })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => ({
    contexts: window.__acs?.length ?? 0,
  }))

  await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.id = 'audio-probe-canvas'
    canvas.width = 200
    canvas.height = 120
    canvas.style.cssText = 'position:fixed;left:8px;top:8px;width:200px;height:120px;z-index:99999'
    document.body.appendChild(canvas)
  })
  await page.click('#audio-probe-canvas')
  await page.waitForTimeout(300)

  const afterClick = await page.evaluate(async () => {
    const ctx = window.__acs?.[0]
    if (!ctx) return { error: 'no AudioContext after canvas click' }
    const ogg = await fetch('/assets/audio/ui_click.ogg')
    const oggBytes = await ogg.arrayBuffer()
    const oggBuf = await ctx.decodeAudioData(oggBytes.slice(0))
    const ch = oggBuf.getChannelData(0)
    let oggSum = 0
    for (let i = 0; i < ch.length; i++) oggSum += ch[i] * ch[i]
    const mp3 = await fetch('/assets/audio/ui_click.mp3')
    const mp3Bytes = await mp3.arrayBuffer()
    const mp3Buf = await ctx.decodeAudioData(mp3Bytes.slice(0))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.25
    osc.frequency.value = 440
    osc.connect(gain)
    gain.connect(analyser)
    gain.connect(ctx.destination)
    osc.start()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const data = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (const sample of data) sum += sample * sample
    osc.stop()
    const master = ctx.__gains?.[0]
    return {
      state: ctx.state,
      contexts: window.__acs.length,
      oggStatus: ogg.status,
      oggType: ogg.headers.get('content-type'),
      oggDuration: oggBuf.duration,
      oggRms: Math.sqrt(oggSum / ch.length),
      mp3Status: mp3.status,
      mp3Duration: mp3Buf.duration,
      outputRms: Math.sqrt(sum / data.length),
      master: master ? master.gain.value : null,
    }
  })

  await page.evaluate(() => {
    localStorage.setItem('hatchfield.settings.v1', JSON.stringify({
      audioMuted: true,
      masterVolume: 0.4,
      busVolume: { aircraft: 0.15, vehicles: 0.25, buildings: 0.35, ambient: 0.2, ambience: 0.2, ui: 0.1, sfx: 0.3 },
    }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.id = 'audio-probe-canvas'
    canvas.style.cssText = 'position:fixed;left:8px;top:8px;width:200px;height:120px;z-index:99999'
    document.body.appendChild(canvas)
  })
  await page.click('#audio-probe-canvas')
  await page.keyboard.press('KeyH')
  await page.waitForTimeout(250)
  const muted = await page.evaluate(() => {
    const ctx = window.__acs?.[0]
    const gains = ctx?.__gains ?? []
    return {
      state: ctx?.state ?? null,
      master: gains[0] ? gains[0].gain.value : null,
      buses: gains.slice(1, 8).map((node) => node.gain.value),
    }
  })

  report.ok = afterClick.state === 'running'
    && before.contexts === 0
    && afterClick.outputRms > 0.01
    && afterClick.oggRms > 0.001
    && afterClick.mp3Duration > 0
    && muted.state === 'running'
    && muted.master < 0.05
  report.before = before
  report.afterClick = afterClick
  report.muted = muted
  report.warnings = warnings.filter((line) => line.includes('[audio]') || line.includes('Audio')).slice(0, 12)
  await browser.close()
} catch (err) {
  report.ok = false
  report.error = err instanceof Error ? err.stack : String(err)
} finally {
  vite.kill('SIGTERM')
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
