import { Game } from '../src/game/sim.ts'
import { EMERGENCY_REFUSE_FINE, TANKER_FEE } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.tiles[20][10] = 'hangar'
g.speed = 3

for (let i = 0; i < 400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (!g.signed.length) {
  console.log(JSON.stringify({ ok: false, why: 'no airlines' }))
  process.exit(1)
}

// Force divert ask
g.weather = 'storm'
g.emergencyCool = 0
g.pendingThreat = null
g.tickEmergencies(1)
if (!g.pendingEmergency) {
  // Force manually
  g.pendingEmergency = {
    id: 'test-div',
    kind: 'divert',
    blurb: 'test divert',
    fee: 5000,
    age: 0,
    deadline: 20,
    airline: g.signed[0],
  }
}

const cash0 = g.cash
const heat0 = g.heatOf(g.signed[0])
g.resolveEmergency('accept')
if (g.pendingEmergency) issues.push('divert still pending after accept')
if (g.cash < cash0 + 4000) issues.push(`accept fee not paid: ${cash0} → ${g.cash}`)
if (g.heatOf(g.signed[0]) < heat0) issues.push('divert accept should raise heat')

// Tanker refuse path
g.pendingEmergency = {
  id: 'test-tank',
  kind: 'tanker',
  blurb: 'test tanker',
  fee: TANKER_FEE,
  age: 0,
  deadline: 20,
  airline: null,
}
const cash1 = g.cash
const heats = Object.fromEntries(g.signed.map((id) => [id, g.heatOf(id)]))
g.resolveEmergency('refuse')
if (g.cash > cash1 - EMERGENCY_REFUSE_FINE + 1) {
  issues.push('refuse fine not charged')
}
const anyHeatDrop = g.signed.some((id) => g.heatOf(id) < heats[id])
if (!anyHeatDrop) issues.push('refuse should ding carrier heat')

const out = {
  ok: issues.length === 0,
  issues,
  fee: TANKER_FEE,
  news: g.news.slice(0, 5).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
