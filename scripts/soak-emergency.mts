import { Game } from '../src/game/sim.ts'
import {
  EMERGENCY_FAIL_FINE,
  EMERGENCY_REFUSE_FINE,
  MIN_RUNWAY,
  TANKER_FEE,
  TANKER_MX_FEE,
} from '../src/game/catalog.ts'
import type { PendingEmergency } from '../src/game/types.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.tiles[20][10] = 'hangar'
g.tiles[18][10] = 'fuel'
g.speed = 3

for (let i = 0; i < 400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (!g.signed.length) {
  console.log(JSON.stringify({ ok: false, why: 'no airlines' }))
  process.exit(1)
}

function baseNeeds(extra: Partial<PendingEmergency['needs']> = {}): PendingEmergency['needs'] {
  return {
    stand: true,
    fire: true,
    fuel: false,
    hangar: false,
    minRunway: MIN_RUNWAY,
    ...extra,
  }
}

// Clear apron so host checks aren't poisoned by warm-up traffic.
for (const f of g.flights) {
  f.phase = 'gone'
  f.stand = null
}
g.flights = []

// Storm-weighted spawn should produce an ask when cool is zero.
g.weather = 'storm'
g.emergencyCool = 0
g.pendingThreat = null
g.pendingEmergency = null
let spawnedAsk = false
for (let i = 0; i < 40 && !spawnedAsk; i++) {
  g.emergencyCool = 0
  g.tickEmergencies(1)
  if (g.pendingEmergency) spawnedAsk = true
}
if (!spawnedAsk) {
  // Still exercise accept path with a forced divert.
  g.pendingEmergency = {
    id: 'test-div',
    kind: 'divert',
    blurb: 'test divert',
    fee: 5000,
    age: 0,
    deadline: 20,
    airline: g.signed[0],
    needs: baseNeeds(),
  }
}

const e0 = g.pendingEmergency!
if (!e0.needs) issues.push('spawned emergency missing needs')
// Force a known-good divert for the host/accept assertions (spawn may pick tanker).
g.pendingEmergency = {
  id: 'test-div',
  kind: 'divert',
  blurb: 'test divert',
  fee: 5000,
  age: 0,
  deadline: 20,
  airline: g.signed[0],
  needs: baseNeeds(),
}
const gapOk = g.emergencyHostGap(g.pendingEmergency)
if (gapOk) issues.push(`starter field should host ask but gap=${gapOk}`)

const cash0 = g.cash
const heat0 = g.heatOf(g.signed[0])
const flights0 = g.flights.length
g.resolveEmergency('accept')
if (g.pendingEmergency) issues.push('still pending after accept')
if (g.cash < cash0 + 4000) issues.push(`accept fee not paid: ${cash0} → ${g.cash}`)
if (g.heatOf(g.signed[0]) < heat0) issues.push('divert accept should raise heat')
if (g.flights.length <= flights0) {
  issues.push('accept should spawn a one-time landing')
}

// Fail host — accept without ARFF
const fireTiles: { r: number; c: number; tile: typeof g.tiles[0][0] }[] = []
for (let r = 0; r < g.tiles.length; r++) {
  for (let c = 0; c < g.tiles[r].length; c++) {
    if (g.tiles[r][c] === 'fire') {
      fireTiles.push({ r, c, tile: 'fire' })
      g.tiles[r][c] = 'grass'
    }
  }
}
g.pendingEmergency = {
  id: 'test-fail',
  kind: 'divert',
  blurb: 'test fail divert',
  fee: 6000,
  age: 0,
  deadline: 20,
  airline: g.signed[0],
  needs: baseNeeds({ fire: true }),
}
const gap = g.emergencyHostGap(g.pendingEmergency)
if (!gap) issues.push('expected host gap without fire')
const cashFail = g.cash
const repFail = g.reputation
const heatsFail = Object.fromEntries(g.signed.map((id) => [id, g.heatOf(id)]))
g.resolveEmergency('accept')
if (g.cash > cashFail - EMERGENCY_FAIL_FINE + 1) {
  issues.push(`fail fine not charged (${cashFail} → ${g.cash})`)
}
if (g.reputation >= repFail) issues.push('fail should cut reputation')
const broadDrop = g.signed.filter((id) => g.heatOf(id) < heatsFail[id]).length
if (broadDrop < Math.max(1, Math.floor(g.signed.length * 0.5))) {
  issues.push('fail should ding most airline heat')
}
// Restore fire
for (const t of fireTiles) g.tiles[t.r][t.c] = 'fire'

// Firefighting plane refuel-only refuse
g.pendingEmergency = {
  id: 'test-tank',
  kind: 'tanker',
  blurb: 'test airtanker refuel',
  fee: TANKER_FEE,
  age: 0,
  deadline: 20,
  airline: null,
  needs: baseNeeds({ fuel: true }),
}
const cash1 = g.cash
const heats = Object.fromEntries(g.signed.map((id) => [id, g.heatOf(id)]))
g.resolveEmergency('refuse')
if (g.cash > cash1 - EMERGENCY_REFUSE_FINE + 1) {
  issues.push('refuse fine not charged')
}
const anyHeatDrop = g.signed.some((id) => g.heatOf(id) < heats[id])
if (!anyHeatDrop) issues.push('refuse should ding carrier heat')

// Free stands — prior divert landings still occupy gates.
for (const f of g.flights) {
  f.phase = 'gone'
  f.stand = null
}
g.flights = g.flights.filter((f) => f.phase !== 'gone')

// Refuel-only accept — needs fuel farm + contract + loads
g.fuelBrand = g.fuelBrand ?? 'apex'
g.fuelLoads = Math.max(2, g.fuelLoads)
g.pendingEmergency = {
  id: 'test-refuel',
  kind: 'tanker',
  blurb: 'test refuel only',
  fee: TANKER_FEE,
  age: 0,
  deadline: 20,
  airline: null,
  needs: baseNeeds({ fuel: true }),
}
if (!g.canHostEmergency(g.pendingEmergency)) {
  issues.push(`refuel-only should be hostable: ${g.emergencyHostGap(g.pendingEmergency)}`)
}
const cashRefuel = g.cash
const flightsRefuel = g.flights.length
g.resolveEmergency('accept')
if (g.cash < cashRefuel + TANKER_FEE - 1) {
  issues.push(`refuel fee missing: ${cashRefuel} → ${g.cash}`)
}
if (g.flights.length <= flightsRefuel) issues.push('refuel-only should spawn landing')
const refuelAf = g.flights[g.flights.length - 1]?.airframeId
if (refuelAf && !['cl415', 'at802', 'c130', 'citation', 'pc12'].includes(refuelAf)) {
  issues.push(`unexpected airtanker frame ${refuelAf}`)
}

// Clear again for MX
for (const f of g.flights) {
  f.phase = 'gone'
  f.stand = null
}
g.flights = []
g.mechanics = Math.max(1, g.mechanics)

// Fail refuel without fuel loads
g.fuelLoads = 0
g.pendingEmergency = {
  id: 'test-nofuel',
  kind: 'tanker',
  blurb: 'empty farm',
  fee: TANKER_FEE,
  age: 0,
  deadline: 20,
  airline: null,
  needs: baseNeeds({ fuel: true }),
}
if (g.canHostEmergency(g.pendingEmergency)) {
  issues.push('empty fuel farm should block refuel host')
}
g.fuelLoads = 3

// Refuel + MX accept with hangar + fuel + mechanic
g.pendingEmergency = {
  id: 'test-mx',
  kind: 'tanker_mx',
  blurb: 'test airtanker mx',
  fee: TANKER_MX_FEE,
  age: 0,
  deadline: 20,
  airline: null,
  needs: baseNeeds({ fuel: true, hangar: true }),
}
if (!g.canHostEmergency(g.pendingEmergency)) {
  issues.push(`tanker_mx should be hostable: ${g.emergencyHostGap(g.pendingEmergency)}`)
}
const cashMx = g.cash
const flightsMx = g.flights.length
g.resolveEmergency('accept')
if (g.cash < cashMx + TANKER_MX_FEE - 1) {
  issues.push(`tanker_mx fee missing: ${cashMx} → ${g.cash}`)
}
if (g.flights.length <= flightsMx) issues.push('tanker_mx should spawn landing')

// Dry weather should be able to spawn an airtanker ask
g.flights = []
g.pendingEmergency = null
g.weather = 'clear'
g.emergencyCool = 0
g.pendingThreat = null
let dryAsk: string | null = null
for (let i = 0; i < 50 && !dryAsk; i++) {
  g.emergencyCool = 0
  g.tickEmergencies(1)
  if (g.pendingEmergency && g.pendingEmergency.kind !== 'divert') {
    dryAsk = g.pendingEmergency.kind
  } else if (g.pendingEmergency) {
    g.pendingEmergency = null
  }
}

const out = {
  ok: issues.length === 0,
  issues,
  spawnedAsk,
  dryAsk,
  fee: TANKER_FEE,
  mxFee: TANKER_MX_FEE,
  failFine: EMERGENCY_FAIL_FINE,
  news: g.news.slice(0, 8).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
