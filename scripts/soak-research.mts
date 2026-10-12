import { Game } from '../src/game/sim.ts'
import { RESEARCH_NODES, RP_PER_FLIGHT } from '../src/game/catalog.ts'
import { AIRFRAMES, pickAirframe } from '../src/game/airframes.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3

// Heavy strip for A380 gate checks
for (let c = 4; c < 26; c++) g.tiles[8][c] = 'runway'
g.tiles[20][10] = 'hangar'
g.tiles[20][14] = 'police'
g.tiles[21][16] = 'cargo'
g.cash += 50_000

for (let i = 0; i < 600; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

const rpBefore = g.researchPoints
// Simulate completed flights granting RP
const fake = {
  pax: 160,
  kind: 'narrowbody' as const,
  airline: g.signed[0] ?? 'northline',
}
g.grantResearchForFlight(fake as never)
if (g.researchPoints < rpBefore + RP_PER_FLIGHT) {
  issues.push('RP grant too small')
}

// Heavy pack gated until research
const locked = pickAirframe('widebody', 24, [])
if (locked?.id === 'a380') issues.push('A380 available without heavy_pack')
const unlocked = pickAirframe('widebody', 24, ['heavy_pack'])
if (!unlocked || (unlocked.id !== 'a380' && unlocked.research === 'heavy_pack')) {
  // pool may pick a359 — just ensure gated frames can appear
  const pool = Object.values(AIRFRAMES).filter(
    (a) => a.research === 'heavy_pack' && a.minRunway <= 24,
  )
  if (!pool.length) issues.push('no heavy_pack frames')
}
const a380 = AIRFRAMES.a380
if (!a380?.research) issues.push('a380 missing research gate')

// Buy chain with enough RP
g.researchPoints = 200
for (const n of RESEARCH_NODES) {
  const before = g.hasResearch(n.id)
  g.buyResearch(n.id)
  if (!before && !g.hasResearch(n.id)) {
    issues.push(`failed to unlock ${n.id}: ${g.canBuyResearch(n.id).why}`)
  }
}

if (g.maxInbound() < 3) issues.push(`stand_class should raise inbound to 3, got ${g.maxInbound()}`)
if (!g.hasResearch('deice')) issues.push('deice missing')
const stormMult = g.weatherCrashMult()
g.weather = 'storm'
const withDeice = g.weatherCrashMult()
// Temporarily strip deice to compare
g.researchUnlocked = g.researchUnlocked.filter((x) => x !== 'deice')
const without = g.weatherCrashMult()
g.researchUnlocked.push('deice')
if (!(withDeice < without)) {
  issues.push(`deice should cut storm mult (${withDeice} vs ${without})`)
}
void stormMult

g.clock = 130 // night
if (!g.isNight()) issues.push('clock 130 should be night')
g.clock = 40
if (g.isNight()) issues.push('clock 40 should be day')

const out = {
  ok: issues.length === 0,
  issues,
  rp: g.researchPoints,
  unlocked: g.researchUnlocked,
  inbound: g.maxInbound(),
  night: g.isNight(),
  rating: g.fieldRating(),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
