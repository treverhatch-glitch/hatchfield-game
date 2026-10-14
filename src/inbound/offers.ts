import type { RequestKind } from './types.ts'
import type { InboundRequest, InboundState, InboundWorld } from './types.ts'
import {
  DECISION_SEC,
  profile,
} from './data.ts'
import {
  AIR_AMBULANCE_FEE,
  DIVERT_FEE_MAX,
  DIVERT_FEE_MIN,
  EMERGENCY_FAIL_FINE,
  EMERGENCY_REFUSE_FINE,
  GA_PARK_DAY_RATE,
  GA_PARK_FEE_MAX,
  GA_PARK_FEE_MIN,
  MIL_LANDING,
  SIM_DAY_SEC,
  TANKER_FEE,
  TANKER_MX_FEE,
} from './fees.ts'
import { nextFloat } from './rng.ts'
import { rollEmergencyFor, rollGeneralFor, rollGeneralKind, rollPriorityKind } from './schedule.ts'

function band(state: InboundState, min: number, max: number): number {
  if (max <= min) return min
  return min + Math.floor(nextFloat(state) * (max - min))
}

export function rewardFor(state: InboundState, kind: RequestKind): { reward: number; dailyFee: number } {
  const fee = profile(kind).fee
  switch (fee) {
    case 'divert_band':
      return { reward: band(state, DIVERT_FEE_MIN, DIVERT_FEE_MAX), dailyFee: 0 }
    case 'divert_max':
      return { reward: DIVERT_FEE_MAX, dailyFee: 0 }
    case 'ambulance':
      return { reward: AIR_AMBULANCE_FEE, dailyFee: 0 }
    case 'tanker':
      return { reward: TANKER_FEE, dailyFee: 0 }
    case 'tanker_mx':
      return { reward: TANKER_MX_FEE, dailyFee: 0 }
    case 'military':
      return { reward: MIL_LANDING, dailyFee: 0 }
    case 'ga_band':
      return { reward: band(state, GA_PARK_FEE_MIN, GA_PARK_FEE_MAX), dailyFee: 0 }
    case 'storage':
      return { reward: 0, dailyFee: GA_PARK_DAY_RATE }
    default:
      return { reward: 0, dailyFee: 0 }
  }
}

export function gameDay(clock: number): number {
  return Math.floor(clock / SIM_DAY_SEC)
}

function nextId(state: InboundState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`
  state.nextId += 1
  return id
}

export function buildRequest(
  state: InboundState,
  kind: RequestKind,
  day: number,
  opensAt: number,
  status: InboundRequest['status'],
): InboundRequest {
  const spec = profile(kind)
  const money = rewardFor(state, kind)
  const stayDays = spec.stayDays.min + Math.floor(nextFloat(state) * (spec.stayDays.max - spec.stayDays.min + 1))
  return {
    id: nextId(state, 'req'),
    kind,
    priority: spec.priority,
    title: spec.title,
    blurb: spec.blurb,
    day,
    opensAt,
    deadline: opensAt + DECISION_SEC,
    etaSec: spec.etaSec,
    needs: { ...spec.needs },
    reward: money.reward,
    dailyFee: money.dailyFee,
    stayDays,
    fineOnRefuse: spec.priority ? EMERGENCY_REFUSE_FINE : 0,
    fineOnTimeout: 0,
    fineOnFail: spec.priority ? EMERGENCY_FAIL_FINE : 0,
    reputationOnAccept: spec.priority ? 2 : 1,
    reputationOnRefuse: spec.priority ? -4 : 0,
    xpOnAccept: spec.priority ? 3 : 1,
    status,
  }
}

/** Card is already open. Used by tests and by a host that injects an ask. */
export function spawnOffer(state: InboundState, kind: RequestKind): InboundRequest {
  const day = gameDay(state.clock)
  const request = buildRequest(state, kind, day, state.clock, 'pending')
  state.requests.push(request)
  return request
}

/**
 * Queue the day's offers. They occupy nothing until the player accepts.
 * Returns the kinds rolled, in card order.
 */
export function queueDay(state: InboundState, world: InboundWorld, day: number): InboundRequest[] {
  const kinds: RequestKind[] = []
  const emergencies = rollEmergencyFor(state, world)
  for (let i = 0; i < emergencies; i++) {
    const kind = rollPriorityKind(state, world)
    if (kind) kinds.push(kind)
  }
  const general = rollGeneralFor(state, world)
  for (let i = 0; i < general; i++) {
    const kind = rollGeneralKind(state, world)
    if (kind) kinds.push(kind)
  }
  const start = day * SIM_DAY_SEC
  const made: InboundRequest[] = []
  kinds.forEach((kind, i) => {
    const opensAt = start + 1 + (i * (SIM_DAY_SEC - 2)) / Math.max(kinds.length, 1)
    const request = buildRequest(state, kind, day, opensAt, 'queued')
    state.requests.push(request)
    made.push(request)
  })
  return made
}
