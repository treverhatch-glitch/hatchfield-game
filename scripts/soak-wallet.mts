import { Game } from '../src/game/sim.ts'
import { spawnHallGuest } from '../src/game/guests.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.cash += 20_000

const rich = spawnHallGuest('f1', 'depart', 'premium')
rich.wallet = 200
rich.prefs.food = 0.9
rich.needs.hunger = 80
const poor = spawnHallGuest('f2', 'depart', 'budget')
poor.wallet = 5
poor.prefs.food = 0.9
poor.needs.hunger = 80
const picky = spawnHallGuest('f3', 'depart', 'premium')
picky.wallet = 200
picky.prefs.food = 0.1
picky.needs.hunger = 40

const cash0 = g.cash
const a = g.tryGuestPay(rich, 28, 'food', true)
if (!a.ok) issues.push('rich should pay')
if (rich.wallet !== 172) issues.push(`rich wallet ${rich.wallet}`)

const b = g.tryGuestPay(poor, 14, 'food', true)
if (b.ok || b.why !== 'broke') issues.push(`poor should be broke got ${JSON.stringify(b)}`)

const c = g.tryGuestPay(picky, 28, 'food', false)
if (c.ok || c.why !== 'not interested') {
  issues.push(`picky should skip got ${JSON.stringify(c)}`)
}

// serveNode food respects wallet
poor.node = 'food'
poor.wallet = 3
const happy = poor.happiness
g.serveNode(poor, g.hallOpen())
if (poor.happiness >= happy) issues.push('broke food should hurt')
if (!/broke|Hungry/i.test(poor.thought)) issues.push(`poor thought ${poor.thought}`)

// Landside: place → expense; fees only from passenger window
g.tiles[5][5] = 'hotel'
g.hotelClass['5,5'] = 'business'
g.parkTerms['6,6'] = 'short'
g.tiles[6][6] = 'park_s'
const up = g.landsideUpkeep()
if (up <= 0) issues.push('upkeep should bite')
g.landsideFeeWindow = 0
const empty = g.landsideIncome()
if (empty !== 0) issues.push(`idle fees should be 0 got ${empty}`)
g.landsideFeeWindow = 220
const busy = g.landsideIncome()
if (!(busy > empty)) issues.push(`passenger fees should raise income ${empty}→${busy}`)
// tryGuestPay already credited fee window above
if (g.landsideFeeWindow < 220) issues.push('fee window should retain guest spends')

const out = {
  ok: issues.length === 0,
  issues,
  cashDelta: g.cash - cash0,
  empty,
  busy,
  up,
  richWallet: rich.wallet,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
