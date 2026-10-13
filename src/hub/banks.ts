import {
  ARRIVAL_CLUSTER_MINUTES,
  DEPARTURE_CLUSTER_MINUTES,
  LOOSE_BANK_GAP,
  TIGHT_BANK_GAP,
  TIGHT_CROWD_PEAK,
  TIGHT_TRANSFER_DEMAND,
} from './config.ts'
import type { BankWave, Movement } from './types.ts'

function cluster(moves: Movement[], gap: number): Movement[][] {
  const sorted = [...moves].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const groups: Movement[][] = []
  for (const move of sorted) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    if (!last || !prev || move.at - prev.at > gap) groups.push([move])
    else last.push(move)
  }
  return groups
}

function tightness(gap: number): number {
  if (!Number.isFinite(gap)) return 0
  if (gap >= LOOSE_BANK_GAP) return 0
  if (gap <= TIGHT_BANK_GAP) return 1
  const span = LOOSE_BANK_GAP - TIGHT_BANK_GAP
  return span <= 0 ? 0 : (LOOSE_BANK_GAP - gap) / span
}

/**
 * Pair each arrival wave with the next departure wave.
 * A shorter gap raises transfer demand and the sterile-area crowd peak.
 */
export function buildBanks(movements: readonly Movement[]): BankWave[] {
  const arrivals = cluster(
    movements.filter((m) => m.direction === 'arr' && Number.isFinite(m.at)),
    ARRIVAL_CLUSTER_MINUTES,
  )
  const departures = cluster(
    movements.filter((m) => m.direction === 'dep' && Number.isFinite(m.at)),
    DEPARTURE_CLUSTER_MINUTES,
  )
  const banks: BankWave[] = []
  for (const wave of arrivals) {
    const arrivalOpen = wave[0].at
    const arrivalClose = wave[wave.length - 1].at
    const onward = departures.find((dep) => dep[0].at >= arrivalClose)
    if (!onward) continue
    const departureOpen = onward[0].at
    const departureClose = onward[onward.length - 1].at
    const gap = departureOpen - arrivalClose
    const tight = tightness(gap)
    const id = `bank-${wave.map((m) => m.id).join('+')}`
    banks.push({
      id,
      arrivals: wave.map((m) => m.id),
      departures: onward.map((m) => m.id),
      arrivalOpen,
      arrivalClose,
      departureOpen,
      departureClose,
      gap,
      tightness: tight,
      transferDemand: 1 + (TIGHT_TRANSFER_DEMAND - 1) * tight,
      crowdPeak: 1 + (TIGHT_CROWD_PEAK - 1) * tight,
    })
  }
  return banks
}

/** Highest demand among banks. No banks → 1 (no extra connecting traffic). */
export function bankDemand(banks: readonly BankWave[]): number {
  if (!banks.length) return 1
  return banks.reduce((max, bank) => Math.max(max, bank.transferDemand), 1)
}

/** Highest crowd peak. No banks → 1. */
export function bankCrowd(banks: readonly BankWave[]): number {
  if (!banks.length) return 1
  return banks.reduce((max, bank) => Math.max(max, bank.crowdPeak), 1)
}
