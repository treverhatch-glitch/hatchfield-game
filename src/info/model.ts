import type { FuelView } from '../fuel/types.ts'
import type { LandsideView, SegmentRead } from '../landside/types.ts'
import type { PowerLoad, PowerSnapshot } from '../economy/types.ts'
import { bayColor, bayLabel, fuelColor, powerColor, waitColor } from './color.ts'
import {
  AIRFIELD_LEGEND,
  BAY_LEGEND,
  FUEL_LEGEND,
  HEAT,
  POWER_LEGEND,
  QUEUE_LEGEND,
  TINT_OPACITY,
  TINT_OPACITY_HOT,
  TRAFFIC_LEGEND,
} from './config.ts'
import { parseServicePointLines, type ParsedPoint } from './parse.ts'
import type { InfoScore, InfoViewModel, TintCell } from './types.ts'

export interface BayStand {
  id: string
  c: number
  r: number
  occupied: boolean
  flightNo: string | null
  phase: string | null
  grade: string | null
  gradeNote: string | null
  inUse: number
  queued: number
  bays: number
}

export interface FuelTank {
  /** Sim farm stock. `tankLitres`, not the logistics fuel-farm ledger. */
  litres: number
  /** Tank tier capacity. */
  capacity: number
}

function cell(id: string, c: number, r: number, color: string, hot = false): TintCell {
  return { id, c, r, color, opacity: hot ? TINT_OPACITY_HOT : TINT_OPACITY }
}

