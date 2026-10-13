import { RIVAL } from './config.ts'
import type { CourtOffer, DemandSplit, FeeLevels, PlayerSnapshot } from './types.ts'

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function finite(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function feeBlend(fees: FeeLevels): number {
  return (fees.landing + fees.passenger + fees.cargo) / 3
}

/** Higher is a more attractive airport. Fee index is a multiplier on list price. */
export function airportScore(input: { feeIndex: number; service: number; capacity: number }): number {
  const feeIndex = clamp(finite(input.feeIndex, 1), 0.4, 2)
  const service = clamp(finite(input.service, 0), 0, 100) / 100
  const capacity = Math.min(1, Math.max(0, finite(input.capacity, 0)) / RIVAL.referenceCapacity)
  return RIVAL.weights.fee * (1 / feeIndex) + RIVAL.weights.service * service + RIVAL.weights.capacity * capacity
}

export function demandSplit(
  player: Pick<PlayerSnapshot, 'feeIndex' | 'service' | 'capacity'>,
  rival: { fees: FeeLevels; service: number; capacity: number },
): DemandSplit {
  const playerScore = airportScore(player)
  const rivalScore = airportScore({
    feeIndex: feeBlend(rival.fees),
    service: rival.service,
    capacity: rival.capacity,
  })
  const total = playerScore + rivalScore
  const playerShare = total > 0 ? playerScore / total : 0.5
  let playerFactor = clamp(
    RIVAL.demandParityBase + RIVAL.demandSlope * playerShare,
    RIVAL.demandMin,
    RIVAL.demandMax,
  )
  if (Math.abs(playerFactor - 1) < RIVAL.demandDeadband) playerFactor = 1
  return {
    playerScore,
    rivalScore,
    playerShare,
    rivalShare: 1 - playerShare,
    playerFactor,
  }
}

export function poachChance(input: {
  standing: number
  playerFee: number
  rivalFee: number
  playerService: number
  rivalService: number
}): number {
  if (input.standing > RIVAL.poachStandingMax) return 0
  const misery = (RIVAL.poachStandingMax - input.standing) / 100
  const feeEdge =
    input.rivalFee < input.playerFee - 0.01 ? 0.18 : input.rivalFee > input.playerFee + 0.04 ? -0.12 : 0
  const serviceEdge = (input.rivalService - input.playerService) / 250
  return clamp(misery + feeEdge + serviceEdge, 0, RIVAL.poachChanceCap)
}

export function courtChance(input: CourtOffer & { loyalty: number; rivalFee: number; rivalService: number; rivalCapacity: number }): number {
  const feeEdge =
    input.feeIndex + 0.01 < input.rivalFee ? 0.2 : input.feeIndex > input.rivalFee + 0.05 ? -0.16 : 0
  const serviceEdge = (input.service - input.rivalService) / 220
  const roomEdge = input.capacity >= input.rivalCapacity ? 0.06 : -0.08
  const loyaltyDrag = input.loyalty / 380
  return clamp(0.34 + feeEdge + serviceEdge + roomEdge - loyaltyDrag, RIVAL.courtChanceFloor, RIVAL.courtChanceCap)
}

export function courtCost(tier: number): number {
  return RIVAL.courtBaseCost + Math.max(1, Math.round(finite(tier, 1))) * RIVAL.courtPerTier
}

/** Next stand's price. Grows with the stands Bellwater already operates. */
export function expandCost(capacity: number): number {
  const built = Math.max(0, capacity - RIVAL.startCapacity)
  return Math.round(RIVAL.expandBase * (1 + built * RIVAL.expandGrowth))
}

export function dailyUpkeep(capacity: number): number {
  return Math.max(0, capacity) * RIVAL.upkeepPerStand
}

export function dailyIncome(rosterSize: number, fees: FeeLevels): number {
  return rosterSize * RIVAL.yieldPerCarrier * feeBlend(fees)
}
