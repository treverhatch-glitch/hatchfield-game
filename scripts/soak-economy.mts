import { Game } from '../src/game/sim.ts'
import {
  HOTEL_COST,
  LOAN_FEE,
  LOAN_PRINCIPAL,
  STARTER_KIT_COST,
  START_CASH,
} from '../src/game/catalog.ts'

function runwayStripsExist(g: Game): boolean {
  return g.longestRunway() >= 8
}

const issues: string[] = []
const g = new Game()
g.beginNew('standard')
const startCash = g.cash
if (startCash !== START_CASH.standard) {
  issues.push(`standard start cash ${startCash} != ${START_CASH.standard}`)
}

g.buyLand('city')
const afterLand = g.cash
if (afterLand < STARTER_KIT_COST) {
  issues.push(`standard city leftover ${afterLand} can't buy starter kit ${STARTER_KIT_COST}`)
}
g.buildStarterKit()
const afterKit = g.cash
if (afterKit >= afterLand) issues.push('starter kit should spend')
if (!runwayStripsExist(g)) issues.push('starter kit did not stamp runway')

g.takeLoan()
if (g.loanBalance < LOAN_PRINCIPAL) issues.push('loan not booked')
const withLoan = g.cash

g.speed = 3
let minCash = g.cash
let interestHits = 0
for (let i = 0; i < 2400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.layoverOffer && i % 300 < 50) g.acceptLayover()
  if (g.pendingEmergency && i % 2 === 0) g.resolveEmergency('accept')
  if (g.pendingThreat) g.resolveThreat('scramble')
  if (g.parkingOffer && g.freeStands().length) g.acceptParking()
  if (i === 800 && g.cash > HOTEL_COST) g.buyHotel()
  if (i === 900) g.buyCarPark('short')
  minCash = Math.min(minCash, g.cash)
}
interestHits = g.news.filter((n) => /interest/i.test(n.text)).length

if (g.signed.length < 1) issues.push('no airlines signed on standard soak')
if (g.flightsDone < 1) issues.push('zero turnarounds on standard')

const runaway = g.cash > withLoan + 500_000 && g.loanBalance === 0
if (runaway) issues.push(`cash runaway ${Math.round(g.cash)}`)
if (g.cash < -80_000) issues.push(`death spiral cash ${Math.round(g.cash)}`)
// Carrying fee should grow an unpaid loan above the opening balance.
if (g.loanBalance > 0 && g.loanBalance <= LOAN_PRINCIPAL + LOAN_FEE) {
  issues.push('loan balance should grow while open')
}
// Field ops mult should engage once airlines sign.
if (g.signed.length >= 2 && g.fieldOpsMult() <= 1.05) {
  issues.push(`field ops mult too flat: ${g.fieldOpsMult()}`)
}
// Interest must bite thrifty cash at least once below the post-loan peak.
if (minCash >= withLoan) {
  issues.push('loan/payroll never dipped cash below post-loan peak')
}

const e = new Game()
e.beginNew('easy')
e.buyLand('city')
e.buildStarterKit()
e.takeLoan()
e.speed = 3
for (let i = 0; i < 1200; i++) {
  e.tick(0.25)
  if (e.offer) e.acceptOffer()
}
if (e.cash < -40_000) issues.push(`easy path too harsh ${Math.round(e.cash)}`)
if (e.flightsDone < 5) issues.push(`easy flights too low ${e.flightsDone}`)

const out = {
  ok: issues.length === 0,
  issues,
  standard: {
    start: START_CASH.standard,
    afterLand: Math.round(afterLand),
    afterKit: Math.round(afterKit),
    kitCost: STARTER_KIT_COST,
    withLoan: Math.round(withLoan),
    end: Math.round(g.cash),
    min: Math.round(minCash),
    loan: Math.round(g.loanBalance),
    revenue: Math.round(g.revenue),
    flightsDone: g.flightsDone,
    signed: g.signed.length,
    hotel: g.hotelLevel,
    carPark: g.carParkShort,
    landside: g.landsideIncome(),
    interestNews: interestHits,
  },
  easyEnd: Math.round(e.cash),
  easyFlights: e.flightsDone,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)