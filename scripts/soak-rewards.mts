import { Game } from '../src/game/sim.ts'
import {
  ABANDON_ACC_SECONDS,
  HEAT_ABANDON_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  rewardForPersona,
  REWARD_LABEL,
} from '../src/game/catalog.ts'
import type { AirlineId, AirlinePersona } from '../src/game/types.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.cash += 120_000
g.reputation = 70

for (let i = 0; i < 500; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (!g.signed.length) {
  console.log(JSON.stringify({ ok: false, why: 'no signed airlines', rating: g.fieldRating() }))
  process.exit(1)
}

const personaTargets: Partial<Record<AirlinePersona, AirlineId>> = {}
for (const id of g.signed) {
  const p = g.airline(id).persona
  if (!personaTargets[p]) personaTargets[p] = id
}

// Force a luxury / budget / business / cargo if missing via signed list or seed.
const needPersonas: AirlinePersona[] = ['luxury', 'budget', 'business', 'cargo_night']
for (const p of needPersonas) {
  if (personaTargets[p]) continue
  const cand = g.allAirlines().find((a) => a.persona === p)
  if (!cand) continue
  if (!g.signed.includes(cand.id)) {
    g.signed.push(cand.id)
    g.airlineHeat[cand.id] = 70
  }
  personaTargets[p] = cand.id
}

const loungeBefore =
  (g.activeHall() ?? g.fits[0])?.rooms.lounge ?? 0

// Persona reward unlocks
for (const p of needPersonas) {
  const id = personaTargets[p]
  if (!id) {
    issues.push(`no airline for persona ${p}`)
    continue
  }
  delete g.airlineReward[id]
  g.airlineHeat[id] = HEAT_REWARD_THRESHOLD + 2
  g.tickAirlineRelations(0.5)
  const got = g.rewardOf(id)
  const expect = rewardForPersona(p)
  if (got !== expect) {
    issues.push(`${p}: expected ${expect}, got ${got}`)
  }
}

const luxuryId = personaTargets.luxury
if (luxuryId && g.rewardOf(luxuryId) === 'brand_lounge') {
  const loungeAfter = (g.activeHall() ?? g.fits[0])?.rooms.lounge ?? 0
  if (loungeAfter <= loungeBefore) {
    issues.push(`luxury lounge room not added (${loungeBefore}→${loungeAfter})`)
  }
}

const budgetId = personaTargets.budget
if (budgetId && g.rewardOf(budgetId) === 'budget_perk') {
  const food = (g.activeHall() ?? g.fits[0])?.rooms.food ?? 0
  if (food < 1) issues.push('budget snack franchise did not ensure food room')
}

const bizId = personaTargets.business
if (bizId && g.landingFeeMult(bizId) < 1.1) {
  issues.push(`biz priority landing mult ${g.landingFeeMult(bizId)}`)
}

const id = g.signed[0]
const ratingBefore = g.fieldRating()
if (ratingBefore < 1 || ratingBefore > 100 || Number.isNaN(ratingBefore)) {
  issues.push(`bad field rating ${ratingBefore}`)
}

// Warn + abandon path (keep a second signed so contagion can fire)
const victim = luxuryId ?? id
const other = g.signed.find((x) => x !== victim)
if (other) g.airlineHeat[other] = 70
const otherHeatBefore = other ? g.heatOf(other) : 0
const hadReward = g.rewardOf(victim)

g.airlineHeat[victim] = HEAT_WARN_THRESHOLD - 1
g.airlineWarned[victim] = false
g.airlineLowAcc[victim] = 0
g.tickAirlineRelations(0.5)
if (!g.airlineWarned[victim]) issues.push('warning not fired')
if (!g.warnedAirlines().includes(victim)) issues.push('warnedAirlines() missing victim')
const warnNews = g.news.some((n) => /warning/i.test(n.text) && /at risk|walk/i.test(n.text))
if (!warnNews) issues.push('warn news missing at-risk copy')

g.airlineHeat[victim] = HEAT_ABANDON_THRESHOLD - 1
const steps = Math.ceil(ABANDON_ACC_SECONDS / 0.25) + 4
for (let i = 0; i < steps; i++) {
  g.airlineHeat[victim] = HEAT_ABANDON_THRESHOLD - 1
  g.tickAirlineRelations(0.25)
}
if (g.signed.includes(victim)) {
  issues.push(`airline still signed after abandon clock (acc=${g.airlineLowAcc[victim]})`)
}
if (g.rewardOf(victim)) issues.push('reward still attached after abandon')

const abandonedNews = g.news.some((n) => /abandoned/i.test(n.text))
if (!abandonedNews) issues.push('no abandon headline')
if (hadReward) {
  const lostNews = g.news.some(
    (n) =>
      n.text.includes(REWARD_LABEL[hadReward]) ||
      /lounge|franchise|priority|waiver/i.test(n.text),
  )
  if (!lostNews) issues.push('no lost-perk headline on abandon')
}
if (other && g.heatOf(other) >= otherHeatBefore) {
  issues.push(`abandon did not cool other carrier heat (${otherHeatBefore}→${g.heatOf(other)})`)
}

const rating = g.fieldRating()
const out = {
  ok: issues.length === 0,
  issues,
  rating,
  label: g.fieldRatingLabel(),
  rewards: g.airlineReward,
  personas: Object.fromEntries(
    needPersonas.map((p) => [p, personaTargets[p] ?? null]),
  ),
  warned: g.warnedAirlines(),
  signed: g.signed,
  news: g.news.slice(0, 12).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
