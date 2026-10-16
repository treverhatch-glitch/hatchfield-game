import { AIRFRAMES } from '../../game/airframes'
import { tilesOf } from '../../game/path'
import type { Game } from '../../game/sim'
import type { AircraftKind, Flight, ScheduleSlot, Vec } from '../../game/types'
import { REAL_AIRFRAMES } from '../../render/aircraft/realworld'
import { footprintLetter, standRefusal } from '../../stands/index'
import { checkInGhost, flightIsIntl } from './checkInGhost'
import { contractsAdapter, type ContractMovement } from './contractsAdapter'
import { gameMinToSim, SCHEDULE, turnBand } from './scheduleConfig'
import { contractSlotWindow, turnTargetSec } from './schedulerBridge'
import { clampToWindow, hourSecs } from './time'
import type { IcaoCode, TimetableAdapter, TtFlight, TtRunway, TtStand, TtTraffic, TtWindow } from './types'

/**
 * The thin slice of Game the timetable needs. Keeping it structural means tests
 * can feed a fake. A drag uses `placeSlotTime` when the sim has it.
 */
export type ScheduleGame = Pick<
  Game,
  | 'clock'
  | 'schedule'
  | 'flights'
  | 'tiles'
  | 'airline'
  | 'gateLabel'
  | 'standClassAt'
  | 'runwayStripCount'
  | 'maxInbound'
  | 'pullSlot'
  | 'bumpSlot'
  | 'cancelSlot'
  | 'setSlotStandPref'
  | 'cycleSlotRunway'
  | 'scheduleForRunway'
  | 'hubLeases'
  | 'standSize'
  | 'standRung'
  | 'closedStandKeys'
  | 'reservedStandKeys'
> & {
  /** Exact sheet drop. Absent on fakes, which still pull and bump. */
  placeSlotTime?(slotId: string, eta: number, standingHit?: number): number | null
}

export const DAY_LENGTH = 180

/** Contract hard band around the banked ETA. Past it, the bar snaps back. `now` is not part of the band. */
export function hardWindow(anchor: number, _now: number): TtWindow {
  return contractSlotWindow(anchor, DAY_LENGTH)
}
const TAXI = 6

const STAND_ICAO: Record<string, IcaoCode> = { S: 'C', M: 'E', L: 'F' }
const F_TYPES = new Set(['a380', 'b748', 'b747', 'an124', 'an225'])

export function icaoForAirframe(id: string | null | undefined, kind?: AircraftKind): IcaoCode {
  if (id && F_TYPES.has(id)) return 'F'
  const k = kind ?? (id ? AIRFRAMES[id]?.kind : undefined)
  switch (k) {
    case 'regional':
    case 'narrowbody':
    case 'military':
      return 'C'
    case 'widebody':
    case 'freighter':
      return 'E'
    case 'helo_med':
    case 'helo_exec':
    case 'air_ambulance':
      return 'A'
    default:
      return 'C'
  }
}

function turnFor(icao: IcaoCode, kind?: AircraftKind): number {
  return turnTargetSec(icao, kind)
}

function terminalOf(label: string): string {
  return label.match(/^T\d+/)?.[0] ?? 'Apron'
}

function trafficOf(kind: string | undefined, airlineKind?: string, biz?: string): TtTraffic {
  if (airlineKind === 'cargo' || kind === 'freighter' || biz === 'cargo') return 'cargo'
  if (biz === 'charter' || kind === 'helo_med' || kind === 'helo_exec' || kind === 'air_ambulance') return 'ga'
  return 'pax'
}

/** Game runway strip index ↔ timetable runway id. */
export const rwId = (i: number) => `rw${i}`
export const rwIndex = (id: string) => Number(id.replace(/^rw/, ''))

const key = (v: Vec) => `${v.c},${v.r}`
const unkey = (s: string): Vec => {
  const [c, r] = s.split(',').map(Number)
  return { c, r }
}

/** Painted letter. Size and rung win. A class-only stand keeps the old S/M/L map. */
function paintedLetter(game: ScheduleGame, stand: Vec): IcaoCode {
  const id = key(stand)
  const size = game.standSize[id]
  const rung = game.standRung[id]
  if (size && rung != null) return footprintLetter(size, rung)
  return STAND_ICAO[game.standClassAt(stand)] ?? 'E'
}

