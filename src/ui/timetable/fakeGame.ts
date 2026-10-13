import { SIZE, type Flight, type ScheduleSlot, type Tile, type Vec } from '../../game/types'
import type { ScheduleGame } from './gameAdapter'

/** Minimal stand-in for Game used by timetable tests and the screenshot harness. */
export function makeFakeGame(opts: { clock?: number; strips?: number } = {}) {
  const tiles: Tile[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
  const standClass: Record<string, 'S' | 'M' | 'L'> = {}
  const addStand = (c: number, r: number, cls: 'S' | 'M' | 'L') => {
    tiles[r][c] = 'stand' as Tile
    standClass[`${c},${r}`] = cls
  }
  const log: string[] = []
  const g = {
    clock: opts.clock ?? 100,
    schedule: [] as ScheduleSlot[],
    flights: [] as Flight[],
    tiles,
    airline: (id: string) => ({ id, name: id.toUpperCase(), color: id === 'sky' ? '#38bdf8' : '#f472b6' }),
    gateLabel: (v: Vec | null) => (v ? `G${v.c}` : '—'),
    standClassAt: (v: Vec | null) => (v ? standClass[`${v.c},${v.r}`] ?? 'M' : 'M'),
    runwayStripCount: () => opts.strips ?? 1,
    maxInbound: () => 2,
    pullSlot(id: string, by = 12) {
      const s = g.schedule.find((x) => x.id === id)!
      s.eta = Math.max(g.clock + 6, s.eta - by)
      log.push(`pull ${id} ${by}`)
    },
    bumpSlot(id: string, by = 18) {
      const s = g.schedule.find((x) => x.id === id)!
      s.eta += by
      log.push(`bump ${id} ${by}`)
    },
    cancelSlot(id: string) {
      g.schedule.find((x) => x.id === id)!.status = 'cancelled'
      log.push(`cancel ${id}`)
    },
    cycleSlotRunway(id: string) {
      const s = g.schedule.find((x) => x.id === id)!
      const next = (s.runwayPref ?? -1) + 1
      s.runwayPref = next >= (opts.strips ?? 1) ? null : next
      log.push(`cycle ${id} ${s.runwayPref}`)
    },
    scheduleForRunway(rw: number | null) {
      const open = g.schedule.filter((s) => s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound')
      if (rw == null) return open
      if (rw === -1) return open.filter((s) => s.runwayPref == null)
      return open.filter((s) => s.runwayPref === rw)
    },
    setSlotStandPref(id: string, v: Vec | null) {
      g.schedule.find((x) => x.id === id)!.standPref = v
      log.push(`pin ${id} ${v ? `${v.c},${v.r}` : 'auto'}`)
    },
  }
  const slot = (id: string, airline: string, eta: number, extra: Partial<ScheduleSlot> = {}): ScheduleSlot => {
    const s: ScheduleSlot = {
      id,
      airline: airline as ScheduleSlot['airline'],
      flightNo: `${airline.slice(0, 2).toUpperCase()}${id.replace(/\D/g, '') || '1'}`,
      eta,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: false,
      flightId: null,
      standPref: null,
      ...extra,
    }
    g.schedule.push(s)
    return s
  }
  return { game: g as unknown as ScheduleGame & typeof g, addStand, slot, log }
}
