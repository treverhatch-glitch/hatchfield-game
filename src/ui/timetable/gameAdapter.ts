import { AIRFRAMES } from '../../game/airframes'
import { tilesOf } from '../../game/path'
import type { Game } from '../../game/sim'
import type { AircraftKind, Flight, ScheduleSlot, Vec } from '../../game/types'
import { clampToWindow, hourSecs } from './time'
import type { IcaoCode, TimetableAdapter, TtFlight, TtRunway, TtStand, TtWindow } from './types'

/**
 * The thin slice of Game the timetable needs. Keeping it structural means tests
 * can feed a fake and nothing in sim.ts has to change.
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
>

export const DAY_LENGTH = 180
/** Tower can pull a slot this far ahead of its banked ETA (sim seconds). */
export const TOWER_PULL = 30
/** Tower lets you hold a slot this far after its banked ETA before it reads as a miss. */
export const TOWER_HOLD = 45
const TAXI = 6
const TURN: Record<'S' | 'M' | 'L', number> = { S: 40, M: 55, L: 90 }

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

function turnFor(icao: IcaoCode): number {
  return icao === 'F' ? TURN.L : icao === 'E' || icao === 'D' ? TURN.M : TURN.S
}

/** Game runway strip index ↔ timetable runway id. */
export const rwId = (i: number) => `rw${i}`
export const rwIndex = (id: string) => Number(id.replace(/^rw/, ''))

const key = (v: Vec) => `${v.c},${v.r}`
const unkey = (s: string): Vec => {
  const [c, r] = s.split(',').map(Number)
  return { c, r }
}

export function towerWindow(slot: ScheduleSlot, now: number, anchor?: number): TtWindow {
  const base = anchor ?? slot.eta - slot.delaySec
  return {
    start: Math.max(now + 6, base - TOWER_PULL),
    end: Math.max(now + 6, base + TOWER_HOLD),
    source: 'tower',
  }
}

export function gameScheduleAdapter(game: ScheduleGame): TimetableAdapter {
  const standVecs = () => tilesOf(game.tiles, 'stand')
  /** Banked ETA the first time we saw each slot, so drags don't walk the window. */
  const anchors = new Map<string, number>()
  const windowOf = (s: ScheduleSlot) => {
    if (!anchors.has(s.id)) anchors.set(s.id, s.eta - s.delaySec)
    return towerWindow(s, game.clock, anchors.get(s.id))
  }

  const slotRows = (slot: ScheduleSlot): TtFlight[] => {
    const al = game.airline(slot.airline)
    const flight = slot.flightId ? game.flights.find((f) => f.id === slot.flightId) : undefined
    const icao = flight ? icaoForAirframe(flight.airframeId, flight.kind) : 'C'
    const stand = flight?.stand ?? slot.standPref ?? null
    const onFrom = slot.eta + TAXI
    const onTo = onFrom + turnFor(icao)
    const status: TtFlight['status'] =
      slot.status === 'cancelled' ? 'cancelled' : slot.status === 'done' ? 'done' : slot.status
    const shared = {
      flightNo: slot.flightNo,
      airlineName: al.name,
      color: al.color,
      onStandFrom: onFrom,
      onStandTo: onTo,
      delaySec: slot.delaySec,
      delayReason: slot.delayReason,
      standId: stand ? key(stand) : null,
      standLabel: stand ? game.gateLabel(stand) : 'Tower',
      pinned: !!slot.standPref,
      icao,
      aircraft: flight?.airframeName ?? 'TBA',
      runwayId: slot.runwayPref != null ? rwId(slot.runwayPref) : null,
      manual: slot.manual,
      movable: slot.status === 'scheduled' || slot.status === 'delayed',
    }
    return [
      {
        ...shared,
        id: `${slot.id}:arr`,
        direction: 'arr',
        time: slot.eta,
        window: windowOf(slot),
        status,
      },
      {
        ...shared,
        id: `${slot.id}:dep`,
        direction: 'dep',
        time: onTo + TAXI,
        window: null,
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
    const turn = turnFor(icao)
    const from = game.clock - turn * progress
    const to = leaving ? game.clock : from + turn
    return [
      {
        id: `${f.id}:dep`,
        flightNo: f.flightNo,
        airlineName: al.name,
        color: al.color,
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
        runwayId: null,
        manual: false,
        movable: false,
      },
    ]
  }

  const slotOf = (id: string) => game.schedule.find((s) => s.id === id.replace(/:(arr|dep)$/, ''))

  return {
    source: 'Tower bank',
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
      for (const s of game.schedule) {
        if (s.status === 'done' && !s.flightId) continue
        if (s.flightId) linked.add(s.flightId)
        const flight = s.flightId ? game.flights.find((f) => f.id === s.flightId) : undefined
        if (s.status === 'done' || (flight && flight.stand && flight.phase !== 'approach' && flight.phase !== 'hold' && flight.phase !== 'landing')) {
          if (flight) out.push(...groundRows(flight))
          continue
        }
        out.push(...stamp(slotRows(s), s.id))
      }
      for (const f of game.flights) if (!linked.has(f.id)) out.push(...groundRows(f))
      return out
    },
    stands(): TtStand[] {
      return standVecs().map((v) => {
        const cls = game.standClassAt(v)
        return { id: key(v), label: game.gateLabel(v), icao: STAND_ICAO[cls] ?? 'E', gameClass: cls }
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
      if (delta < 0) game.pullSlot(s.id, -delta)
      else game.bumpSlot(s.id, delta)
      return s.eta
    },
    pinStand(id, standId) {
      const s = slotOf(id)
      if (s) game.setSlotStandPref(s.id, standId ? unkey(standId) : null)
    },
    swapStands(a, b) {
      const sa = slotOf(a)
      const sb = slotOf(b)
      if (!sa || !sb) return
      const pa = sa.standPref ?? null
      const pb = sb.standPref ?? null
      game.setSlotStandPref(sa.id, pb)
      game.setSlotStandPref(sb.id, pa)
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
