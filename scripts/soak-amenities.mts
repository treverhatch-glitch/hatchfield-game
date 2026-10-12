/**
 * Hall entertainment / spend: golf, spa, pool, retail, gaming, waterfall.
 */
import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 80_000
g.speed = 3

const fit = g.fits[0]
if (!fit) {
  console.log(JSON.stringify({ ok: false, why: 'no hall' }))
  process.exit(1)
}

fit.rooms.golf = 1
fit.rooms.spa = 1
fit.rooms.pool = 1
fit.rooms.gaming = 1
fit.rooms.waterfall = 1
fit.rooms.souvenir = Math.max(1, fit.rooms.souvenir)
fit.rooms.food = Math.max(1, fit.rooms.food)
fit.rooms.lounge = Math.max(1, fit.rooms.lounge)
fit.rooms.dayhotel = 1

const open = g.hallOpen()
for (const n of ['golf', 'spa', 'pool', 'gaming', 'waterfall', 'shop', 'dayhotel'] as const) {
  if (!open.has(n === 'shop' ? 'shop' : n)) issues.push(`missing open node ${n}`)
}

if (!g.hallReadyForLayover()) issues.push('layover hall should be ready with amenities')

g.signed = ['northline', 'harbor']
g.airlineHeat.northline = 85
g.airlineHeat.harbor = 85

const rev0 = g.revenue
g.seedHallForFlight(
  {
    id: 'f-amen',
    airline: 'harbor',
    pax: 140,
    cargo: false,
    stand: { c: 12, r: 21 },
  } as never,
  'depart',
)

// Force some guests into amenity nodes and serve
let spaPay = 0
let poolPay = 0
let golfPay = 0
let shopPay = 0
for (const guest of g.hallGuests) {
  guest.clearedSec = true
  guest.wallet = 200
  guest.prefs.lounge = 0.9
  guest.prefs.play = 0.9
  guest.prefs.shop = 0.9
  guest.needs.energy = 80
  guest.needs.play = 80
  guest.needs.shop = 80
  g.serveNode(guest, open)
  // Route and serve each amenity
  for (const node of ['spa', 'pool', 'golf', 'shop'] as const) {
    if (!open.has(node)) continue
    guest.node = node
    guest.wallet = 200
    guest.needs.energy = 85
    guest.needs.play = 85
    guest.needs.shop = 85
    const before = guest.spent
    g.serveNode(guest, open)
    const delta = guest.spent - before
    if (node === 'spa' && delta > 0) spaPay++
    if (node === 'pool' && delta > 0) poolPay++
    if (node === 'golf' && delta > 0) golfPay++
    if (node === 'shop' && delta > 0) shopPay++
  }
}

if (spaPay < 1) issues.push('spa never charged')
if (poolPay < 1) issues.push('pool never charged')
if (golfPay < 1) issues.push('golf never charged')
if (shopPay < 1) issues.push('retail never charged')
if (!(g.revenue > rev0)) issues.push('amenities did not raise revenue')

const out = {
  ok: issues.length === 0,
  issues,
  spaPay,
  poolPay,
  golfPay,
  shopPay,
  revenueGain: Math.round(g.revenue - rev0),
  openAmenity: ['golf', 'spa', 'pool', 'gaming', 'waterfall', 'dayhotel'].filter((n) =>
    open.has(n as never),
  ),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
