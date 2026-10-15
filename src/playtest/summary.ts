import type { PersonaReport } from './types.ts'

/** Compact row for the rerun note. The full persona report stays in report.json. */
export interface RunSummary {
  label: string
  persona: string
  daysRan: number
  cashStart: number
  cashEnd: number
  cashDay30: number | null
  cashDay60: number | null
  cashDay90: number | null
  flights: number
  flightsPerDay: number
  flightDiverts: number
  connectionDiverts: number
  goArounds: number
  missedConnectionCash: number
  curbCrossDay: number | null
  curbPeak: number
  fuelGroundings: number
  firstGroundingDay: number | null
  groundingWarnings: string[]
  treeCompleteDay: number | null
  preferredDay: number | null
  trustedDay: number | null
  hubTier: string
  hubTierDay: number | null
  fuelPurchase: number
  spotPurchase: number
  termPurchase: number
  fuelPurchasePerDay: number
  spotPurchasePerDay: number
  runway: number
  stands: number
  researchers: number
  treeNodes: number
  signed: string[]
  fieldLevel: number
  prestigeStars: number
  penaltyTotal: number
  judged: number
  missed: number
  softlocks: string[]
  errors: string[]
  marks: {
    day: number
    cash: number | null
    flights: number
    tree: number
    runway: number
    stands: number
    curb: number
    researchers: number
    field: number
    stars: number
  }[]
}

export function summarizeRun(report: PersonaReport): RunSummary {
  const last = report.days.at(-1)
  const ops = report.ops
  const cashAt = (day: number) => report.cashCurve.find((point) => point.day === day)?.cash ?? null
  const marks = report.days
    .filter((row) => row.day === 1 || row.day % 15 === 0)
    .map((row) => ({
      day: row.day,
      cash: cashAt(row.day),
      flights: row.flightsDone,
      tree: row.treeNodes,
      runway: row.runway,
      stands: row.stands,
      curb: row.curbPressure,
      researchers: row.researchers,
      field: row.fieldLevel,
      stars: row.prestigeStars,
    }))
  return {
    label: report.label,
    persona: report.persona,
    daysRan: report.daysRan,
    cashStart: Math.round(report.cashStart),
    cashEnd: Math.round(report.cashEnd),
    cashDay30: ops.cashDay30,
    cashDay60: ops.cashDay60,
    cashDay90: ops.cashDay90,
    flights: report.built.flightsDone,
    flightsPerDay: ops.flightsPerDay,
    flightDiverts: ops.flightDiverts,
    connectionDiverts: ops.connectionDiverts,
    goArounds: ops.goArounds,
    missedConnectionCash: ops.missedConnectionCash,
    curbCrossDay: ops.curbCrossDay,
    curbPeak: ops.curbPeak,
    fuelGroundings: ops.fuelGroundings,
    firstGroundingDay: ops.firstGroundingDay,
    groundingWarnings: ops.groundingWarnings,
    treeCompleteDay: ops.treeCompleteDay,
    preferredDay: ops.preferredDay,
    trustedDay: ops.trustedDay,
    hubTier: ops.hubTier,
    hubTierDay: ops.hubTierDay,
    fuelPurchase: ops.fuelPurchase,
    spotPurchase: ops.spotPurchase,
    termPurchase: ops.termPurchase,
    fuelPurchasePerDay: ops.fuelPurchasePerDay,
    spotPurchasePerDay: ops.spotPurchasePerDay,
    runway: report.built.runway,
    stands: report.built.stands,
    researchers: report.research.researchers,
    treeNodes: last?.treeNodes ?? report.research.treeUnlocked.length,
    signed: report.built.signed,
    fieldLevel: last?.fieldLevel ?? 0,
    prestigeStars: last?.prestigeStars ?? 0,
    penaltyTotal: report.books.penaltyTotal,
    judged: report.books.connections.judged,
    missed: report.books.connections.belowMct + report.books.connections.paxLate + report.books.connections.bagLate,
    softlocks: report.softlocks,
    errors: report.consoleErrors,
    marks,
  }
}
