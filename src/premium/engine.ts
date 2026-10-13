import { calculateStaff } from '../economy/staff.ts'
import type { StaffBuildingInput } from '../economy/types.ts'
import {
  PREMIUM_ITEMS,
  PREMIUM_RULES,
  premiumItem,
  type PremiumItemId,
  type PremiumKind,
} from './data.ts'
import type {
  Cabin,
  PoolContext,
  PremiumGate,
  PremiumState,
  ScreenRow,
  ScreeningPax,
  StaffPools,
} from './types.ts'

export function createPremiumState(): PremiumState {
  return {
    built: [],
    feeEnabled: false,
    securityOfficers: 0,
    day: 0,
    missedPremium: {},
    standingFromPremium: {},
    standingFromVip: {},
    hour: 0,
    servedThisHour: {},
    nextId: 1,
  }
}

export function restorePremium(raw: Partial<PremiumState> | null | undefined): PremiumState {
  const base = createPremiumState()
  if (!raw) return base
  return {
    ...base,
    ...raw,
    built: Array.isArray(raw.built) ? raw.built.filter((row) => row && premiumId(row.itemId)) : [],
    feeEnabled: Boolean(raw.feeEnabled),
    securityOfficers: Math.max(0, Math.floor(raw.securityOfficers ?? 0)),
    day: raw.day ?? 0,
    missedPremium: raw.missedPremium ?? {},
    standingFromPremium: raw.standingFromPremium ?? {},
    standingFromVip: raw.standingFromVip ?? {},
    hour: raw.hour ?? 0,
    servedThisHour: raw.servedThisHour ?? {},
    nextId: raw.nextId ?? 1,
  }
}

function premiumId(id: string | undefined): id is PremiumItemId {
  return PREMIUM_ITEMS.some((item) => item.id === id)
}

export function expectsHigherService(cabin: Cabin): boolean {
  return cabin !== 'economy'
}

/** Stable cabin when a body was not rolled into first or VIP at the door. */
export function cabinFromTag(tag: 'budget' | 'family' | 'business' | 'premium'): Cabin {
  if (tag === 'business') return 'business'
  if (tag === 'premium') return 'premium'
  return 'economy'
}

/**
 * Business, first, and premium expect the higher-service path.
 * Luxury (and, rarely, business) carriers also put a VIP in the mix.
 */
export function rollCabin(
  tag: 'budget' | 'family' | 'business' | 'premium',
  persona?: string,
  roll = Math.random(),
): Cabin {
  if (persona === 'luxury' && roll < 0.03) return 'vip'
  if (persona === 'business' && roll < 0.015) return 'vip'
  if (tag === 'business') return 'business'
  if (tag === 'premium') {
    if (persona === 'luxury' && roll < 0.4) return 'first'
    return 'premium'
  }
  return 'economy'
}

/** Cabin from the id the spawner already rolled, so the hall's random stream stays put. */
export function cabinFromGuest(
  tag: 'budget' | 'family' | 'business' | 'premium',
  persona: string | undefined,
  id: string,
): Cabin {
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return rollCabin(tag, persona, (hash >>> 0) / 4294967296)
}

export interface BuyResult {
  ok: true
  state: PremiumState
  cost: number
  name: string
  upkeep: number
}

export interface BuyReject {
  ok: false
  reason: string
}

export function buyFacility(state: PremiumState, itemId: PremiumItemId, gate: PremiumGate): BuyResult | BuyReject {
  const item = premiumItem(itemId)
  if (gate.fieldLevel < item.unlockFieldLevel) {
    return { ok: false, reason: `${item.name} unlocks at field level ${item.unlockFieldLevel}.` }
  }
  if (item.needsCt && !gate.hasCt) {
    return { ok: false, reason: `${item.name} needs CT scanners.` }
  }
  const next = cloneState(state)
  next.built = [...next.built, { id: `${item.kind}-${next.nextId}`, itemId }]
  next.nextId += 1
  return { ok: true, state: next, cost: item.cost, name: item.name, upkeep: item.upkeepPerDay }
}

export function hireOfficer(state: PremiumState): { ok: true; state: PremiumState; cost: number } | BuyReject {
  if (state.securityOfficers >= PREMIUM_RULES.officerCap) {
    return { ok: false, reason: `Officer roster is full (${PREMIUM_RULES.officerCap}).` }
  }
  const next = cloneState(state)
  next.securityOfficers += 1
  return { ok: true, state: next, cost: PREMIUM_RULES.officerHireCost }
}

export function setFeeEnabled(state: PremiumState, on: boolean): PremiumState {
  if (state.feeEnabled === on) return state
  return { ...cloneState(state), feeEnabled: on }
}

