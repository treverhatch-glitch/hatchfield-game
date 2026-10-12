import { Game } from '../src/game/sim.ts'
import {
  ABANDON_ACC_SECONDS,
  HEAT_ABANDON_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
} from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3

for (let i = 0; i < 400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (!g.signed.length) {
  console.log(JSON.stringify({ ok: false, why: 'no signed airlines', rating: g.fieldRating() }))
  process.exit(1)
}

const id = g.signed[0]
const ratingBefore = g.fieldRating()
if (ratingBefore < 1 || ratingBefore > 100 || Number.isNaN(ratingBefore)) {
  issues.push(`bad field rating ${ratingBefore}`)
}

// Force reward unlock
g.airlineHeat[id] = HEAT_REWARD_THRESHOLD + 2
g.tickAirlineRelations(0.5)
if (!g.rewardOf(id)) issues.push(`reward not granted at heat ${g.heatOf(id)}`)

const feeMult = g.landingFeeMult(id)
if (feeMult < 1) issues.push(`landing mult ${feeMult}`)

// Recover then force warn + abandon path
g.airlineHeat[id] = HEAT_WARN_THRESHOLD - 1
g.airlineWarned[id] = false
g.airlineLowAcc[id] = 0
g.tickAirlineRelations(0.5)
if (!g.airlineWarned[id]) issues.push('warning not fired')

g.airlineHeat[id] = HEAT_ABANDON_THRESHOLD - 1
// Freeze recovery by pinning heat each tick
const steps = Math.ceil(ABANDON_ACC_SECONDS / 0.25) + 4
for (let i = 0; i < steps; i++) {
  g.airlineHeat[id] = HEAT_ABANDON_THRESHOLD - 1
  g.tickAirlineRelations(0.25)
}
if (g.signed.includes(id)) {
  issues.push(`airline still signed after abandon clock (acc=${g.airlineLowAcc[id]})`)
}

const abandonedNews = g.news.some((n) => /abandoned/i.test(n.text))
if (!abandonedNews) issues.push('no abandon headline')

const rating = g.fieldRating()
const out = {
  ok: issues.length === 0,
  issues,
  rating,
  label: g.fieldRatingLabel(),
  rewards: g.airlineReward,
  signed: g.signed,
  news: g.news.slice(0, 8).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
