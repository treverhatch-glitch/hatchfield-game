import { finite, nonNegative } from './num.ts'

/**
 * Daily passenger capacity is the minimum of five links.
 * The binding link is the one that sets that minimum (ties keep the earlier link).
 * Numbers live on the plant so balance stays in data, not in the min() call.
 */

export const CAPACITY_LINKS = ['terminal', 'security', 'checkin', 'gates', 'bhs'] as const
export type CapacityLink = (typeof CAPACITY_LINKS)[number]

/** ICAO aerodrome reference code letter (wingspan). */
export type IcaoClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export const ICAO_CLASSES: readonly IcaoClass[] = ['A', 'B', 'C', 'D', 'E', 'F']

/** Typical turns per stand per day, by ICAO class. Tunable. */
export const DEFAULT_TURNS_BY_ICAO: Record<IcaoClass, number> = {
  A: 12,
  B: 8,
  C: 6,
  D: 5,
  E: 4,
  F: 3,
}

/** Typical passengers per turn (seats × load), by ICAO class. Tunable. */
export const DEFAULT_PAX_PER_TURN: Record<IcaoClass, number> = {
  A: 4,
  B: 50,
  C: 150,
  D: 210,
  E: 280,
  F: 420,
}

/** Checked bags per passenger used to turn BHS bags/hour into pax/hour. */
export const BAGS_PER_PAX = 0.8

export interface StandGroup {
  icao: IcaoClass
  count: number
  /** Aircraft turns per stand per day. */
  turnsPerDay: number
  /** Passengers counted on each turn. */
  paxPerTurn: number
}

export interface CapacityPlant {
  /** Passengers the terminal can hold at once. */
  terminalHold: number
  /** How many times that hold turns over in a day. */
  terminalTurnsPerDay: number
  securityLanes: number
  /** Passengers one lane clears per hour. */
  securityPaxPerHour: number
  checkInPositions: number
  /** Passengers one desk clears per hour. */
  checkInPaxPerHour: number
  /** Hours the hourly rates run. */
  opsHours: number
  stands: readonly StandGroup[]
  /** Baggage system throughput, bags per hour. */
  bhsBagsPerHour: number
  /** Bags per passenger. Default 0.8. */
  bagsPerPax: number
}

export interface DailyCapacity {
  dailyPax: number
  binding: CapacityLink
  links: Record<CapacityLink, number>
}

export function linkCapacities(plant: CapacityPlant): Record<CapacityLink, number> {
  const ops = nonNegative(plant.opsHours)
  const bagsPerPax = nonNegative(plant.bagsPerPax)
  const terminal = nonNegative(plant.terminalHold) * nonNegative(plant.terminalTurnsPerDay)
  const security = nonNegative(plant.securityLanes) * nonNegative(plant.securityPaxPerHour) * ops
  const checkin = nonNegative(plant.checkInPositions) * nonNegative(plant.checkInPaxPerHour) * ops
  let gates = 0
  for (const stand of plant.stands) {
    gates += nonNegative(stand.count) * nonNegative(stand.turnsPerDay) * nonNegative(stand.paxPerTurn)
  }
  const bhs = bagsPerPax > 0 ? (nonNegative(plant.bhsBagsPerHour) / bagsPerPax) * ops : 0
  return { terminal, security, checkin, gates, bhs }
}

/** Daily pax capacity and the link that binds it. */
export function dailyCapacity(plant: CapacityPlant): DailyCapacity {
  const links = linkCapacities(plant)
  let binding: CapacityLink = CAPACITY_LINKS[0]
  let dailyPax = links[binding]
  for (const link of CAPACITY_LINKS) {
    if (links[link] < dailyPax) {
      dailyPax = links[link]
      binding = link
    }
  }
  return { dailyPax, binding, links }
}

/**
 * Tightest hourly pax rate across the same five links.
 * Gate turns are spread across the operating day.
 */
export function peakHourCapacity(plant: CapacityPlant): number {
  const ops = nonNegative(plant.opsHours)
  const bagsPerPax = nonNegative(plant.bagsPerPax)
  const terminal = nonNegative(plant.terminalHold)
  const security = nonNegative(plant.securityLanes) * nonNegative(plant.securityPaxPerHour)
  const checkin = nonNegative(plant.checkInPositions) * nonNegative(plant.checkInPaxPerHour)
  const bhs = bagsPerPax > 0 ? nonNegative(plant.bhsBagsPerHour) / bagsPerPax : 0
  let gates = 0
  for (const stand of plant.stands) {
    const turnsPerHour = ops > 0 ? nonNegative(stand.turnsPerDay) / ops : 0
    gates += nonNegative(stand.count) * turnsPerHour * nonNegative(stand.paxPerTurn)
  }
  return Math.min(terminal, security, checkin, gates, bhs)
}

/** Remaining daily seats after signed contracts. May be negative when the field is already over. */
export function remainingDailyPax(dailyPax: number, committedPax: number): number {
  return finite(dailyPax) - nonNegative(committedPax)
}

export type BadgeTone = 'green' | 'yellow' | 'red'

export interface CapacityBadge {
  /** "1,500 / 7,000" — estimated pax/day over remaining capacity. */
  text: string
  estPaxPerDay: number
  remaining: number
  /** est / remaining. Infinite when the offer exceeds a non-positive remainder. */
  ratio: number
  tone: BadgeTone
  peakHourOver: boolean
  /** Capacity is a warning. It never blocks signing. */
  blocksSigning: false
}

export function formatPax(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0
  return v.toLocaleString('en-US')
}

/**
 * Offer badge. Green under 70% of remaining, yellow from 70% through 100%,
 * red above 100% or when the offer's peak hour exceeds the hourly cap.
 */
export function capacityBadge(input: {
  estPaxPerDay: number
  remaining: number
  peakHourPax?: number
  peakHourCap?: number
}): CapacityBadge {
  const est = nonNegative(input.estPaxPerDay)
  const remaining = finite(input.remaining)
  const peakHourOver =
    input.peakHourPax !== undefined &&
    input.peakHourCap !== undefined &&
    Number.isFinite(input.peakHourPax) &&
    Number.isFinite(input.peakHourCap) &&
    input.peakHourPax > input.peakHourCap

  let ratio: number
  if (remaining > 0) ratio = est / remaining
  else if (est > 0 || remaining < 0) ratio = Number.POSITIVE_INFINITY
  else ratio = 0

  let tone: BadgeTone
  if (peakHourOver || remaining < 0 || ratio > 1) tone = 'red'
  else if (ratio >= 0.7) tone = 'yellow'
  else tone = 'green'

  return {
    text: `${formatPax(est)} / ${formatPax(remaining)}`,
    estPaxPerDay: est,
    remaining,
    ratio,
    tone,
    peakHourOver,
    blocksSigning: false,
  }
}
