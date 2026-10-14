import { expect } from 'vitest'
import { Game } from '../../src/game/sim.ts'
import type {
  AirlineId,
  CaterBrand,
  Difficulty,
  FuelBrand,
  SiteKind,
  StartFocus,
  Speed,
} from '../../src/game/types.ts'

/** Seeded PRNG for reproducible sim runs. */
export function withSeed(seed: number, run: () => void) {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    run()
  } finally {
    Math.random = orig
  }
}

export interface AirportOptions {
  difficulty?: Difficulty
  sandbox?: boolean
  site?: SiteKind
  startFocus?: StartFocus
  starterKit?: boolean
  signedAirlines?: AirlineId[]
  janitors?: number
  mechanics?: number
  deskStaff?: number
  researchers?: number
  fuelBrand?: FuelBrand | null
  fuelLoads?: number
  caterBrand?: CaterBrand | null
  customSetup?: (game: Game) => void
}

export interface RunSimOptions {
  dt?: number
  speed?: Speed
  onTick?: (game: Game, tickIndex: number) => void
  onDayClose?: (game: Game, day: number) => void
}

export interface SimMetrics {
  cashPerDay: number[]
  paxServed: number
  lostPax: number
  lostBags: number
  mishandledBags: number
  stuckVehicles: string[]
  nanErrors: string[]
}

/**
  * Builds a seeded test airport instance with requested options.
  */
export function createTestAirport(options: AirportOptions = {}): Game {
  const game = new Game()
  game.sandbox = options.sandbox ?? false
  game.beginNew(options.difficulty ?? 'easy')
  game.startFocus = options.startFocus ?? 'pax'

  const site = options.site ?? 'city'
  game.buyLand(site)

  if (options.starterKit !== false) {
    game.buildStarterKit()
  }

  const airlines = options.signedAirlines ?? ['northline']
  for (const airlineId of airlines) {
    if (!game.signed.includes(airlineId)) {
      game.signed.push(airlineId)
      if (game.airlineHeat[airlineId] == null) {
        game.airlineHeat[airlineId] = 70
      }
      game.seedScheduleForAirline(airlineId, 3)
    }
  }

  if (options.janitors) {
    game.janitors = options.janitors
  }
  if (options.mechanics) {
    game.mechanics = options.mechanics
    for (let i = 0; i < options.mechanics; i++) {
      game.spawnMechanicPawn()
    }
  }
  if (options.deskStaff) {
    game.deskStaff = options.deskStaff
    game.assignHallStaff()
  }
  if (options.researchers) {
    game.researchers = options.researchers
  }

  if (options.fuelBrand !== undefined) {
    game.fuelBrand = options.fuelBrand
  }
  if (options.fuelLoads !== undefined) {
    game.fuelLoads = options.fuelLoads
  }
  if (options.caterBrand !== undefined) {
    game.caterBrand = options.caterBrand
  }

  if (options.customSetup) {
    options.customSetup(game)
  }

  return game
}

/**
  * Inspects all game state numeric fields to ensure no NaN or Infinite values exist.
  */
export function checkNaN(game: Game): string[] {
  const errors: string[] = []

  function verify(label: string, value: unknown) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        errors.push(`NaN/Infinite value found at ${label}: ${value}`)
      }
    }
  }

  verify('game.cash', game.cash)
  verify('game.revenue', game.revenue)
  verify('game.reputation', game.reputation)
  verify('game.loanBalance', game.loanBalance)
  verify('game.loanPrincipal', game.loanPrincipal)
  verify('game.loanOpened', game.loanOpened)
  verify('game.sharePrice', game.sharePrice)
  verify('game.fieldXp', game.fieldXp)
  verify('game.researchPoints', game.researchPoints)
  verify('game.flightsDone', game.flightsDone)
  verify('game.paxServed', game.paxServed)
  verify('game.bagsLost', game.bagsLost)
  verify('game.bagsMishandled', game.bagsMishandled)
  verify('game.missedConnections', game.missedConnections)

  for (const [key, val] of Object.entries(game.groundBooks)) {
    verify(`groundBooks.${key}`, val)
  }

  for (const entry of game.bank.ledger().entries) {
    verify(`bank.entry.amount(${entry.category})`, entry.amount)
    verify(`bank.entry.balance(${entry.category})`, entry.balanceAfter)
  }

  for (const p of game.settledPayments) {
    verify(`settledPayment.amount(${p.flightNo})`, p.amount)
  }

  for (const h of game.econHist) {
    verify('econHist.cash', h.cash)
    verify('econHist.income', h.income)
    verify('econHist.expense', h.expense)
    verify('econHist.pax', h.pax)
  }

  return errors
}

