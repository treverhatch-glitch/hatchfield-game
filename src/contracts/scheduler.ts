import { airframeInfo, classRank, DEFAULT_AIRFRAMES, standFits } from './airframes.ts'
import { MIN_PER_DAY, weekdayOf } from './seasons.ts'
import type {
  Contract, HourCapacity, Infrastructure, ScheduleState, SchedulerOptions, Season, SizeClass, SlotInstance, StandDef,
} from './types.ts'

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  stepMin: 5,
  standBufferMin: 10,
  airframes: DEFAULT_AIRFRAMES,
}

export function withDefaults(o?: Partial<SchedulerOptions>): SchedulerOptions {
  return { ...DEFAULT_SCHEDULER_OPTIONS, ...o }
}

export function slotKey(contractId: string, lineId: string): string {
  return `${contractId}/${lineId}`
}

/** Contracts that fly in `season` (active, or expiring = last season of term). */
export function contractsFlying(contracts: Contract[], season: Season): Contract[] {
  return contracts.filter((c) => (c.status === 'active' || c.status === 'expiring') && c.seasons.includes(season.id))
}

/** Expand every contract line into concrete slot instances for the season, at preferred time, unplaced. */
export function expandContracts(contracts: Contract[], season: Season, opts?: Partial<SchedulerOptions>): SlotInstance[] {
  const o = withDefaults(opts)
  const out: SlotInstance[] = []
  for (const c of contractsFlying(contracts, season)) {
    for (const line of c.lines) {
      airframeInfo(o.airframes, line.airframeId) // validate early
      for (let day = season.startDay; day <= season.endDay; day++) {
        if (!line.days.includes(weekdayOf(day))) continue
        const on = day * MIN_PER_DAY + line.arrival.preferredMin
        out.push({
          id: `${c.id}:${line.id}:${day}`,
          contractId: c.id,
          lineId: line.id,
          airlineId: c.airlineId,
          airframeId: line.airframeId,
          day,
          plannedOnBlock: on,
          plannedOffBlock: on + line.turnaroundTargetMin,
          standId: null,
          runwayId: null,
          depRunwayId: null,
          pinned: false,
          standPinned: false,
          cancelled: false,
          flag: 'ok',
          issues: [],
        })
      }
    }
  }
  return out
}

/** Declared capacity per hour of day from what the player built. standsByClass = stands of exactly that class. */
export function declaredCapacity(infra: Infrastructure): HourCapacity[] {
  const runwayMoves = infra.runways.reduce((a, r) => a + r.movesPerHour, 0)
  const standsByClass = { regional: 0, narrow: 0, wide: 0, super: 0 } as Record<SizeClass, number>
  for (const s of infra.stands) standsByClass[s.sizeClass]++
  return Array.from({ length: 24 }, (_, hour) => ({ hour, runwayMoves, standsByClass: { ...standsByClass } }))
}

// ---------------------------------------------------------------- occupancy book

interface Interval { start: number; end: number; slotId: string }

/** Mutable capacity book used while placing. */
export class Occupancy {
  standBusy = new Map<string, Interval[]>()
  runwayHour = new Map<string, number>()
  readonly infra: Infrastructure
  readonly buffer: number
  constructor(infra: Infrastructure, buffer: number) {
    this.infra = infra
    this.buffer = buffer
  }
  private rk(runwayId: string, minute: number) {
    return `${runwayId}@${Math.floor(minute / 60)}`
  }
  runwayLoad(runwayId: string, minute: number): number {
    return this.runwayHour.get(this.rk(runwayId, minute)) ?? 0
  }
  /** Least-loaded runway with spare capacity at `minute`, or null. */
  freeRunway(minute: number): string | null {
    let best: string | null = null
    let bestSpare = 0
    for (const r of this.infra.runways) {
      const spare = r.movesPerHour - this.runwayLoad(r.id, minute)
      if (spare > bestSpare) { best = r.id; bestSpare = spare }
    }
    return best
  }
  /** Least-overloaded runway (for red placements). */
  leastLoadedRunway(minute: number): string | null {
    let best: string | null = null
    let bestRatio = Infinity
    for (const r of this.infra.runways) {
      const ratio = (this.runwayLoad(r.id, minute) + 1) / Math.max(1, r.movesPerHour)
      if (ratio < bestRatio) { best = r.id; bestRatio = ratio }
    }
    return best
  }
  addMove(runwayId: string | null, minute: number) {
    if (!runwayId) return
    const k = this.rk(runwayId, minute)
    this.runwayHour.set(k, (this.runwayHour.get(k) ?? 0) + 1)
  }
  overlapMin(standId: string, start: number, end: number, ignoreSlot?: string): number {
    let total = 0
    for (const iv of this.standBusy.get(standId) ?? []) {
      if (iv.slotId === ignoreSlot) continue
      const a = Math.max(start, iv.start - this.buffer)
      const b = Math.min(end, iv.end + this.buffer)
      if (b > a) total += b - a
    }
    return total
  }
  addStand(standId: string | null, start: number, end: number, slotId: string) {
    if (!standId) return
    const list = this.standBusy.get(standId) ?? []
    list.push({ start, end, slotId })
    this.standBusy.set(standId, list)
  }
}