/** Every built desk, lane, and room. Idle and unstaffed buildings still pay. */
export function dailyUpkeep(state: PremiumState): number {
  let total = 0
  for (const built of state.built) total += premiumItem(built.itemId).upkeepPerDay
  return total
}

export function premiumStaffBuildings(state: PremiumState): StaffBuildingInput[] {
  return state.built.map((built) => {
    const item = premiumItem(built.itemId)
    return { id: built.id, role: item.staffRole, required: item.staff, priority: item.priority }
  })
}

export interface OpenFacility {
  id: string
  itemId: PremiumItemId
  kind: PremiumKind
  throughputPerHour: number
  staffingRatio: number
  assigned: number
  required: number
}

export function staffedFacilities(
  state: PremiumState,
  pools: StaffPools,
  hasCt: boolean,
  pool: PoolContext = {},
): OpenFacility[] {
  const allocations = calculateStaff({
    pools: {
      security_officer: { hired: Math.max(0, pools.security_officer), wagePerDay: 0 },
      terminal_staff: { hired: Math.max(0, pools.terminal_staff), wagePerDay: 0 },
    },
    buildings: premiumStaffBuildings(state),
    transitTier: pool.transitTier ?? 'road',
    housingTier: pool.housingTier ?? 0,
    visibleWorkerSample: 0,
    elapsedSimMinutes: 0,
  }).allocations
  const byId = new Map(allocations.map((row) => [row.buildingId, row]))
  const open: OpenFacility[] = []
  for (const built of state.built) {
    const item = premiumItem(built.itemId)
    if (item.needsCt && !hasCt) continue
    const allocation = byId.get(built.id)
    const ratio = allocation?.staffingRatio ?? 0
    if (!(ratio > 0)) continue
    open.push({
      id: built.id,
      itemId: built.itemId,
      kind: item.kind,
      throughputPerHour: item.throughputPerHour,
      staffingRatio: ratio,
      assigned: allocation?.assigned ?? 0,
      required: item.staff,
    })
  }
  return open
}

export function screenPassengers(
  state: PremiumState,
  pax: readonly ScreeningPax[],
  pools: StaffPools,
  gate: PremiumGate,
  pool: PoolContext = {},
): { state: PremiumState; rows: ScreenRow[] } {
  const next = cloneState(state)
  if (gate.day != null && gate.day !== next.day) {
    next.day = gate.day
    next.missedPremium = {}
    next.standingFromPremium = {}
    next.standingFromVip = {}
  }
  if (gate.hourIndex != null && gate.hourIndex !== next.hour) {
    next.hour = gate.hourIndex
    next.servedThisHour = {}
  }
  const hours = gate.hours ?? 1
  const open = staffedFacilities(next, pools, gate.hasCt, pool)
  const lanes = open
    .filter((row) => row.kind === 'lane')
    .sort((a, b) => b.throughputPerHour - a.throughputPerHour || a.id.localeCompare(b.id))
  const room = open.find((row) => row.kind === 'vip') ?? null
  const desk = open.find((row) => row.kind === 'checkin') ?? null
  const ranked = pax
    .map((body, index) => ({ body, index }))
    .sort((a, b) => cabinRank(a.body.cabin) - cabinRank(b.body.cabin) || a.index - b.index)
  const rows: ScreenRow[] = []
  for (const { body } of ranked) {
    rows.push(routeOne(next, body, lanes, room, desk, hours))
  }
  const byId = new Map(rows.map((row) => [row.id, row]))
  return { state: next, rows: pax.map((body) => byId.get(body.id)!) }
}

function routeOne(
  state: PremiumState,
  body: ScreeningPax,
  lanes: OpenFacility[],
  room: OpenFacility | null,
  desk: OpenFacility | null,
  hours: number,
): ScreenRow {
  const checkinId = expectsHigherService(body.cabin) && desk ? desk.id : null
  if (body.cabin === 'economy') {
    return blank(body, 'general', null, null, false, 0, 0, 0)
  }
  if (body.cabin === 'vip') {
    if (room) return blank(body, 'vip_room', room.id, checkinId, false, 0, 0, 0)
    const lane = takeLane(state, lanes, hours)
    if (lane) return blank(body, 'fast_track', lane.id, checkinId, true, 0, 0, feeFor(state))
    return blank(
      body,
      'general',
      null,
      checkinId,
      false,
      PREMIUM_RULES.generalQueueHappiness,
      vipStanding(state, body.airlineId),
      0,
    )
  }
  const lane = takeLane(state, lanes, hours)
  if (lane) return blank(body, 'fast_track', lane.id, checkinId, false, 0, 0, feeFor(state))
  return blank(
    body,
    'general',
    null,
    checkinId,
    false,
    PREMIUM_RULES.generalQueueHappiness,
    premiumStanding(state, body.airlineId),
    0,
  )
}

