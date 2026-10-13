/**
 * Disruption events with a seeded scheduler, weather hooks, choices and outcomes.
 * Events are delivered as non-blocking notifications; if ignored, the default
 * choice applies when the card expires. The sim applies EventEffects itself.
 */
import type { NewNotification } from '../notifications/queue.ts'
import { createRng, type Rng } from '../shared/rng.ts'

export type WeatherKind = 'clear' | 'rain' | 'heavyRain' | 'thunderstorm' | 'wind' | 'snow' | 'fog'

/** Read-only view of the world the scheduler needs. */
export interface EventWorld {
  weather: WeatherKind
  /** Active flights per hour, used to scale odds. */
  traffic: number
  fuelTrucks: number
  staff: number
  /** Player's field level (gates harder events). */
  level: number
}

/** Mutations the sim should apply. All optional; the sim decides how. */
export interface EventEffect {
  cash?: number
  /** Minutes the runway is closed. */
  runwayClosedMin?: number
  /** Minutes added to turnarounds for affected flights. */
  turnaroundDelayMin?: number
  fuelTrucksDisabled?: number
  staffOut?: number
  durationMin?: number
  passengerMood?: number
  airlineRating?: number
  reputation?: number
}

export interface EventChoice { id: string; label: string; hint: string; effect: EventEffect }

export interface EventDef {
  id: string
  title: string
  summary: string
  baseChancePerDay: number
  minLevel?: number
  weatherMultiplier?: Partial<Record<WeatherKind, number>>
  requires?: (w: EventWorld) => boolean
  /** Card lifetime in game minutes before the default applies. */
  responseMin: number
  choices: EventChoice[]
  defaultChoice: string
  cooldownDays: number
}

export const EVENT_DEFS: EventDef[] = [
  {
    id: 'storm-runway', title: 'Storm closes the runway', summary: 'Lightning within 5 km. Tower recommends halting movements.',
    baseChancePerDay: 0.02, weatherMultiplier: { thunderstorm: 15, heavyRain: 3, wind: 2 }, responseMin: 15,
    choices: [
      { id: 'close', label: 'Close for 45 min', hint: 'safe, delays', effect: { runwayClosedMin: 45, passengerMood: -5 } },
      { id: 'divert', label: 'Divert inbound flights', hint: 'lose fees, keep ops', effect: { runwayClosedMin: 20, cash: -4000, airlineRating: -3 } },
      { id: 'risk', label: 'Keep operating', hint: 'risky', effect: { reputation: -10, airlineRating: -6 } },
    ],
    defaultChoice: 'close', cooldownDays: 2,
  },
  {
    id: 'fuel-truck-breakdown', title: 'Fuel truck breakdown', summary: 'A fuel truck has a hydraulic failure on the apron.',
    baseChancePerDay: 0.08, requires: (w) => w.fuelTrucks > 0, weatherMultiplier: { snow: 2 }, responseMin: 20,
    choices: [
      { id: 'repair', label: 'Rush repair ($1,500)', hint: 'back in 30 min', effect: { cash: -1500, fuelTrucksDisabled: 1, durationMin: 30 } },
      { id: 'wait', label: 'Wait for mechanic', hint: 'out 4 h, delays', effect: { fuelTrucksDisabled: 1, durationMin: 240, turnaroundDelayMin: 10 } },
    ],
    defaultChoice: 'wait', cooldownDays: 3,
  },
  {
    id: 'vip-turnaround', title: 'VIP fast turnaround', summary: 'A charter with a celebrity wants a 25-minute turnaround.',
    baseChancePerDay: 0.04, minLevel: 2, responseMin: 30,
    choices: [
      { id: 'accept', label: 'Accept ($8,000 bonus)', hint: 'pulls crews off others', effect: { cash: 8000, turnaroundDelayMin: 5, reputation: 5 } },
      { id: 'decline', label: 'Decline politely', hint: 'no change', effect: {} },
    ],
    defaultChoice: 'decline', cooldownDays: 5,
  },
  {
    id: 'bird-strike', title: 'Bird strike', summary: 'A departing aircraft reported a bird strike. Runway inspection needed.',
    baseChancePerDay: 0.03, weatherMultiplier: { clear: 1.5, snow: 0.3 }, responseMin: 10,
    choices: [
      { id: 'inspect', label: 'Inspect runway (20 min)', hint: 'safe', effect: { runwayClosedMin: 20 } },
      { id: 'skip', label: 'Skip inspection', hint: 'risky', effect: { reputation: -8 } },
    ],
    defaultChoice: 'inspect', cooldownDays: 2,
  },
  {
    id: 'staff-strike', title: 'Ground staff strike', summary: 'Ground staff threaten to walk out over pay.',
    baseChancePerDay: 0.01, minLevel: 3, requires: (w) => w.staff >= 10, responseMin: 120,
    choices: [
      { id: 'raise', label: 'Give a 5% raise', hint: 'ongoing cost', effect: { cash: -5000, passengerMood: 2 } },
      { id: 'refuse', label: 'Refuse', hint: 'half staff out for a day', effect: { staffOut: 0.5, durationMin: 1440, airlineRating: -5 } },
    ],
    defaultChoice: 'refuse', cooldownDays: 14,
  },
  {
    id: 'fog-low-vis', title: 'Low visibility procedures', summary: 'Dense fog: spacing must increase.',
    baseChancePerDay: 0, weatherMultiplier: { fog: 1 }, requires: (w) => w.weather === 'fog', responseMin: 15,
    choices: [
      { id: 'lvp', label: 'Enable LVP', hint: 'slower, safe', effect: { turnaroundDelayMin: 8, passengerMood: -3 } },
      { id: 'normal', label: 'Stay normal', hint: 'risky', effect: { reputation: -6 } },
    ],
    defaultChoice: 'lvp', cooldownDays: 1,
  },
  {
    id: 'snow-deicing', title: 'De-icing backlog', summary: 'Snow is building up. Aircraft need de-icing.',
    baseChancePerDay: 0, weatherMultiplier: { snow: 0.6 }, requires: (w) => w.weather === 'snow', responseMin: 30,
    choices: [
      { id: 'hire', label: 'Hire extra crews ($3,000)', hint: 'minor delays', effect: { cash: -3000, turnaroundDelayMin: 5 } },
      { id: 'queue', label: 'Queue flights', hint: 'big delays', effect: { turnaroundDelayMin: 25, passengerMood: -6 } },
    ],
    defaultChoice: 'queue', cooldownDays: 1,
  },
]

