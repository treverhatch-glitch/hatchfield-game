import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Game } from './sim.ts'
import { CASH_DEBT_FLOOR, THREAT_SCRAMBLE_COST } from './catalog.ts'
import type { BudgetKey } from './types.ts'

const ENABLED = process.env.SOAK_PERSONAS === '1'
const DAYS = 30
const SPEED = 5
const TICKS = (DAYS * 180) / SPEED
const BUDGET_KEYS: BudgetKey[] = ['maintenance', 'security', 'cleaning', 'fire', 'ambulance']

type Persona = 'careful' | 'greedy' | 'chaotic'

function fresh(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = SPEED
  return game
}

function setBudgets(game: Game, pct: number) {
  for (const key of BUDGET_KEYS) game.setBudget(key, pct)
}

function biggestLoan(game: Game): number {
  const open = game.availableLoans()
  if (!open.length) return 0
  return open.reduce((best, product) => (product.principal > best.principal ? product : best)).principal
}

function hireWave(game: Game) {
  game.hireMechanic()
  game.hireJanitor()
  game.hireDeskStaff()
  game.hireResearcher()
}

function spendWave(game: Game) {
  if (game.hotelLevel < 1) game.buyHotel()
  if (!game.carParkShort) game.buyCarPark('short')
  if (!game.carParkLong) game.buyCarPark('long')
  if (!game.railLinked) game.investRail()
}

function careful(game: Game) {
  setBudgets(game, 80)
  if (game.loanBalance <= 0 && game.signed.length === 0) game.drawLoan(25_000)
  if (game.offer) {
    if (game.signed.length < 2) game.acceptOffer()
    else game.declineOffer()
  }
  if (game.pendingEmergency) {
    const gap = game.emergencyHostGap(game.pendingEmergency)
    game.resolveEmergency(gap ? 'refuse' : 'accept')
  }
  if (game.pendingThreat) {
    if (game.cash > THREAT_SCRAMBLE_COST + 2_000) game.resolveThreat('scramble')
    else game.resolveThreat('ignore')
  }
  const ask = game.fieldAskOffer()
  if (ask?.enabled && ask.cost > 0 && ask.cost <= ask.bonus && ask.cost <= game.cash * 0.4) {
    game.buildFieldTask()
  }
}

function greedy(game: Game, step: number) {
  setBudgets(game, 100)
  if (game.loanBalance <= 0) {
    const principal = biggestLoan(game)
    if (principal > 0) game.drawLoan(principal)
  }
  if (game.offer) game.acceptOffer()
  if (game.pendingEmergency) game.resolveEmergency('accept')
  if (game.pendingThreat) game.resolveThreat('scramble')
  if (step % 40 === 0) {
    spendWave(game)
    hireWave(game)
  }
}

function chaotic(game: Game, step: number, rng: () => number) {
  setBudgets(game, 40 + Math.floor(rng() * 61))
  if (game.offer) {
    if (rng() < 0.55) game.acceptOffer()
    else game.declineOffer()
  }
  if (game.pendingEmergency) game.resolveEmergency(rng() < 0.5 ? 'accept' : 'refuse')
  if (game.pendingThreat) game.resolveThreat(rng() < 0.5 ? 'scramble' : 'ignore')
  if (game.loanBalance <= 0 && rng() < 0.04) {
    const principal = biggestLoan(game)
    if (principal > 0 && rng() < 0.7) game.drawLoan(principal)
  }
  if (step % 90 === 0 && rng() < 0.5) spendWave(game)
  if (step % 70 === 0 && rng() < 0.6) hireWave(game)
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SoakRow {
  persona: Persona
  setupCash: number
  endCash: number
  delta: number
  minCash: number
  loanBalance: number
  signed: number
  flightsDone: number
  payrollMisses: number
  day: number
  atDebtFloor: boolean
  bankrupt: boolean
  profitable: boolean
}

export function runPersona(persona: Persona): SoakRow {
  const game = fresh()
  const setupCash = game.cash
  const rng = mulberry32(persona === 'careful' ? 11 : persona === 'greedy' ? 29 : 1810)
  const simRandom = Math.random
  Math.random = mulberry32(persona === 'careful' ? 101 : persona === 'greedy' ? 202 : 303)
  const seen = new Set<string>()
  let minCash = game.cash
  let payrollMisses = 0
  try {
  for (let step = 0; step < TICKS; step++) {
    if (persona === 'careful') careful(game)
    else if (persona === 'greedy') greedy(game, step)
    else chaotic(game, step, rng)
    game.tick(1)
    for (const item of game.news) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      if (/payroll missed|payroll short/i.test(item.text)) payrollMisses += 1
    }
    if (game.cash < minCash) minCash = game.cash
  }
  } finally {
    Math.random = simRandom
  }
  const end = game.cash
  if (process.env.SOAK_TRACE === '1') {
    const labels: Record<string, { n: number; sum: number }> = {}
    for (const entry of game.bank.ledger().entries) {
      if (entry.category !== 'penalties') continue
      const key = `${entry.meta.source ?? 'sim'} ${entry.meta.label ?? ''} ${entry.amount}`
      const row = labels[key] ?? { n: 0, sum: 0 }
      row.n += 1
      row.sum += entry.amount
      labels[key] = row
    }
    writeFileSync(
      `/tmp/soak-categories-${persona}.json`,
      JSON.stringify({ byCategory: game.bank.ledger().byCategory, penalties: labels }, null, 2),
    )
  }
  return {
    persona,
    setupCash: Math.round(setupCash),
    endCash: Math.round(end),
    delta: Math.round(end - setupCash),
    minCash: Math.round(minCash),
    loanBalance: Math.round(game.loanBalance),
    signed: game.signed.length,
    flightsDone: game.flightsDone,
    payrollMisses,
    day: Math.floor(game.clock / 180),
    atDebtFloor: end <= CASH_DEBT_FLOOR + 1,
    bankrupt: end <= 0 || end <= CASH_DEBT_FLOOR + 1,
    profitable: end > setupCash + 10_000 && end > 0,
  }
}

describe.skipIf(!ENABLED)('persona soak', () => {
  it(
    'runs careful, greedy, and chaotic for 30 game days',
    () => {
      const rows = ((process.env.SOAK_ONLY?.split(',') as Persona[] | undefined) ?? ['careful', 'greedy', 'chaotic']).map(
      (persona) => runPersona(persona),
    )
      const report = { days: DAYS, ticks: TICKS, rows }
      writeFileSync('/tmp/soak-personas.json', JSON.stringify(report, null, 2))
      console.log(JSON.stringify(report, null, 2))
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((row) => row.day >= DAYS)).toBe(true)
    },
    120_000,
  )
})