/** Fitting stands in preference order: hub home pier, smallest class, contact over remote, id. */
export function rankStands(stands: StandDef[], cls: SizeClass, homePier?: string): StandDef[] {
  return stands
    .filter((s) => standFits(s.sizeClass, cls))
    .sort((a, b) => {
      if (homePier) {
        const pa = a.pier === homePier ? 0 : 1
        const pb = b.pier === homePier ? 0 : 1
        if (pa !== pb) return pa - pb
      }
      const c = classRank(a.sizeClass) - classRank(b.sizeClass)
      if (c !== 0) return c
      if (a.contact !== b.contact) return a.contact ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

export interface AutoScheduleInput {
  slots: SlotInstance[]
  contracts: Contract[]
  infra: Infrastructure
  autoByAirline?: Record<string, boolean>
  /** slotKey(contractId,lineId) of series holding historic precedence (80% rule). Scheduled before others. */
  precedence?: Set<string>
  options?: Partial<SchedulerOptions>
}

function placementOrder(slots: SlotInstance[], byId: Map<string, Contract>, precedence?: Set<string>) {
  return [...slots].sort((a, b) => {
    const ha = byId.get(a.contractId)?.isHub ? 0 : 1
    const hb = byId.get(b.contractId)?.isHub ? 0 : 1
    if (ha !== hb) return ha - hb
    if (precedence) {
      const pa = precedence.has(slotKey(a.contractId, a.lineId)) ? 0 : 1
      const pb = precedence.has(slotKey(b.contractId, b.lineId)) ? 0 : 1
      if (pa !== pb) return pa - pb
    }
    if (a.plannedOnBlock !== b.plannedOnBlock) return a.plannedOnBlock - b.plannedOnBlock
    return a.id < b.id ? -1 : 1
  })
}

/**
 * Place every slot. Fixed slots (pinned, cancelled, or airline auto-off) keep their times and reserve capacity first.
 * Others start at the preferred time and slide in `stepMin` steps within ±soft toward the nearest free capacity.
 * If nothing fits, the slot goes to the least-bad window edge and is flagged 'over_capacity'. It is never dropped.
 */
export function autoSchedule(input: AutoScheduleInput): SlotInstance[] {
  const o = withDefaults(input.options)
  const byId = new Map(input.contracts.map((c) => [c.id, c]))
  const occ = new Occupancy(input.infra, o.standBufferMin)
  const result = new Map<string, SlotInstance>()
  const isFixed = (s: SlotInstance) => s.cancelled || s.pinned || input.autoByAirline?.[s.airlineId] === false

  // 1. reserve fixed slots
  for (const s of input.slots) {
    if (!isFixed(s)) continue
    const copy: SlotInstance = { ...s, issues: [] }
    if (!s.cancelled) {
      const cls = airframeInfo(o.airframes, s.airframeId).sizeClass
      if (!copy.standId || !input.infra.stands.some((st) => st.id === copy.standId)) {
        copy.standId = pickStand(occ, input.infra.stands, cls, copy, byId.get(s.contractId)?.homePier)
      }
      if (!copy.runwayId || !input.infra.runways.some((r) => r.id === copy.runwayId)) {
        copy.runwayId = occ.freeRunway(copy.plannedOnBlock) ?? occ.leastLoadedRunway(copy.plannedOnBlock)
      }
      if (!copy.depRunwayId || !input.infra.runways.some((r) => r.id === copy.depRunwayId)) {
        copy.depRunwayId = occ.freeRunway(copy.plannedOffBlock) ?? occ.leastLoadedRunway(copy.plannedOffBlock)
      }
      occ.addStand(copy.standId, copy.plannedOnBlock, copy.plannedOffBlock, copy.id)
      occ.addMove(copy.runwayId, copy.plannedOnBlock)
      occ.addMove(copy.depRunwayId, copy.plannedOffBlock)
    }
    result.set(s.id, copy)
  }

  // 2. place flexible slots
  const flexible = placementOrder(input.slots.filter((s) => !isFixed(s)), byId, input.precedence)
  for (const s of flexible) {
    const c = byId.get(s.contractId)
    const line = c?.lines.find((l) => l.id === s.lineId)
    if (!c || !line) throw new Error(`slot ${s.id} references unknown contract line`)
    const cls = airframeInfo(o.airframes, s.airframeId).sizeClass
    const pref = s.day * MIN_PER_DAY + line.arrival.preferredMin
    const tt = line.turnaroundTargetMin
    const soft = line.arrival.softMin
    const fitting = rankStands(input.infra.stands, cls, c.isHub ? c.homePier : undefined)
    const s0: SlotInstance = { ...s, issues: [] }
    let placed = false
    for (const off of offsets(soft, o.stepMin)) {
      const on = pref + off
      const offB = on + tt
      const arr = occ.freeRunway(on)
      if (!arr) continue
      occ.addMove(arr, on)
      const dep = occ.freeRunway(offB)
      occ.runwayHour.set(`${arr}@${Math.floor(on / 60)}`, occ.runwayLoad(arr, on) - 1)
      if (!dep) continue
      const candidates = s.standPinned && s.standId ? fitting.filter((x) => x.id === s.standId) : fitting
      const stand = candidates.find((st) => occ.overlapMin(st.id, on, offB) === 0)
      if (!stand) continue
      Object.assign(s0, { plannedOnBlock: on, plannedOffBlock: offB, standId: stand.id, runwayId: arr, depRunwayId: dep })
      placed = true
      break
    }
    if (!placed) {
      // nothing fits: least-bad edge (tie → later edge). Still flies.
      const edges = soft > 0 ? [pref + soft, pref - soft] : [pref]
      let best = edges[0]
      let bestScore = Infinity
      for (const on of edges) {
        const score = badness(occ, input.infra, fitting, on, on + tt)
        if (score < bestScore) { best = on; bestScore = score }
      }
      const offB = best + tt
      const standId = s.standPinned && s.standId
        ? s.standId
        : leastOverlapStand(occ, fitting, best, offB)
      Object.assign(s0, {
        plannedOnBlock: best,
        plannedOffBlock: offB,
        standId,
        runwayId: occ.freeRunway(best) ?? occ.leastLoadedRunway(best),
        depRunwayId: occ.freeRunway(offB) ?? occ.leastLoadedRunway(offB),
      })
    }
    occ.addStand(s0.standId, s0.plannedOnBlock, s0.plannedOffBlock, s0.id)
    occ.addMove(s0.runwayId, s0.plannedOnBlock)
    occ.addMove(s0.depRunwayId, s0.plannedOffBlock)
    result.set(s.id, s0)
  }
  const ordered = input.slots.map((s) => result.get(s.id)!)
  return evaluateFlags(ordered, input.contracts, input.infra, o)
}

function pickStand(occ: Occupancy, stands: StandDef[], cls: SizeClass, s: SlotInstance, homePier?: string): string | null {
  const ranked = rankStands(stands, cls, homePier)
  const free = ranked.find((st) => occ.overlapMin(st.id, s.plannedOnBlock, s.plannedOffBlock) === 0)
  return free?.id ?? leastOverlapStand(occ, ranked, s.plannedOnBlock, s.plannedOffBlock)
}

function leastOverlapStand(occ: Occupancy, fitting: StandDef[], on: number, off: number): string | null {
  let best: string | null = null
  let bestOv = Infinity
  for (const st of fitting) {
    const ov = occ.overlapMin(st.id, on, off)
    if (ov < bestOv) { best = st.id; bestOv = ov }
  }
  return best
}

function badness(occ: Occupancy, infra: Infrastructure, fitting: StandDef[], on: number, off: number): number {
  let score = 0
  const cap = infra.runways.reduce((a, r) => a + r.movesPerHour, 0)
  const load = (m: number) => infra.runways.reduce((a, r) => a + occ.runwayLoad(r.id, m), 0)
  score += Math.max(0, load(on) + 1 - cap) * 60
  score += Math.max(0, load(off) + 1 - cap) * 60
  const ov = fitting.length ? Math.min(...fitting.map((st) => occ.overlapMin(st.id, on, off))) : 1e6
  return score + ov
}

/** 0, +step, -step, +2step, … within ±limit. */
export function offsets(limit: number, step: number): number[] {
  const out = [0]
  for (let d = step; d <= limit; d += step) out.push(d, -d)
  return out
}

/**
 * Single source of truth for flags. Recomputes every slot's flag + issues from scratch:
 * over_capacity (runway hour over declared — every move in that hour; stand clash incl. buffer — the later arrival, wrong stand class, no stand/runway)
 * beats off_window (outside soft window). Cancelled slots are 'ok' and take no capacity.
 */
export function evaluateFlags(
  slots: SlotInstance[], contracts: Contract[], infra: Infrastructure, opts?: Partial<SchedulerOptions>,
): SlotInstance[] {
  const o = withDefaults(opts)
  const lines = new Map<string, Contract['lines'][number]>()
  for (const c of contracts) for (const l of c.lines) lines.set(slotKey(c.id, l.id), l)
  const live = slots.filter((s) => !s.cancelled)
  const rwLoad = new Map<string, number>()
  const rk = (r: string, m: number) => `${r}@${Math.floor(m / 60)}`
  for (const s of live) {
    if (s.runwayId) rwLoad.set(rk(s.runwayId, s.plannedOnBlock), (rwLoad.get(rk(s.runwayId, s.plannedOnBlock)) ?? 0) + 1)
    if (s.depRunwayId) rwLoad.set(rk(s.depRunwayId, s.plannedOffBlock), (rwLoad.get(rk(s.depRunwayId, s.plannedOffBlock)) ?? 0) + 1)
  }
  const byStand = new Map<string, SlotInstance[]>()
  for (const s of live) if (s.standId) byStand.set(s.standId, [...(byStand.get(s.standId) ?? []), s])
  const standDef = new Map(infra.stands.map((s) => [s.id, s]))
  const rwDef = new Map(infra.runways.map((r) => [r.id, r]))

  return slots.map((s) => {
    if (s.cancelled) return { ...s, flag: 'ok', issues: [] }
    const issues: string[] = []
    let over = false
    const cls = airframeInfo(o.airframes, s.airframeId).sizeClass
    for (const [rid, m, what] of [[s.runwayId, s.plannedOnBlock, 'arrival'], [s.depRunwayId, s.plannedOffBlock, 'departure']] as const) {
      if (!rid) { over = true; issues.push(`no runway for ${what}`); continue }
      const r = rwDef.get(rid)
      if (!r) { over = true; issues.push(`runway ${rid} not built`); continue }
      const load = rwLoad.get(rk(rid, m)) ?? 0
      if (load > r.movesPerHour) {
        over = true
        issues.push(`runway ${rid} ${hhmm(Math.floor((m % MIN_PER_DAY) / 60) * 60)} over capacity (${load}/${r.movesPerHour})`)
      }
    }
    if (!s.standId) { over = true; issues.push(`no ${cls} stand built`) } else {
      const st = standDef.get(s.standId)
      if (!st) { over = true; issues.push(`stand ${s.standId} not built`) } else {
        if (!standFits(st.sizeClass, cls)) { over = true; issues.push(`stand ${st.id} (${st.sizeClass}) too small for ${cls}`) }
        // the later arrival is the one in conflict (ties: both)
        const clash = (byStand.get(st.id) ?? []).find((x) => x.id !== s.id && x.plannedOnBlock <= s.plannedOnBlock
          && x.plannedOnBlock < s.plannedOffBlock + o.standBufferMin && s.plannedOnBlock < x.plannedOffBlock + o.standBufferMin)
        if (clash) { over = true; issues.push(`stand ${st.id} clash with ${clash.id}`) }
      }
    }
    const line = lines.get(slotKey(s.contractId, s.lineId))
    let offWindow = false
    if (line) {
      const pref = s.day * MIN_PER_DAY + line.arrival.preferredMin
      const d = Math.abs(s.plannedOnBlock - pref)
      if (d > line.arrival.hardMin) { offWindow = true; issues.push(`outside hard band (${d} min from preferred)`) } else if (d > line.arrival.softMin) {
        offWindow = true; issues.push(`outside window (${d} min from preferred)`)
      }
    }
    return { ...s, flag: over ? 'over_capacity' : offWindow ? 'off_window' : 'ok', issues }
  })
}

export function hhmm(minOfDay: number): string {
  const m = ((minOfDay % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Fresh Slot Round for a season: expand, auto-place, return full state. */
export function slotRound(
  contracts: Contract[], season: Season, infra: Infrastructure,
  extra?: { precedence?: Set<string>; autoByAirline?: Record<string, boolean>; slotRule80?: boolean; options?: Partial<SchedulerOptions> },
): ScheduleState {
  const slots = autoSchedule({
    slots: expandContracts(contracts, season, extra?.options),
    contracts,
    infra,
    precedence: extra?.precedence,
    options: extra?.options,
  })
  return {
    season,
    autoByAirline: { ...extra?.autoByAirline },
    slots,
    declaredCapacity: declaredCapacity(infra),
    slotRule80: extra?.slotRule80 ?? false,
  }
}

/** Re-run after the player builds/removes stands or runways or changes a flight. Pins, cancels and manual airlines are kept. */
export function rerun(state: ScheduleState, contracts: Contract[], infra: Infrastructure, options?: Partial<SchedulerOptions>): ScheduleState {
  return {
    ...state,
    slots: autoSchedule({ slots: state.slots, contracts, infra, autoByAirline: state.autoByAirline, options }),
    declaredCapacity: declaredCapacity(infra),
  }
}