export interface ScheduledEvent { uid: string; defId: string; day: number }

/** Effective per-day chance after level, weather and traffic. */
export function eventChance(def: EventDef, w: EventWorld): number {
  if (def.minLevel !== undefined && w.level < def.minLevel) return 0
  if (def.requires && !def.requires(w)) return 0
  const wm = def.weatherMultiplier?.[w.weather] ?? 1
  const base = def.baseChancePerDay === 0 ? 1 : def.baseChancePerDay
  const traffic = 0.5 + Math.min(1.5, w.traffic / 20)
  return Math.min(0.95, base * wm * traffic)
}

export class EventScheduler {
  private rng: Rng
  private lastFired = new Map<string, number>()
  private seq = 0
  private readonly defs: EventDef[]
  /** Hard cap per day so the player is never swamped. */
  readonly maxPerDay: number

  constructor(seed: number, defs: EventDef[] = EVENT_DEFS, maxPerDay = 1) {
    this.rng = createRng(seed)
    this.defs = defs
    this.maxPerDay = maxPerDay
  }

  /** Roll once per game day (deterministic for a seed + world sequence). */
  rollDay(day: number, w: EventWorld): ScheduledEvent[] {
    const out: ScheduledEvent[] = []
    for (const d of this.defs) {
      const roll = this.rng.next()
      if (out.length >= this.maxPerDay) continue
      const last = this.lastFired.get(d.id)
      if (last !== undefined && day - last < d.cooldownDays) continue
      if (roll < eventChance(d, w)) {
        this.lastFired.set(d.id, day)
        out.push({ uid: `ev${++this.seq}`, defId: d.id, day })
      }
    }
    return out
  }

  /** Weather hook: call when weather changes; may trigger a weather event immediately. */
  onWeatherChange(day: number, w: EventWorld): ScheduledEvent[] {
    const out: ScheduledEvent[] = []
    for (const d of this.defs) {
      if (!d.weatherMultiplier?.[w.weather] || d.weatherMultiplier[w.weather]! < 1) continue
      if (d.baseChancePerDay !== 0 && (d.weatherMultiplier[w.weather] ?? 1) < 10) continue
      const last = this.lastFired.get(d.id)
      if (last !== undefined && day - last < d.cooldownDays) continue
      if (this.rng.next() < eventChance(d, w)) {
        this.lastFired.set(d.id, day)
        out.push({ uid: `ev${++this.seq}`, defId: d.id, day })
        break
      }
    }
    return out
  }
}

export function getEventDef(id: string, defs: EventDef[] = EVENT_DEFS): EventDef {
  const d = defs.find((x) => x.id === id)
  if (!d) throw new Error(`unknown event ${id}`)
  return d
}

/** Outcome of a resolved notification: which effect to apply. */
export function resolveEvent(defId: string, choiceId: string | undefined, defs: EventDef[] = EVENT_DEFS): EventEffect {
  const d = getEventDef(defId, defs)
  const c = d.choices.find((x) => x.id === (choiceId ?? d.defaultChoice)) ?? d.choices.find((x) => x.id === d.defaultChoice)!
  return c.effect
}

export function eventNotification(ev: ScheduledEvent, now: number, minuteMs: number, defs: EventDef[] = EVENT_DEFS): NewNotification<ScheduledEvent> {
  const d = getEventDef(ev.defId, defs)
  return {
    id: ev.uid,
    kind: 'event',
    priority: d.choices.some((c) => c.effect.runwayClosedMin) ? 'high' : 'normal',
    title: d.title,
    summary: d.summary,
    expiresAt: now + d.responseMin * minuteMs,
    choices: d.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })),
    defaultChoiceId: d.defaultChoice,
    payload: ev,
  }
}