/**
  * Checks for stuck vehicles (trucks or aircraft stuck in phase/dwell).
  */
export function checkStuckVehicles(game: Game): string[] {
  const stuck: string[] = []

  for (const t of game.trucks) {
    if (t.dwell > 200 || t.preDwell > 200) {
      stuck.push(`Truck ${t.id} (${t.kind}) stuck in dwell=${t.dwell}, preDwell=${t.preDwell}`)
    }
  }

  for (const f of game.flights) {
    if (f.phase !== 'gone' && f.phase !== 'hold' && f.phase !== 'parked') {
      if (f.phaseTime > 240) {
        stuck.push(`Flight ${f.flightNo} (${f.id}) stuck in phase ${f.phase} for ${Math.round(f.phaseTime)}s`)
      }
    }
  }

  for (const alert of game.alerts.active) {
    if (alert.key.includes('stuck') || alert.title.toLowerCase().includes('stuck')) {
      stuck.push(`Alert stack contains stuck issue: ${alert.title} - ${alert.detail}`)
    }
  }

  return stuck
}

/**
  * Runs the simulation for `days` game days (1 day = 180 sim seconds).
  */
export function runSimDays(game: Game, days: number, options: RunSimOptions = {}): SimMetrics {
  const dt = options.dt ?? 0.25
  const speed = options.speed ?? 5
  game.speed = speed

  const cashPerDay: number[] = [game.cash]
  let currentDay = 0
  const simSecondsPerDay = 180
  const totalSimSeconds = days * simSecondsPerDay
  const simStepSeconds = dt * speed

  const totalTicks = Math.ceil(totalSimSeconds / simStepSeconds)

  for (let i = 0; i < totalTicks; i++) {
    game.tick(dt)

    if (options.onTick) {
      options.onTick(game, i)
    }

    const day = Math.floor(game.clock / simSecondsPerDay)
    if (day > currentDay) {
      while (currentDay < day) {
        currentDay++
        cashPerDay[currentDay] = game.cash
        if (options.onDayClose) {
          options.onDayClose(game, currentDay)
        }
      }
    }
  }

  const nanErrors = checkNaN(game)
  const stuckVehicles = checkStuckVehicles(game)

  return {
    cashPerDay,
    paxServed: game.paxServed,
    lostPax: game.lostPaxCount(),
    lostBags: game.bagsLost,
    mishandledBags: game.bagsMishandled,
    stuckVehicles,
    nanErrors,
  }
}

/**
  * Asserts that cash growth between day 20 and day 30 (or start/end days) is bounded by maxGrowthFactor.
  */
export function assertBoundedCashGrowth(
  cashPerDay: number[],
  startDay = 20,
  endDay = 30,
  maxGrowthFactor = 3,
) {
  if (cashPerDay.length <= endDay) {
    return
  }
  const startCash = Math.max(1000, cashPerDay[startDay] ?? 0)
  const endCash = cashPerDay[endDay] ?? 0

  if (startCash > 0 && endCash > startCash) {
    const growth = endCash / startCash
    expect(growth).toBeLessThanOrEqual(maxGrowthFactor)
  }
}

/**
  * Standard assertion bundle for headless sim scenarios.
  */
export function assertSimHealth(metrics: SimMetrics, options: {
  maxLostPax?: number
  maxLostBags?: number
  allowStuck?: boolean
} = {}) {
  expect(metrics.nanErrors).toEqual([])
  if (!options.allowStuck) {
    expect(metrics.stuckVehicles).toEqual([])
  }
  expect(metrics.lostPax).toBeLessThanOrEqual(options.maxLostPax ?? 0)
  expect(metrics.lostBags).toBeLessThanOrEqual(options.maxLostBags ?? 0)
}
