import { Game } from '../src/game/sim.ts'
import { HUB_HEAT_NEED } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 40_000
g.speed = 3

for (let i = 0; i < 500; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

const id = g.signed.find((x) => g.airline(x).likesLayovers) ?? g.signed[0]
if (!id) {
  console.log(JSON.stringify({ ok: false, why: 'no signed' }))
  process.exit(1)
}

g.airlineHeat[id] = HUB_HEAT_NEED + 5
g.layoverWins[id] = 1
g.hubOfferCool = 0
g.considerHubOffer(id)
if (!g.hubOffer) issues.push('hub offer not created')
else {
  g.acceptHub()
  if (!g.isHub(id)) issues.push('not hub after accept')
  if (!g.rewardOf(id)) issues.push('hub should grant persona reward')
  const lounge = g.fits[0]?.rooms.lounge ?? 0
  if (lounge < 1) issues.push('brand lounge not added')
}

const before = g.openSchedule().filter((s) => s.airline === id).length
g.seedScheduleForAirline(id, 2)
const after = g.openSchedule().filter((s) => s.airline === id).length
if (after - before < 3) {
  issues.push(`hub seed should add denser slots (${before}→${after})`)
}

const out = {
  ok: issues.length === 0,
  issues,
  hub: g.hubAirlines,
  reward: g.rewardOf(id),
  lounge: g.fits[0]?.rooms.lounge,
  banThresh: g.banThreshold(id),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
