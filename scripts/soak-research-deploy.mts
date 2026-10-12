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
g.cash += 80_000

// Heavy strip for late unlocks
for (let c = 4; c < 26; c++) g.tiles[8][c] = 'runway'

for (let i = 0; i < 500; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

const rp0 = g.researchPoints
g.grantResearchForFlight({
  pax: 160,
  kind: 'narrowbody',
  airline: g.signed[0] ?? 'northline',
} as never)
if (g.researchPoints < rp0 + RP_PER_FLIGHT + 3) {
  issues.push(`flight RP grant weak: ${rp0} → ${g.researchPoints}`)
}

// Lab path
g.hireResearcher()
g.fits[0].rooms.rdesk = 1
g.fits[0].rooms.rboard = 1
g.fits[0].rooms.rmachine = 1
const rate = g.researchRate()
if (rate < 0.2) issues.push(`lab rate too low ${rate}`)
const beforeLab = g.researchPoints
for (let i = 0; i < 40; i++) g.tickResearchers(0.25)
if (g.researchPoints <= beforeLab) issues.push('lab did not drip RP')

// Gate order
g.researchPoints = 5
const early = g.canBuyResearch('deice')
if (early.ok) issues.push('deice should require night_bank')

g.researchPoints = 200
const inbound0 = g.maxInbound()

for (const n of RESEARCH_NODES) {
  if (g.hasResearch(n.id)) continue
  g.buyResearch(n.id)
  if (!g.hasResearch(n.id)) {
    issues.push(`failed unlock ${n.id}: ${g.canBuyResearch(n.id).why}`)
  }
}

if (!g.hasResearch('night_bank')) issues.push('night_bank missing')
if (!g.hasResearch('deice')) issues.push('deice missing')
if (!g.hasResearch('stand_class')) issues.push('stand_class missing')
if (!g.hasResearch('heavy_pack')) issues.push('heavy_pack missing')
if (!g.hasResearch('mil_ramp')) {
  g.researchPoints = Math.max(g.researchPoints, 80)
  g.buyResearch('mil_ramp')
  if (!g.hasResearch('mil_ramp')) issues.push('mil_ramp missing')
}

const inbound1 = g.maxInbound()
if (!(inbound1 > inbound0)) {
  issues.push(`stand_class should raise inbound ${inbound0}→${inbound1}`)
}

// De-ice effect
g.weather = 'storm'
const withDeice = g.weatherCrashMult()
g.researchUnlocked = g.researchUnlocked.filter((x) => x !== 'deice')
const without = g.weatherCrashMult()
g.researchUnlocked.push('deice')
if (!(withDeice < without)) {
  issues.push(`deice should cut storm mult (${withDeice} vs ${without})`)
}

// Heavy pack gates
const locked = pickAirframe('widebody', 24, [])
if (locked?.id === 'a380') issues.push('A380 available without heavy_pack')
const pool = Object.values(AIRFRAMES).filter(
  (a) => a.research === 'heavy_pack' && a.minRunway <= 24,
)
if (!pool.length) issues.push('no heavy_pack frames in catalog')
const unlocked = pickAirframe('widebody', 24, ['heavy_pack'])
if (!unlocked) issues.push('no widebody with heavy_pack')

// Night window
g.clock = 130
if (!g.isNight()) issues.push('clock 130 should be night')
g.clock = 40
if (g.isNight()) issues.push('clock 40 should be day')

// Night freighter RP bonus
g.clock = 130
const rpN0 = g.researchPoints
g.grantResearchForFlight({
  pax: 0,
  kind: 'freighter',
  airline: 'umazon',
} as never)
const nightGain = g.researchPoints - rpN0
g.clock = 40
const rpD0 = g.researchPoints
g.grantResearchForFlight({
  pax: 0,
  kind: 'freighter',
  airline: 'umazon',
} as never)
const dayGain = g.researchPoints - rpD0
if (!(nightGain > dayGain)) {
  issues.push(`night freighter RP ${nightGain} should beat day ${dayGain}`)
}

const out = {
  ok: issues.length === 0,
  issues,
  unlocked: g.researchUnlocked,
  inbound0,
  inbound1,
  withDeice,
  without,
  labRate: Math.round(rate * 100) / 100,
  nightGain,
  dayGain,
  heavyPool: pool.map((a) => a.id),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