function aircraftOf(game: ScheduleGame, slot: ScheduleSlot): { airframeId?: string; icao: IcaoCode } {
  const flight = slot.flightId ? game.flights.find((f) => f.id === slot.flightId) : undefined
  const airframeId = flight?.airframeId ?? slot.airframeId ?? undefined
  const real = airframeId ? REAL_AIRFRAMES[airframeId] : undefined
  if (real && real.icao !== 'H') return { airframeId, icao: real.icao }
  if (real?.icao === 'H') return { airframeId, icao: 'A' }
  const kind = flight?.kind ?? (airframeId ? AIRFRAMES[airframeId]?.kind : undefined)
  return { airframeId, icao: flight || airframeId ? icaoForAirframe(airframeId, kind) : 'C' }
}

/** Fit, lease, closed, and reserved. The sentence is what the timetable shows. */
function refusalFor(game: ScheduleGame, slot: ScheduleSlot, standId: string): string | null {
  const stand = unkey(standId)
  const craft = aircraftOf(game, slot)
  const id = key(stand)
  const size = game.standSize[id]
  const rung = game.standRung[id]
  const real = craft.airframeId ? REAL_AIRFRAMES[craft.airframeId] : undefined
  const lease = (game.hubLeases ?? []).find((row) => row.kind === 'gate' && row.id === `stand:${standId}`)
  return standRefusal({
    airlineId: slot.airline,
    leaseAirlineId: lease?.airlineId ?? null,
    closed: game.closedStandKeys().has(standId),
    reserved: game.reservedStandKeys().has(standId),
    size,
    rung,
    airframeId: real ? craft.airframeId : undefined,
    aircraftIcao: real?.icao ?? craft.icao,
    standLetter: paintedLetter(game, stand),
  })
}

export function towerWindow(slot: ScheduleSlot, now: number, anchor?: number): TtWindow {
  const base = anchor ?? slot.eta - slot.delaySec
  return hardWindow(base, now)
}

