import {
  APPROVAL_RECOVERY_PER_DAY,
  DECISION_SEC,
  NOISE_DECAY_PER_DAY,
  REP_FAIL,
  CITY_APPROVAL_START,
  REPUTATION_START,
} from './data.ts'
import { HOTEL_NIGHT_FEE, SIM_DAY_SEC } from './fees.ts'
import { auditMilitaryWeek, advanceMilitarySeasons, offerMilitaryContract } from './military.ts'
import { gameDay, queueDay } from './offers.ts'
import { emptyHold, hostGaps, release, reserve, resolvePad } from './services.ts'
import type {
  InboundEvent,
  InboundRequest,
  InboundState,
  InboundWorld,
  LedgerEntry,
  OfferPolicy,
  RespondChoice,
  Visit,
} from './types.ts'

export function createInboundState(seed = 1): InboundState {
  return {
    version: 1,
    rngState: seed >>> 0,
    nextId: 1,
    clock: 0,
    rolledDay: -1,
    requests: [],
    visits: [],
    deals: [],
    held: emptyHold(),
    burnedFuel: 0,
    corridorHeld: false,
    licence: { guardAgreement: false, clearance: false },
    cityApproval: CITY_APPROVAL_START,
    noise: 0,
    reputation: REPUTATION_START,
    guardStanding: 0,
    favour: 0,
    xp: 0,
    ledger: [],
    stats: { accepted: 0, refused: 0, failed: 0, expired: 0, sortiesFlown: 0, sortiesMissed: 0 },
  }
}

function ledger(state: InboundState, amount: number, reason: string, extra: Partial<LedgerEntry> = {}): void {
  if (!amount) return
  state.ledger.push({ day: gameDay(state.clock), amount, reason, ...extra })
}

function snapshot(request: InboundRequest): InboundRequest {
  return { ...request, needs: { ...request.needs } }
}

function clampRep(n: number): number {
  return Math.max(0, Math.min(100, n))
}

/** Accept when the field can host. Refuse when it cannot. Never accepts into a gap. */
export function botChoice(request: InboundRequest, state: InboundState, world: InboundWorld): RespondChoice {
  return hostGaps(state, world.capabilities, request.needs).length ? 'refuse' : 'accept'
}

export function activeVisits(state: InboundState): Visit[] {
  return state.visits.filter((visit) => visit.status === 'parked')
}

function chargeParking(state: InboundState, visit: Visit, day: number): InboundEvent {
  visit.lastChargedDay = day
  visit.paidDays += 1
  ledger(state, visit.dailyFee, 'Aircraft parking day-rate', { visitId: visit.id, requestId: visit.requestId, day })
  return { type: 'parking_fee', visitId: visit.id, amount: visit.dailyFee, day }
}

function depart(state: InboundState, visit: Visit): InboundEvent {
  release(state, visit.needs, visit.pad)
  visit.status = 'departed'
  return { type: 'departed', visitId: visit.id, kind: visit.kind }
}

function closeRequest(
  state: InboundState,
  request: InboundRequest,
  how: 'refused' | 'expired',
): InboundEvent {
  request.status = how
  const fine = how === 'expired' ? 0 : request.fineOnRefuse
  const reputation = request.reputationOnRefuse
  state.reputation = clampRep(state.reputation + reputation)
  if (how === 'expired') state.stats.expired += 1
  else state.stats.refused += 1
  ledger(state, -fine, how === 'expired' ? 'Unanswered inbound request' : 'Refused inbound request', {
    requestId: request.id,
  })
  return { type: how, requestId: request.id, fine, reputation }
}

export function respond(
  state: InboundState,
  world: InboundWorld,
  requestId: string,
  choice: RespondChoice,
): InboundEvent[] {
  const request = state.requests.find((item) => item.id === requestId)
  if (!request || request.status !== 'pending') return []
  if (choice === 'refuse') return [closeRequest(state, request, 'refused')]

  const gaps = hostGaps(state, world.capabilities, request.needs)
  if (gaps.length) {
    if (request.priority) {
      request.status = 'failed'
      state.stats.failed += 1
      state.reputation = clampRep(state.reputation + REP_FAIL)
      ledger(state, -request.fineOnFail, 'Failed inbound host', { requestId: request.id })
      return [{ type: 'failed_host', requestId: request.id, fine: request.fineOnFail, gaps }]
    }
    request.status = 'declined'
    return [{ type: 'declined', requestId: request.id, gaps }]
  }

  const pad = resolvePad(state, world.capabilities, request.needs)
  if (pad == null) return []
  const day = gameDay(state.clock)
  reserve(state, request.needs, pad)
  request.status = 'accepted'
  state.stats.accepted += 1
  state.reputation = clampRep(state.reputation + request.reputationOnAccept)
  state.xp += request.xpOnAccept
  const hotelIncome = request.needs.hotelRooms * request.stayDays * HOTEL_NIGHT_FEE
  ledger(state, request.reward, `${request.title} landing`, { requestId: request.id })
  ledger(state, hotelIncome, 'Hotel / pax care', { requestId: request.id })
  const visit: Visit = {
    id: `vis-${state.nextId}`,
    requestId: request.id,
    kind: request.kind,
    needs: { ...request.needs },
    pad,
    arrivalDay: day,
    departDay: day + request.stayDays,
    stayDays: request.stayDays,
    dailyFee: request.dailyFee,
    lastChargedDay: -1,
    paidDays: 0,
    status: 'parked',
  }
  state.nextId += 1
  state.visits.push(visit)
  const events: InboundEvent[] = [
    {
      type: 'accepted',
      requestId: request.id,
      visitId: visit.id,
      reward: request.reward,
      hotelIncome,
      consumed: { ...visit.needs },
      pad,
      xp: request.xpOnAccept,
    },
  ]
  if (visit.dailyFee > 0) events.push(chargeParking(state, visit, day))
  return events
}

