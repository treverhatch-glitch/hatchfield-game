import type { AirframeInfo, Contract, SizeClass, StandDef } from '../contracts/types.ts'
import {
  type CapacityPlant,
  type IcaoClass,
  type StandGroup,
  DEFAULT_PAX_PER_TURN,
  DEFAULT_TURNS_BY_ICAO,
  BAGS_PER_PAX,
} from './capacity.ts'
import { nonNegative } from './num.ts'

/** Contract stand classes mapped onto ICAO letters. */
export const ICAO_FOR_SIZE: Record<SizeClass, IcaoClass> = {
  regional: 'B',
  narrow: 'C',
  wide: 'E',
  super: 'F',
}

export function standsToGroups(
  stands: readonly StandDef[],
  turns: Record<IcaoClass, number> = DEFAULT_TURNS_BY_ICAO,
  paxPerTurn: Record<IcaoClass, number> = DEFAULT_PAX_PER_TURN,
): StandGroup[] {
  const counts: Record<IcaoClass, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
  for (const stand of stands) {
    counts[ICAO_FOR_SIZE[stand.sizeClass]] += 1
  }
  const groups: StandGroup[] = []
  for (const icao of Object.keys(counts) as IcaoClass[]) {
    if (counts[icao] <= 0) continue
    groups.push({
      icao,
      count: counts[icao],
      turnsPerDay: turns[icao],
      paxPerTurn: paxPerTurn[icao],
    })
  }
  return groups
}

/** Estimated passengers per day from a contract's weekly pattern. Freighters add none. */
export function contractDailyPax(
  contract: Contract,
  airframes: Record<string, AirframeInfo>,
  loadFactor = 0.8,
): number {
  const lf = Math.min(1, nonNegative(loadFactor))
  let week = 0
  for (const line of contract.lines) {
    if (line.kind === 'freighter') continue
    const seats = airframes[line.airframeId]?.seats
    if (!Number.isFinite(seats)) continue
    week += line.days.length * seats * lf
  }
  return week / 7
}

const LIVE = new Set<Contract['status']>(['active', 'expiring'])

/** Pax/day already promised by signed contracts. Offers do not count. */
export function committedContractPax(
  contracts: readonly Contract[],
  airframes: Record<string, AirframeInfo>,
  loadFactor = 0.8,
): number {
  let total = 0
  for (const contract of contracts) {
    if (!LIVE.has(contract.status)) continue
    total += contractDailyPax(contract, airframes, loadFactor)
  }
  return total
}

export interface PlantInput {
  terminalHold: number
  terminalTurnsPerDay: number
  securityLanes: number
  securityPaxPerHour: number
  checkInPositions: number
  checkInPaxPerHour: number
  opsHours: number
  stands: readonly StandDef[]
  bhsBagsPerHour: number
  bagsPerPax?: number
}

/** Build a capacity plant from contract stands plus the terminal counts the player built. */
export function plantFromStands(input: PlantInput): CapacityPlant {
  return {
    terminalHold: input.terminalHold,
    terminalTurnsPerDay: input.terminalTurnsPerDay,
    securityLanes: input.securityLanes,
    securityPaxPerHour: input.securityPaxPerHour,
    checkInPositions: input.checkInPositions,
    checkInPaxPerHour: input.checkInPaxPerHour,
    opsHours: input.opsHours,
    stands: standsToGroups(input.stands),
    bhsBagsPerHour: input.bhsBagsPerHour,
    bagsPerPax: input.bagsPerPax ?? BAGS_PER_PAX,
  }
}
