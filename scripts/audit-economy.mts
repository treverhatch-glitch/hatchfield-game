/**
 * Deep economy audit: setup, loan, early/mid/late cash under thrifty vs spender.
 * Prints phase snapshots — used to judge challenge curve.
 */
import { Game } from '../src/game/sim.ts'
import {
  BUDGET_BASE,
  HEAVY_RUNWAY_COST,
  HANGAR_COST,
  HOTEL_COST,
  LOAN_FEE,
  LOAN_INTEREST,
  LOAN_PRINCIPAL,
  PARCEL_COST,
  POLICE_COST,
  RESEARCHER_HIRE,
  STARTER_KIT_COST,
  START_CASH,
  TOWER_COST,
  LAND,
} from '../src/game/catalog.ts'

type Snap = {
  t: number
  cash: number
  loan: number
  net: number
  rev: number
  flights: number
  signed: number
  payroll: number
  landside: number
}

function snap(g: Game): Snap {
  return {
    t: Math.round(g.clock),
    cash: Math.round(g.cash),
    loan: Math.round(g.loanBalance),
    net: Math.round(g.cash - g.loanBalance),
    rev: Math.round(g.revenue),
    flights: g.flightsDone,
    signed: g.signed.length,
    payroll: Math.round(g.payrollPreview()),
    landside: Math.round(g.landsideIncome()),
  }
}

function boot(diff: 'easy' | 'standard', loan: boolean): Game {
  const g = new Game()
  g.beginNew(diff)
  g.buyLand('city')
  g.buildStarterKit()
  if (loan) g.takeLoan()
  g.speed = 3
  return g
}

function run(
  label: string,
  g: Game,
  ticks: number,
  spend: 'thrifty' | 'grow' | 'splurge',
): { label: string; setup: Snap; phases: Snap[]; minCash: number; minNet: number; bankruptTicks: number } {
  const setup = snap(g)
  let minCash = g.cash
  let minNet = g.cash - g.loanBalance
  let bankruptTicks = 0
  const phases: Snap[] = []
  const marks = [200, 500, 1000, 2000, 4000].filter((t) => t <= ticks)
  const done = {
    repay: false,
    hangar: false,
    police: false,
    hotel: false,
    park: false,
    lab: false,
    heavy: false,
    parcel: false,
    staff: false,
    ipo: false,
  }

  for (let i = 0; i < ticks; i++) {
    g.tick(0.25)
    if (g.offer) g.acceptOffer()
    if (g.mxOffer && spend !== 'thrifty') g.acceptMxOffer()
    if (g.layoverOffer && spend === 'splurge') g.acceptLayover()
    if (g.parkingOffer && g.freeStands().length) g.acceptParking()
    if (g.pendingEmergency && i % 3 === 0) g.resolveEmergency('accept')
    if (g.pendingThreat) g.resolveThreat(spend === 'thrifty' ? 'ignore' : 'scramble')
    if (g.hubOffer && spend === 'splurge') g.acceptHub()

    // Growth spends once each when affordable (wider than a 5s clock window).
    const c = g.clock
    if (spend === 'grow' || spend === 'splurge') {
      if (
        !done.repay &&
        c > 60 &&
        g.loanBalance > 0 &&
        g.cash > g.loanBalance + 8_000
      ) {
        g.repayLoan()
        done.repay = g.loanBalance <= 0
      }
      if (
        !done.hangar &&
        c > 130 &&
        tilesOfHangar(g) === 0 &&
        g.cash > HANGAR_COST + 10_000
      ) {
        g.tool = 'hangar'
        g.placeSingle({ c: 10, r: 20 })
        g.hireMechanic()
        done.hangar = tilesOfHangar(g) > 0
      }
      if (
        !done.police &&
        c > 170 &&
        tilesOfPolice(g) === 0 &&
        g.cash > POLICE_COST + 6_000
      ) {
        g.tool = 'police'
        g.placeSingle({ c: 14, r: 20 })
        done.police = tilesOfPolice(g) > 0
      }
      if (!done.hotel && c > 260 && g.cash > HOTEL_COST + 14_000 && g.hotelLevel < 1) {
        g.buyHotel()
        done.hotel = g.hotelLevel >= 1
      }
      if (!done.park && c > 300 && !g.carParkShort && g.cash > 14_000) {
        g.buyCarPark('short')
        done.park = g.carParkShort
      }
      if (!done.lab && c > 380 && g.cash > RESEARCHER_HIRE * 2 + 10_000) {
        g.hireResearcher()
        if (g.fits[0]) g.fits[0].rooms.rdesk += 1
        done.lab = g.researchers >= 1
      }
      if (!done.heavy && c > 520 && g.cash > HEAVY_RUNWAY_COST + 25_000) {
        for (let col = 4; col < 24; col++) {
          g.tiles[10][col] = 'runway'
          g.tiles[11][col] = 'runway'
          g.tiles[12][col] = 'runway'
        }
        g.cash -= HEAVY_RUNWAY_COST
        g.pushNews('Heavy strip (audit spend)', 'ok')
        done.heavy = true
      }
      if (!done.parcel && c > 620 && g.cash > PARCEL_COST * g.parcels + 12_000) {
        g.buyParcel()
        done.parcel = true
      }
      if (spend === 'splurge') {
        if (!done.staff && c > 700 && g.cash > 20_000) {
          g.hireDeskStaff()
          g.hireDeskStaff()
          g.hireJanitor()
          g.hireResearcher()
          done.staff = true
        }
        if (!done.ipo && c > 900 && g.cash > 45_000 && !g.public) {
          g.goPublic()
          done.ipo = g.public
        }
      }
    }

    // Keep fuel stocked if we can
    if (g.fuelBrand && g.fuelLoads < 2 && g.cash > 8_000) g.buyLoads()

    minCash = Math.min(minCash, g.cash)
    minNet = Math.min(minNet, g.cash - g.loanBalance)
    if (g.cash < 2_000) bankruptTicks++

    for (const m of marks) {
      if (Math.abs(g.clock - m) < 0.3 && !phases.some((p) => p.t === m)) {
        phases.push(snap(g))
      }
    }
  }
  phases.push(snap(g))
  return {
    label,
    setup,
    phases,
    minCash: Math.round(minCash),
    minNet: Math.round(minNet),
    bankruptTicks,
  }
}