function openNext(
  state: InboundState,
  world: InboundWorld,
  cursor: number,
  to: number,
  policy: OfferPolicy | undefined,
  events: InboundEvent[],
): { acted: boolean; cursor: number } {
  const next = state.requests
    .filter((request) => request.status === 'queued' && request.opensAt <= to)
    .sort((a, b) => a.opensAt - b.opensAt || a.id.localeCompare(b.id))[0]
  if (!next) return { acted: false, cursor }
  const openAt = Math.max(next.opensAt, cursor)
  if (openAt > to) return { acted: false, cursor }
  next.status = 'pending'
  next.opensAt = openAt
  next.deadline = openAt + DECISION_SEC
  events.push({ type: 'offered', request: snapshot(next) })
  if (policy) {
    const choice = policy(next, state, world)
    if (choice === 'accept' || choice === 'refuse') {
      events.push(...respond(state, world, next.id, choice))
    }
  }
  return { acted: true, cursor: openAt }
}

/**
 * One decision card at a time. A policy that answers immediately still clears
 * the day's queue inside the slice. With no answer, each card gets a full
 * decision window and the rest stay queued.
 */
function playSlice(
  state: InboundState,
  world: InboundWorld,
  from: number,
  to: number,
  policy: OfferPolicy | undefined,
): InboundEvent[] {
  const events: InboundEvent[] = []
  let cursor = from
  const guard = state.requests.length * 4 + 4
  for (let step = 0; step < guard; step++) {
    const pending = state.requests.find((request) => request.status === 'pending')
    if (pending) {
      if (pending.deadline > to) break
      if (pending.deadline > cursor) cursor = pending.deadline
      events.push(closeRequest(state, pending, 'expired'))
      continue
    }
    const opened = openNext(state, world, cursor, to, policy, events)
    cursor = opened.cursor
    if (!opened.acted) break
  }
  return events
}

function enterDay(state: InboundState, world: InboundWorld, day: number): InboundEvent[] {
  const events: InboundEvent[] = []
  for (const visit of state.visits) {
    if (visit.status !== 'parked') continue
    if (
      visit.dailyFee > 0 &&
      day > visit.arrivalDay &&
      day < visit.departDay &&
      visit.lastChargedDay < day
    ) {
      events.push(chargeParking(state, visit, day))
    }
    if (day >= visit.departDay) events.push(depart(state, visit))
  }
  state.cityApproval = Math.max(0, Math.min(100, state.cityApproval + APPROVAL_RECOVERY_PER_DAY))
  state.noise = Math.max(0, state.noise - NOISE_DECAY_PER_DAY)
  advanceMilitarySeasons(state, day)
  if (day > 0 && day % 7 === 0) events.push(...auditMilitaryWeek(state, world))
  return events
}

/**
 * Advance the sim clock. Offers that fall inside the slice open, and a policy
 * may answer them before a same-slice deadline expires them.
 * Crossing a day boundary settles parking, departures and the Guard week.
 */
export function tick(
  state: InboundState,
  world: InboundWorld,
  dtSec: number,
  policy?: OfferPolicy,
): InboundEvent[] {
  if (!(dtSec > 0) || !Number.isFinite(dtSec)) return []
  const events: InboundEvent[] = []
  const end = state.clock + dtSec
  while (state.clock < end - 1e-9) {
    const day = gameDay(state.clock)
    const dayEnd = (day + 1) * SIM_DAY_SEC
    const sliceEnd = Math.min(end, dayEnd)
    if (state.rolledDay < day) {
      queueDay(state, world, day)
      if (
        day % 14 === 0 &&
        state.licence.guardAgreement &&
        !state.deals.some((deal) => deal.contract.status === 'offered')
      ) {
        const offered = offerMilitaryContract(state)
        if (offered.ok) events.push({ type: 'military_offered', contractId: offered.deal.contract.id })
      }
      state.rolledDay = day
    }
    const from = state.clock
    events.push(...playSlice(state, world, from, sliceEnd, policy))
    const crossed = sliceEnd >= dayEnd - 1e-9
    state.clock = sliceEnd
    if (crossed) events.push(...enterDay(state, world, day + 1))
  }
  return events
}

export function requestsOnDay(state: InboundState, day: number, priority: boolean): InboundRequest[] {
  return state.requests.filter((request) => request.day === day && request.priority === priority)
}
