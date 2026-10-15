/**
 * Barge parcels. Only a riverside field has a water edge.
 * The parcel is one day of the contract's rail rate, and it takes 6 game hours.
 * The price uses the same cut as a flowing rail spur.
 */
import { PIPELINE } from './pipeline.ts'

export const BARGE = {
  /** Stamp cost. The parcel itself is billed at the term. */
  berthCost: 28_000,
  berthUpkeepPerDay: 320,
  /** Game hours from an empty berth to the parcel. */
  leadHours: 6,
  /** Hours in the rail day the parcel matches. */
  dayHours: 24,
  /** Plot row along the river. The starter plot is inland of this. */
  waterPlotRow: 0,
  /** Map size and plot grid. One plot is size/cols cells on a side. */
  mapSize: 32,
  plotCols: 4,
  plotRows: 4,
  card: 'The berth is empty. Call a spot truck until the next parcel, or switch the term.',
} as const

export function bargeLeadMinutes(): number {
  return BARGE.leadHours * 60
}

export function bargeParcelLitres(railLitresPerHour: number): number {
  return Math.max(0, railLitresPerHour) * BARGE.dayHours
}

/** Riverside city has a river. The industrial plot does not. */
export function siteHasWater(site: string | null | undefined): boolean {
  return site === 'city'
}

export function cellPlotId(c: number, r: number): string {
  const spanC = BARGE.mapSize / BARGE.plotCols
  const spanR = BARGE.mapSize / BARGE.plotRows
  const col = Math.min(BARGE.plotCols - 1, Math.max(0, Math.floor(c / spanC)))
  const row = Math.min(BARGE.plotRows - 1, Math.max(0, Math.floor(r / spanR)))
  return `${col},${row}`
}

/** North edge of a river plot. Inland cells of that plot are not the berth. */
export function cellOnWater(c: number, r: number, site: string | null | undefined): boolean {
  if (!siteHasWater(site) || r !== 0) return false
  const row = Number(cellPlotId(c, r).split(',')[1])
  return row === BARGE.waterPlotRow
}

/** Same differential as rail, and only while the berth is actually open. */
export function bargeCut(open: boolean): number {
  return open ? PIPELINE.railDifferential : 0
}
