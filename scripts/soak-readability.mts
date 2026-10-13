import { Game } from '../src/game/sim.ts'
import { MIN_RUNWAY } from '../src/game/catalog.ts'
import type { PendingEmergency } from '../src/game/types.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 30_000
g.speed = 5

for (let i = 0; i < 500; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (!g.signed.length) {
  console.log(JSON.stringify({ ok: false, why: 'no airlines' }))
  process.exit(1)
}

// Force a divert host onto a stand.
for (const f of g.flights) {
  f.phase = 'gone'
  f.stand = null
}
g.flights = []
g.pendingEmergency = {
  id: 'test-div',
  kind: 'divert',
  blurb: 'test divert',
  fee: 5000,
  age: 0,
  deadline: 30,
  airline: g.signed[0],
  needs: {
    stand: true,
    fire: true,
    fuel: false,
    hangar: false,
    minRunway: MIN_RUNWAY,
  },
} satisfies PendingEmergency
g.resolveEmergency('accept')

const hosts = g.stolenHosts()
if (!hosts.length) issues.push('accept divert did not create emergencyHost flight')
const strip = g.plannerStrip(120)
if (!strip.hosts.length) issues.push('plannerStrip missing stolen hosts')
if (!g.news.some((n) => /stolen bank slot/i.test(n.text))) {
  issues.push('divert news missing stolen-slot language')
}

// Congestion waste → news: stack trucks on one cell (always count in congestionAt).
g.congWasteAcc = 0
g.congNewsCool = 0
g.congPeak = 0
const bay = { c: 12, r: 21 }
const path = [
  { c: bay.c, r: bay.r },
  { c: bay.c + 1, r: bay.r },
  { c: bay.c + 2, r: bay.r },
  { c: bay.c + 3, r: bay.r },
  { c: bay.c + 4, r: bay.r },
]
for (let i = 0; i < 5; i++) {
  g.trucks.push({
    id: `jam-t-${i}`,
    kind: 'bags',
    flightId: null,
    x: bay.c + i * 0.05,
    y: bay.r,
    path: [...path],
    seg: 0,
    t: 0,
    returning: false,
    dwell: 0,
    preDwell: 0,
    patrol: false,
    mission: 'unload',
    home: null,
  })
}
// Direct followPath calls accumulate waste without waiting on despawn races.
for (let i = 0; i < 40; i++) {
  for (const t of g.trucks.filter((x) => x.id.startsWith('jam-t-'))) {
    g.followPath(t, 1.8, 0.25)
  }
}
if (g.congPeak < 2) issues.push('congestion never peaked with stacked trucks')
if (g.congWasteAcc < 4) issues.push('congWasteAcc stayed too low under jam')

// Threshold news path.
g.congWasteAcc = 10
g.congNewsCool = 0
g.congPeak = 3
g.tick(0.25)
const jamLine = g.apronJamLine()
const sawJamNews = g.news.some((n) => /Apron jam/i.test(n.text))
if (!sawJamNews) issues.push('congWasteAcc≥8 did not fire Apron jam news')
if (!jamLine && g.congPeak < 2) issues.push('apronJamLine empty while peak should show')

const out = {
  ok: issues.length === 0,
  issues,
  hosts: strip.hosts,
  sawJamNews,
  jamLine,
  congWasteAcc: g.congWasteAcc,
  congPeak: g.congPeak,
}
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
