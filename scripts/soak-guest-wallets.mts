/**
 * RCT guest wallets — random cash bands by type; prefs + price sensitivity gate spends.
 */
import {
  rollPaxTag,
  rollPrefs,
  rollWallet,
  spawnHallGuest,
  tagPrice,
} from '../src/game/guests.ts'
import { Game } from '../src/game/sim.ts'

const issues: string[] = []

// Tag mix by persona
const luxuryTags = Array.from({ length: 80 }, () => rollPaxTag('luxury'))
const budgetTags = Array.from({ length: 80 }, () => rollPaxTag('budget'))
const luxPremium = luxuryTags.filter((t) => t === 'premium' || t === 'business').length
const budBudget = budgetTags.filter((t) => t === 'budget' || t === 'family').length
if (luxPremium < 40) issues.push(`luxury mix too poor ${luxPremium}/80`)
if (budBudget < 45) issues.push(`budget mix too rich ${budBudget}/80`)

// Wallet bands — types differ, variance inside type
const wallets = {
  budget: Array.from({ length: 60 }, () => rollWallet('budget')),
  family: Array.from({ length: 60 }, () => rollWallet('family')),
  business: Array.from({ length: 60 }, () => rollWallet('business')),
  premium: Array.from({ length: 60 }, () => rollWallet('premium')),
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const avgB = avg(wallets.budget)
const avgF = avg(wallets.family)
const avgBiz = avg(wallets.business)
const avgP = avg(wallets.premium)
if (!(avgB < avgF && avgF < avgBiz && avgBiz < avgP)) {
  issues.push(`wallet ladder broken ${avgB}|${avgF}|${avgBiz}|${avgP}`)
}
if (Math.min(...wallets.budget) > 20) issues.push('budget should roll some broke guests')
if (Math.max(...wallets.premium) < 200) issues.push('premium should roll some whales')

// Prefs always present including landside
const prefs = rollPrefs('family', true)
if (prefs.landside === undefined || prefs.food === undefined) {
  issues.push('prefs missing landside/food')
}

// tryGuestPay gates
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()

const rich = spawnHallGuest('f1', 'depart', 'premium')
rich.wallet = 200
rich.prefs.food = 0.9
const picky = spawnHallGuest('f2', 'depart', 'premium')
picky.wallet = 200
picky.prefs.food = 0.1
const thrifty = spawnHallGuest('f3', 'depart', 'budget')
thrifty.wallet = 40
thrifty.prefs.food = 0.9

if (!g.tryGuestPay(rich, 28, 'food', false).ok) issues.push('rich+interested should pay')
if (g.tryGuestPay(picky, 28, 'food', false).ok) issues.push('low pref should skip')
const pricey = g.tryGuestPay(thrifty, 32, 'food', false)
if (pricey.ok || pricey.why !== 'too expensive') {
  issues.push(`price sensitivity want too expensive got ${JSON.stringify(pricey)}`)
}
const broke = spawnHallGuest('f4', 'depart', 'budget')
broke.wallet = 5
broke.prefs.food = 0.95
if (g.tryGuestPay(broke, 14, 'food', true).ok) issues.push('broke desperate still cannot pay')

// Menu ladder
if (!(tagPrice('budget', 10, 20, 30, 40) === 10)) issues.push('tagPrice budget')
if (!(tagPrice('premium', 10, 20, 30, 40) === 40)) issues.push('tagPrice premium')

// Seeded hall has mixed wallets
g.signed = ['northline']
g.airlineHeat.northline = 80
g.seedHallForFlight(
  {
    id: 'fx',
    airline: 'northline',
    pax: 140,
    cargo: false,
    stand: { c: 12, r: 21 },
  } as never,
  'depart',
)
const seeded = g.hallGuests
if (seeded.length < 6) issues.push('expected hall guests')
const uniqTags = new Set(seeded.map((x) => x.tag))
const walletSpread = Math.max(...seeded.map((x) => x.wallet)) - Math.min(...seeded.map((x) => x.wallet))
if (walletSpread < 15) issues.push(`wallet spread too flat ${walletSpread}`)
if (!seeded.every((x) => x.prefs.landside >= 0 && x.prefs.landside <= 1)) {
  issues.push('landside pref out of range')
}

const out = {
  ok: issues.length === 0,
  issues,
  avgs: {
    budget: Math.round(avgB),
    family: Math.round(avgF),
    business: Math.round(avgBiz),
    premium: Math.round(avgP),
  },
  seeded: {
    n: seeded.length,
    tags: [...uniqTags],
    walletSpread,
    sample: seeded.slice(0, 4).map((x) => ({
      tag: x.tag,
      wallet: x.wallet,
      food: +x.prefs.food.toFixed(2),
      landside: +x.prefs.landside.toFixed(2),
    })),
  },
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
