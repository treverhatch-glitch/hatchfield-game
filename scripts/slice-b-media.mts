/** Stills and short clips for the terminal interior slice. */
import { mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
]

async function boot(page: Page) {
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('tab-economy').click()
  await page.getByTestId('starter-kit').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  // Economy starts open for the kit. Toggle it shut so the hall can be read.
  await page.getByTestId('tab-economy').click()
  await page.getByRole('button', { name: 'Hall', exact: true }).click()
  await page.getByTestId('prefab-ceilings').waitFor()
  await page.waitForTimeout(800)
}

function call(body: string) {
  return new Function(body) as () => unknown
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await page.screenshot({ path: `${OUT}/SLICE-B-prefab.png` })
  console.log('prefab', await page.getByTestId('prefab-ceilings').innerText())

  await page.getByTestId('zone-security').click()
  await page.getByTestId('item-menu').waitFor()
  await page.screenshot({ path: `${OUT}/SLICE-B-item-menu.png` })
  console.log('item menu')

  await page.getByTestId('upgrade-prefab').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/SLICE-B-upgrade.png` })
  console.log('upgrade', await page.getByTestId('prefab-ceilings').innerText())
  await page.close()
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await page.getByTestId('zone-retail').click()
  for (const id of ['cell-0-0', 'cell-1-0', 'cell-2-0', 'cell-0-1', 'cell-1-1']) {
    await page.getByTestId(id).click()
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/SLICE-B-zones.png` })
  console.log('zones', await page.getByTestId('prefab-ceilings').innerText())
  await page.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/slice-b-journey', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page)
  await page.getByRole('button', { name: '5x' }).first().click()
  await page.evaluate(call(`window.__hatch.demoHallCrowd(6)`))
  await page.waitForTimeout(14000)
  const mid = await page.evaluate(
    call(`
      const g = window.__hatch
      const nodes = {}
      for (const p of g.hallGuests) nodes[p.node] = (nodes[p.node] || 0) + 1
      return { n: g.hallGuests.length, nodes, lost: g.lostPaxCount(), q: g.securityQueueCount() }
    `),
  )
  console.log('journey', mid)
  await page.screenshot({ path: `${OUT}/SLICE-B-journey.png` })
  await page.close()
  const video = page.video()
  if (video) await video.saveAs(`${OUT}/SLICE-B-journey.webm`)
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/slice-b-bottleneck', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page)
  await page.getByRole('button', { name: '5x' }).first().click()
  await page.evaluate(call(`window.__hatch.demoHallCrowd(16)`))
  const banner = page.getByTestId('bottleneck')
  await banner.waitFor({ timeout: 25000 })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/SLICE-B-bottleneck.png` })
  console.log('bottleneck', await banner.innerText())
  await page.getByTestId('upgrade-prefab').click()
  await page.waitForTimeout(8000)
  const after = await page.evaluate(
    call(`
      const g = window.__hatch
      return {
        tier: g.fits[0].tier,
        q: g.securityQueueCount(),
        serving: g.hallGuests.filter((p) => (p.serviceLeft || 0) > 0).length,
        sec: Math.round(g.fits[0].secPerMin),
      }
    `),
  )
  console.log('after upgrade', after)
  await page.screenshot({ path: `${OUT}/SLICE-B-bottleneck-fixed.png` })
  await page.close()
  const video = page.video()
  if (video) await video.saveAs(`${OUT}/SLICE-B-bottleneck.webm`)
  await context.close()
}

await browser.close()
console.log('done')