export function gameScheduleAdapter(game: ScheduleGame): TimetableAdapter {
  const standVecs = () => tilesOf(game.tiles, 'stand')
  /** Banked ETA the first time we saw each slot, so drags don't walk the window. */
  const anchors = new Map<string, number>()
  /** One standing hit per slot per week when a drop leaves the free band. */
  const outsideSoft = new Set<string>()
  const windowOf = (s: ScheduleSlot) => {
    if (!anchors.has(s.id)) anchors.set(s.id, s.eta - s.delaySec)
    return towerWindow(s, game.clock, anchors.get(s.id))
  }

  const metalOf = (slot: ScheduleSlot) => {
    const flight = slot.flightId ? game.flights.find((f) => f.id === slot.flightId) : undefined
    const frameId = flight?.airframeId ?? slot.airframeId ?? null
    const frame = frameId ? AIRFRAMES[frameId] : undefined
    const kind = flight?.kind ?? frame?.kind
    const icao = frameId ? icaoForAirframe(frameId, kind) : 'C'
    return { flight, kind, icao }
  }

  const slotMovements = (slot: ScheduleSlot): ContractMovement[] => {
    const al = game.airline(slot.airline)
    const { flight, kind, icao } = metalOf(slot)
    const stand = flight?.stand ?? slot.standPref ?? null
    const turn = turnFor(icao, kind)
    const onFrom = slot.eta + TAXI
    const onTo = onFrom + turn
    const standLabel = stand ? game.gateLabel(stand) : 'Tower'
    const airlineKind = 'kind' in al ? al.kind : undefined
    const biz = 'bizModel' in al ? al.bizModel : undefined
    const pax = airlineKind !== 'cargo' && biz !== 'cargo'
    const ghost = pax ? checkInGhost(onTo, flight ? flightIsIntl(flight) : false) : null
    const status: TtFlight['status'] =
      slot.status === 'cancelled' ? 'cancelled' : slot.status === 'done' ? 'done' : slot.status
    const win = windowOf(slot)
    const stripe = 'stripe' in al && typeof al.stripe === 'string' ? al.stripe : undefined
    const shared = {
      contractId: slot.id,
      flightNo: slot.flightNo,
      airlineName: al.name,
      airlineId: slot.airline,
      color: al.color,
      stripe,
      windowStart: win.start,
      windowEnd: win.end,
      standId: stand ? key(stand) : null,
      standLabel,
      standPinned: !!slot.standPref,
      icao,
      aircraft: flight?.airframeName ?? 'TBA',
      sizeBand: turnBand(icao, kind),
      turnTarget: turn,
      services: [] as string[],
      delaySec: slot.delaySec,
      delayReason: slot.delayReason,
      runwayId: slot.runwayPref != null ? rwId(slot.runwayPref) : null,
      manual: slot.manual,
      checkInFrom: ghost?.from ?? null,
      checkInTo: ghost?.to ?? null,
      terminal: terminalOf(standLabel),
      traffic: trafficOf(flight?.kind, airlineKind, biz),
      rotationId: slot.id,
    }
    return [
      {
        ...shared,
        id: `${slot.id}:arr`,
        direction: 'arr',
        time: slot.eta,
        status,
        movable: status === 'scheduled' || status === 'delayed',
      },
      {
        ...shared,
        id: `${slot.id}:dep`,
        direction: 'dep',
        time: onTo + TAXI,
        status: status === 'inbound' ? 'scheduled' : status,
        movable: false,
      },
    ]
  }

  /** Aircraft already on the ground that left the schedule (or never had a slot). */
  const groundRows = (f: Flight): TtFlight[] => {
    if (!f.stand) return []
    const parked = ['taxi_in', 'deboard', 'servicing', 'board', 'pushback', 'parked', 'mx_return'].includes(f.phase)
    const leaving = f.phase === 'taxi_out' || f.phase === 'takeoff'
    if (!parked && !leaving) return []
    const al = game.airline(f.airline)
    const icao = icaoForAirframe(f.airframeId, f.kind)
    const progress = Math.min(0.9, f.phase === 'board' ? 0.75 : f.phase === 'servicing' ? 0.45 : 0.15)
    const turn = turnFor(icao, f.kind)
    const from = game.clock - turn * progress
    const to = leaving ? game.clock : from + turn
    return [
      {
        id: `${f.id}:dep`,
        flightNo: f.flightNo,
        airlineName: al.name,
        color: al.color,
        stripe: 'stripe' in al && typeof al.stripe === 'string' ? al.stripe : undefined,
        airlineId: f.airline,
        terminal: terminalOf(game.gateLabel(f.stand)),
        traffic: trafficOf(f.kind, 'kind' in al ? al.kind : undefined, 'bizModel' in al ? al.bizModel : undefined),
        direction: 'dep',
        time: leaving ? game.clock : to + TAXI,
        onStandFrom: from,
        onStandTo: to,
        window: null,
        status: leaving ? 'departing' : 'on_stand',
        delaySec: 0,
        delayReason: null,
        standId: key(f.stand),
        standLabel: game.gateLabel(f.stand),
        pinned: false,
        icao,
        aircraft: f.airframeName,
        sizeBand: turnBand(icao, f.kind),
        runwayId: null,
        manual: false,
        movable: false,
      },
    ]
  }

  const slotOf = (id: string) => game.schedule.find((s) => s.id === id.replace(/:(arr|dep)$/, ''))

  return {
    source: 'Contracts',
    caps: { move: true, pin: true, swap: true, pullBump: true, cancel: true, runway: true },
    dayLength: DAY_LENGTH,
    now: () => game.clock,
    flights() {
      const out: TtFlight[] = []
      // Authoritative runway membership straight from the game's per-strip query.
      const onRunway = new Map<string, number>()
      const strips = Math.max(1, game.runwayStripCount())
      for (let i = 0; i < strips; i++) for (const s of game.scheduleForRunway(i)) onRunway.set(s.id, i)
      const stamp = (rows: TtFlight[], slotId: string) => {
        const i = onRunway.get(slotId)
        for (const r of rows) if (i != null) r.runwayId = rwId(i)
        return rows
      }
      const linked = new Set<string>()
      const movements: ContractMovement[] = []
      for (const s of game.schedule) {
        if (s.status === 'done' && !s.flightId) continue
        if (s.flightId) linked.add(s.flightId)
        const flight = s.flightId ? game.flights.find((f) => f.id === s.flightId) : undefined
        if (s.status === 'done' || (flight && flight.stand && flight.phase !== 'approach' && flight.phase !== 'hold' && flight.phase !== 'landing')) {
          if (flight) out.push(...groundRows(flight))
          continue
        }
        movements.push(...slotMovements(s))
      }
      for (const f of game.flights) if (!linked.has(f.id)) out.push(...groundRows(f))
      const scheduled = contractsAdapter({
        dayLength: DAY_LENGTH,
        now: () => game.clock,
        movements: () => movements,
        stands: () => [],
        runways: () => [],
        reschedule: () => null,
        assignStand: () => {},
      }).flights()
      for (const row of scheduled) {
        const slotId = row.id.replace(/:(arr|dep)$/, '')
        out.push(...stamp([row], slotId))
      }
      return out
    },
    stands(): TtStand[] {
      const leases = game.hubLeases ?? []
      return standVecs().map((v) => {
        const cls = game.standClassAt(v)
        const lease = leases.find((row) => row.kind === 'gate' && row.id === `stand:${v.c},${v.r}`)
        const holder = lease ? game.airline(lease.airlineId) : null
        return {
          id: key(v),
          label: game.gateLabel(v),
          icao: paintedLetter(game, v),
          gameClass: cls,
          leaseAirline: holder?.name ?? null,
          leaseColor: holder?.color ?? null,
        }
      })
    },
    runways(): TtRunway[] {
      const n = Math.max(1, game.runwayStripCount())
      // Each strip turns one movement roughly every 2.5 sim-seconds of separation;
      // scale by tower parallel approaches so the number tracks real game limits.
      const perHour = Math.max(1, Math.round(hourSecs(DAY_LENGTH) / 2.5))
      const parallel = Math.max(1, game.maxInbound())
      // Spread the tower's parallel-approach bonus across strips (rounded down per strip).
      return Array.from({ length: n }, (_, i) => ({
        id: rwId(i),
        index: i,
        label: `RW${i + 1}`,
        hourlyCap: Math.min(perHour * 2, perHour + Math.floor(parallel / n)),
      }))
    },
    moveTo(id, time) {
      const s = slotOf(id)
      if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return null
      const target = clampToWindow(time, windowOf(s), game.clock + 6)
      const delta = target - s.eta
      if (Math.abs(delta) < 0.25) return s.eta
      if (game.placeSlotTime) {
        const win = windowOf(s)
        const mid = (win.start + win.end) / 2
        let standing = 0
        if (Math.abs(target - mid) > gameMinToSim(SCHEDULE.softWindowMin) + 1e-3) {
          const mark = `${s.id}:${Math.floor(game.clock / (DAY_LENGTH * 7))}`
          if (!outsideSoft.has(mark)) {
            outsideSoft.add(mark)
            standing = 1
          }
        }
        return game.placeSlotTime(s.id, target, standing)
      }
      if (delta < 0) game.pullSlot(s.id, -delta)
      else game.bumpSlot(s.id, delta)
      return s.eta
    },
    pinStand(id, standId) {
      const s = slotOf(id)
      if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return null
      if (standId) {
        const why = refusalFor(game, s, standId)
        if (why) return why
      }
      game.setSlotStandPref(s.id, standId ? unkey(standId) : null)
      return null
    },
    swapStands(a, b) {
      const sa = slotOf(a)
      const sb = slotOf(b)
      if (!sa || !sb) return 'Unknown flight.'
      const pa = sa.standPref ?? null
      const pb = sb.standPref ?? null
      if (!pa || !pb) return 'Both flights need a stand.'
      const aWhy = refusalFor(game, sa, key(pb))
      if (aWhy) return aWhy
      const bWhy = refusalFor(game, sb, key(pa))
      if (bWhy) return bWhy
      game.setSlotStandPref(sa.id, pb)
      game.setSlotStandPref(sb.id, pa)
      return null
    },
    pull: (id) => {
      const s = slotOf(id)
      if (s) game.pullSlot(s.id)
    },
    bump: (id) => {
      const s = slotOf(id)
      if (s) game.bumpSlot(s.id)
    },
    cancel: (id) => {
      const s = slotOf(id)
      if (s) game.cancelSlot(s.id)
    },
    setRunway(id, runwayId) {
      // The game only exposes cycleSlotRunway (auto → RW1 → … → RWn → auto),
      // so step the cycle until the slot lands on the requested strip.
      const s = slotOf(id)
      if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
      const n = Math.max(1, game.runwayStripCount())
      const want = runwayId == null ? null : rwIndex(runwayId)
      if (want != null && (want < 0 || want >= n)) return
      for (let i = 0; i <= n + 1 && (s.runwayPref ?? null) !== want; i++) game.cycleSlotRunway(s.id)
    },
  }
}