function litres(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

function one(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}

export function coverLabel(days: number): string {
  if (!Number.isFinite(days)) return 'no uplift'
  if (days >= 10) return `${days.toFixed(0)} days`
  if (days >= 1) return `${days.toFixed(1)} days`
  const hours = days * 24
  if (hours >= 1) return `${hours.toFixed(1)} hours`
  return 'under an hour'
}

export function segmentWhy(segment: SegmentRead): string {
  return `Inputs: flow ${one(segment.flowPerMin)} vehicles per minute, capacity ${one(segment.capacity)}, and queue ${one(segment.queue)} on this ${segment.kind}.`
}

export function trafficModel(view: LandsideView): InfoViewModel {
  const pressure = Number.isFinite(view.pressure) ? view.pressure : 0
  return {
    id: 'traffic',
    title: 'Traffic',
    legend: [...TRAFFIC_LEGEND],
    scores: [
      {
        id: 'pressure',
        label: 'Pressure',
        value: `${Math.round(pressure * 100)}%`,
        why: 'Inputs: the tighter of lane flow against lane capacity, and curb vehicles against curb stalls.',
      },
      {
        id: 'arrivals',
        label: 'Arrivals',
        value: `${one(view.arrivalsPerMin)}/min`,
        why: 'Inputs: daily passengers, live departures, and the car, taxi, bus, and rail split.',
      },
      {
        id: 'queue',
        label: 'Queue',
        value: one(view.queue),
        why: 'Inputs: vehicles that do not fit the lane or the curb this tick.',
      },
      {
        id: 'delay',
        label: 'Delay',
        value: view.delaySec > 1 ? `${Math.round(view.delaySec)}s` : 'on time',
        why: 'Inputs: wait past the free-flow travel time, in seconds.',
      },
    ],
    details: view.segments.map((segment) => ({
      id: segment.id,
      label: segment.kind === 'curb' ? 'Curb' : 'Road',
      value: `${segment.c},${segment.r} · ${Math.round(segment.ratio * 100)}%`,
      why: segmentWhy(segment),
    })),
    fixes: [...view.fixes],
    tint: [],
  }
}

function queueScore(label: string, id: string, points: readonly ParsedPoint[], waiting: number | null): InfoScore {
  if (!points.length) {
    const count = waiting ?? 0
    return {
      id,
      label,
      value: `${count} waiting`,
      why: `Inputs: the hall count from servicePointLines for ${label.toLowerCase()}, used when the walk has no desk metrics.`,
    }
  }
  const worst = points.reduce((a, b) => (b.waitSec > a.waitSec ? b : a))
  return {
    id,
    label,
    value: worst.waitLabel,
    why: `Inputs: queue length and estimated wait on each ${label.toLowerCase()} point. Longest is ${worst.name} (queue ${worst.queue}, wait ${worst.waitLabel}, ${worst.state}).`,
  }
}

export function queuesModel(
  checkinLines: readonly string[],
  securityLines: readonly string[],
  terminals: readonly { c: number; r: number }[],
): InfoViewModel {
  const checkin = parseServicePointLines('checkin', checkinLines)
  const security = parseServicePointLines('security', securityLines)
  const points = [...checkin.points, ...security.points]
  const worstSec = points.reduce((n, p) => Math.max(n, p.waitSec), 0)
  const waiting = (checkin.waiting ?? 0) + (security.waiting ?? 0)
  const color = points.length ? waitColor(worstSec) : waiting > 0 ? HEAT.mid : HEAT.low
  const fixes = [checkin.bottleneck, security.bottleneck].filter((line): line is string => Boolean(line))
  return {
    id: 'queues',
    title: 'Queues',
    legend: [...QUEUE_LEGEND],
    scores: [
      queueScore('Check-in', 'checkin-wait', checkin.points, checkin.waiting),
      queueScore('Security', 'security-wait', security.points, security.waiting),
    ],
    details: points.map((point) => ({
      id: `${point.kind}-${point.index}`,
      label: point.name,
      value: `queue ${point.queue} · ${point.waitLabel} · ${point.state}`,
      why: `Inputs: queue ${point.queue}, wait ${point.waitLabel}, and state ${point.state} from servicePointLines.`,
    })),
    fixes,
    tint: terminals.map((spot) => cell(`queue:${spot.c},${spot.r}`, spot.c, spot.r, color, worstSec >= 120 || (!points.length && waiting > 0))),
  }
}

export function baysModel(stands: readonly BayStand[]): InfoViewModel {
  const occupied = stands.filter((stand) => stand.occupied).length
  const queued = stands.reduce((n, stand) => n + stand.queued, 0)
  const notes = new Set<string>()
  for (const stand of stands) {
    if (stand.gradeNote && stand.gradeNote !== 'On time') notes.add(stand.gradeNote)
  }
  return {
    id: 'bays',
    title: 'Turnaround bays',
    legend: [...BAY_LEGEND],
    scores: [
      {
        id: 'in-use',
        label: 'In use',
        value: `${occupied}/${stands.length}`,
        why: 'Inputs: stands with an aircraft still on the bay, against every stand on the field.',
      },
      {
        id: 'bay-queue',
        label: 'Bay queue',
        value: String(queued),
        why: 'Inputs: vehicles waiting because a fuel, catering, bag, or pushback bay on that stand is taken.',
      },
    ],
    details: stands.map((stand) => {
      const grade = stand.grade ? ` · grade ${stand.grade}` : ''
      const flight = stand.flightNo ? ` · ${stand.flightNo}` : ''
      return {
        id: stand.id,
        label: `Stand ${stand.c},${stand.r}`,
        value: `${bayLabel(stand.occupied, stand.queued)}${flight}${grade} · queue ${stand.queued}`,
        why: stand.grade
          ? `Inputs: scheduled slot minutes, minutes used so far, and bay-queue minutes. Grade ${stand.grade}${stand.gradeNote ? ` (${stand.gradeNote})` : ''}. Service bays in use ${stand.inUse} of ${stand.bays}.`
          : `Inputs: an aircraft on the stand (${stand.phase ?? 'none'}) and vehicles queued at its bays (${stand.queued}).`,
      }
    }),
    fixes: [...notes],
    tint: stands.map((stand) =>
      cell(stand.id, stand.c, stand.r, bayColor(stand.occupied, stand.queued), stand.queued > 0),
    ),
  }
}

export interface AirfieldLoad {
  strips: number
  /** Movements the strips can start in one sim-day. */
  capacity: number
  /** Arrival and departure movements booked in that day. */
  scheduled: number
  /** Sim-seconds between arrivals on this field. */
  gapSec: number
  overbooked: boolean
}

export function airfieldModel(
  load: AirfieldLoad,
  strips: readonly { c: number; r: number }[],
): InfoViewModel {
  const capacity = Number.isFinite(load.capacity) ? Math.max(0, load.capacity) : 0
  const scheduled = Number.isFinite(load.scheduled) ? Math.max(0, load.scheduled) : 0
  const shownCapacity = Math.max(1, Math.round(capacity))
  const color = powerColor(scheduled, capacity)
  const gap = Number.isFinite(load.gapSec) ? load.gapSec : 0
  return {
    id: 'airfield',
    title: 'Airfield',
    legend: [...AIRFIELD_LEGEND],
    scores: [
      {
        id: 'movements',
        label: 'Movements',
        value: `${Math.round(scheduled)} / ${shownCapacity}`,
        why: `Inputs: ${Math.round(scheduled)} scheduled arrivals and departures against ${shownCapacity} movements this runway can start in a day.`,
      },
      {
        id: 'gap',
        label: 'Arrival gap',
        value: `${Math.round(gap)}s`,
        why: `Inputs: ${load.strips} strip${load.strips === 1 ? '' : 's'} and the seconds a departure needs to clear before the next arrival.`,
      },
    ],
    details: [
      {
        id: 'contracts',
        label: 'Contracts',
        value: load.overbooked ? 'Over the runway' : 'Inside capacity',
        why: load.overbooked
          ? `Inputs: signed contracts booked ${Math.round(scheduled)} movements and the strips turn ${shownCapacity} a day.`
          : `Inputs: signed contracts booked ${Math.round(scheduled)} movements and the strips turn ${shownCapacity} a day.`,
      },
    ],
    fixes: load.overbooked ? ['Contracts exceed the runway — add a strip or spread the bank.'] : [],
    tint: strips.map((spot, index) => cell(`runway:${index}:${spot.c},${spot.r}`, spot.c, spot.r, color, load.overbooked)),
  }
}

export function powerModel(
  power: PowerSnapshot,
  loads: readonly PowerLoad[],
  plantName: string,
  cells: readonly { id: string; c: number; r: number }[],
): InfoViewModel {
  const demand = Number.isFinite(power.demand) ? power.demand : 0
  const capacity = Number.isFinite(power.capacity) ? power.capacity : 0
  const color = powerColor(demand, capacity)
  const loadList = loads.map((load) => `${load.id} ${Math.round(load.demand)}`).join(', ') || 'none'
  return {
    id: 'power',
    title: 'Power',
    legend: [...POWER_LEGEND],
    scores: [
      {
        id: 'capacity',
        label: 'Capacity',
        value: Math.round(capacity).toLocaleString('en-US'),
        why: `Inputs: ${plantName} tier ${power.tier} capacity, the capacity modifier, and battery storage.`,
      },
      {
        id: 'demand',
        label: 'Demand',
        value: Math.round(demand).toLocaleString('en-US'),
        why: `Inputs: site, lab, hangar, and night-hub loads (${loadList}).`,
      },
      {
        id: 'load',
        label: 'Load',
        value: capacity > 0 ? `${Math.round((demand / capacity) * 100)}%` : 'no plant',
        why: `Inputs: demand ${Math.round(demand)} divided by capacity ${Math.round(capacity)}.`,
      },
    ],
    details: loads.map((load) => ({
      id: load.id,
      label: load.id,
      value: Math.round(load.demand).toLocaleString('en-US'),
      why: `Inputs: demand ${Math.round(load.demand)} on load ${load.id}.`,
    })),
    fixes: power.brownout ? ['Brown-out — powered services slowed'] : [],
    tint: cells.map((spot) => cell(spot.id, spot.c, spot.r, color, power.brownout)),
  }
}

/** Days of cover from the sim tank and the chain's draw rates. */
export function daysOfCover(litres: number, truckPerMin: number, hydrantPerMin: number, minutesPerDay: number): number {
  const draw = Math.max(0, truckPerMin) + Math.max(0, hydrantPerMin)
  if (!(draw > 0) || !(minutesPerDay > 0)) return Number.POSITIVE_INFINITY
  return Math.max(0, litres) / (draw * minutesPerDay)
}

export function fuelModel(
  tank: FuelTank,
  chain: FuelView,
  farms: readonly { c: number; r: number }[],
  minutesPerDay: number,
): InfoViewModel {
  const litresNow = Number.isFinite(tank.litres) ? Math.max(0, tank.litres) : 0
  const capacity = Number.isFinite(tank.capacity) ? Math.max(0, tank.capacity) : 0
  const trucksOut = chain.queue.filter((row) => row.state === 'road').length
  const cover = daysOfCover(litresNow, chain.truckDrawPerMin, chain.hydrantDrawPerMin, minutesPerDay)
  const farm = chain.farm ?? farms[0] ?? null
  const color = fuelColor(litresNow, capacity)
  return {
    id: 'fuel',
    title: 'Fuel',
    legend: [...FUEL_LEGEND],
    scores: [
      {
        id: 'level',
        label: 'Farm level',
        value: `${litres(litresNow)} L of ${litres(capacity)} L`,
        why: 'Inputs: tankLitres on the fuel farm and the tank tier capacity.',
      },
      {
        id: 'cover',
        label: 'Cover',
        value: coverLabel(cover),
        why: 'Inputs: tankLitres divided by truck draw per minute plus hydrant draw per minute.',
      },
      {
        id: 'trucks',
        label: 'Trucks out',
        value: String(trucksOut),
        why: 'Inputs: fuel-chain deliveries whose state is road.',
      },
    ],
    details: chain.queue.map((row) => ({
      id: row.id,
      label: row.mode === 'pipeline' ? 'Pipeline' : 'Tanker',
      value: `${litres(row.litres)} L · ${row.state === 'road' ? 'on the road' : row.state === 'wait_cash' ? 'waiting on cash' : 'docked'}`,
      why: `Inputs: delivery mode ${row.mode}, litres ${Math.round(row.litres)}, and state ${row.state}.`,
    })),
    fixes: chain.groundedIds.length ? [`${chain.groundedIds.length} departures grounded for fuel`] : [],
    tint: farm ? [cell(`fuel:${farm.c},${farm.r}`, farm.c, farm.r, color, litresNow / Math.max(1, capacity) < 0.25)] : [],
  }
}