function takeLane(state: PremiumState, lanes: OpenFacility[], hours: number): OpenFacility | null {
  for (const lane of lanes) {
    const cap = Math.floor(lane.throughputPerHour * lane.staffingRatio * Math.max(0, hours))
    const used = state.servedThisHour[lane.id] ?? 0
    if (used >= cap) continue
    state.servedThisHour[lane.id] = used + 1
    return lane
  }
  return null
}

function premiumStanding(state: PremiumState, airlineId: string): number {
  const missed = (state.missedPremium[airlineId] ?? 0) + 1
  state.missedPremium[airlineId] = missed
  if (missed % PREMIUM_RULES.premiumBatchSize !== 0) return 0
  const applied = state.standingFromPremium[airlineId] ?? 0
  if (applied <= PREMIUM_RULES.standingCapPerDay) return 0
  const delta = Math.max(PREMIUM_RULES.standingCapPerDay - applied, PREMIUM_RULES.standingPerBatch)
  state.standingFromPremium[airlineId] = applied + delta
  return delta
}

function vipStanding(state: PremiumState, airlineId: string): number {
  const applied = state.standingFromVip[airlineId] ?? 0
  if (applied <= PREMIUM_RULES.vipStandingCapPerDay) return 0
  const delta = Math.max(PREMIUM_RULES.vipStandingCapPerDay - applied, PREMIUM_RULES.vipMissStanding)
  state.standingFromVip[airlineId] = applied + delta
  return delta
}

function feeFor(state: PremiumState): number {
  return state.feeEnabled ? PREMIUM_RULES.fastTrackFee : 0
}

function blank(
  body: ScreeningPax,
  path: ScreenRow['path'],
  laneId: string | null,
  checkinId: string | null,
  escorted: boolean,
  happinessDelta: number,
  standingDelta: number,
  fee: number,
): ScreenRow {
  return {
    id: body.id,
    cabin: body.cabin,
    path,
    laneId,
    checkinId,
    escorted,
    happinessDelta,
    standingDelta,
    fee,
  }
}

function cabinRank(cabin: Cabin): number {
  if (cabin === 'vip') return 0
  if (cabin === 'economy') return 2
  return 1
}

function cloneState(state: PremiumState): PremiumState {
  return {
    ...state,
    built: state.built.map((row) => ({ ...row })),
    missedPremium: { ...state.missedPremium },
    standingFromPremium: { ...state.standingFromPremium },
    standingFromVip: { ...state.standingFromVip },
    servedThisHour: { ...state.servedThisHour },
  }
}

export interface PremiumBoardRow {
  id: PremiumItemId
  name: string
  blurb: string
  unlockFieldLevel: number
  cost: number
  upkeepPerDay: number
  staff: number
  staffRole: string
  throughputPerHour: number
  needsCt: boolean
  owned: number
  open: number
  reason: string | null
}

export function premiumBoard(
  state: PremiumState,
  pools: StaffPools,
  gate: PremiumGate,
  pool: PoolContext = {},
): {
  rows: PremiumBoardRow[]
  upkeepPerDay: number
  officers: number
  feeEnabled: boolean
  feeAmount: number
  lanesOpen: number
  vipOpen: boolean
  checkinOpen: boolean
} {
  const open = staffedFacilities(state, pools, gate.hasCt, pool)
  const rows = PREMIUM_ITEMS.map((item) => {
    const owned = state.built.filter((row) => row.itemId === item.id)
    const live = open.filter((row) => row.itemId === item.id)
    const gateResult = buyFacility(state, item.id, gate)
    return {
      id: item.id,
      name: item.name,
      blurb: item.blurb,
      unlockFieldLevel: item.unlockFieldLevel,
      cost: item.cost,
      upkeepPerDay: item.upkeepPerDay,
      staff: item.staff,
      staffRole: item.staffRole === 'security_officer' ? 'officer' : 'agent',
      throughputPerHour: item.throughputPerHour,
      needsCt: item.needsCt,
      owned: owned.length,
      open: live.length,
      reason: gateResult.ok ? null : gateResult.reason,
    }
  })
  return {
    rows,
    upkeepPerDay: dailyUpkeep(state),
    officers: state.securityOfficers,
    feeEnabled: state.feeEnabled,
    feeAmount: PREMIUM_RULES.fastTrackFee,
    lanesOpen: open.filter((row) => row.kind === 'lane').length,
    vipOpen: open.some((row) => row.kind === 'vip'),
    checkinOpen: open.some((row) => row.kind === 'checkin'),
  }
}

export function countBuilt(state: PremiumState, itemId: PremiumItemId): number {
  return state.built.filter((row) => row.itemId === itemId).length
}