function tilesOfHangar(g: Game) {
  let n = 0
  for (const row of g.tiles) for (const t of row) if (t === 'hangar') n++
  return n
}
function tilesOfPolice(g: Game) {
  let n = 0
  for (const row of g.tiles) for (const t of row) if (t === 'police') n++
  return n
}
function tilesOfTower(g: Game) {
  let n = 0
  for (const row of g.tiles) for (const t of row) if (t === 'tower') n++
  return n
}

// Setup math
const setupMath = {
  easy: {
    start: START_CASH.easy,
    land: LAND.city.cost,
    afterLand: START_CASH.easy - LAND.city.cost,
    kit: STARTER_KIT_COST,
    afterKit: START_CASH.easy - LAND.city.cost - STARTER_KIT_COST,
    loanIn: LOAN_PRINCIPAL,
    loanOwe: LOAN_PRINCIPAL + LOAN_FEE,
    afterLoan:
      START_CASH.easy - LAND.city.cost - STARTER_KIT_COST + LOAN_PRINCIPAL,
  },
  standard: {
    start: START_CASH.standard,
    land: LAND.city.cost,
    afterLand: START_CASH.standard - LAND.city.cost,
    kit: STARTER_KIT_COST,
    afterKit: START_CASH.standard - LAND.city.cost - STARTER_KIT_COST,
    loanIn: LOAN_PRINCIPAL,
    loanOwe: LOAN_PRINCIPAL + LOAN_FEE,
    afterLoan:
      START_CASH.standard - LAND.city.cost - STARTER_KIT_COST + LOAN_PRINCIPAL,
  },
  interestPerMin: LOAN_INTEREST, // every 60s
  payrollBaseFull: Object.values(BUDGET_BASE).reduce((a, b) => a + b, 0),
}

const runs = [
  run('std-thrifty-loan', boot('standard', true), 4000, 'thrifty'),
  run('std-grow-loan', boot('standard', true), 4000, 'grow'),
  run('std-splurge-loan', boot('standard', true), 4000, 'splurge'),
  run('std-thrifty-noloan', boot('standard', false), 2000, 'thrifty'),
  run('easy-grow-loan', boot('easy', true), 4000, 'grow'),
]

// Pressure scores: how often cash was scary; whether net went negative; late cash vs mid
function pressure(r: (typeof runs)[0]) {
  const mid = r.phases.find((p) => p.t >= 500 && p.t <= 1100) ?? r.phases[1]
  const late = r.phases[r.phases.length - 1]
  const midCash = mid?.cash ?? 0
  const lateCash = late?.cash ?? 0
  const snowball = lateCash > midCash * 2.5 && lateCash > 200_000
  const alwaysRich = r.minCash > 40_000
  const earlyTight = r.setup.cash < 15_000
  return {
    earlyTight,
    alwaysRich,
    snowball,
    minCash: r.minCash,
    minNet: r.minNet,
    bankruptTicks: r.bankruptTicks,
    midCash,
    lateCash,
    lateNet: late?.net ?? 0,
    flights: late?.flights ?? 0,
    signed: late?.signed ?? 0,
  }
}

const out = {
  setupMath,
  runs: runs.map((r) => ({
    label: r.label,
    setup: r.setup,
    phases: r.phases,
    pressure: pressure(r),
  })),
  verdictHints: runs.map((r) => {
    const p = pressure(r)
    const notes: string[] = []
    if (p.earlyTight) notes.push('early tight OK')
    if (p.alwaysRich) notes.push('WARN never felt poor after loan')
    if (p.snowball) notes.push('WARN late snowball')
    if (p.minNet < -20_000) notes.push('loan debt pressure present')
    if (p.bankruptTicks > 50) notes.push('near-bankrupt moments')
    if (!p.snowball && !p.alwaysRich) notes.push('challenge OK')
    return { label: r.label, notes, ...p }
  }),
}
console.log(JSON.stringify(out, null, 2))
