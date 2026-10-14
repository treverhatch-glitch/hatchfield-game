/**
 * Manor-style docking for the apron.
 *
 * The logistics engine still owns fuel, bags, meals and the road graph.
 * This module owns the service points those vehicles dock at: how many bays
 * a point has, who is waiting, the approach → align → service → depart
 * sequence, the fleet cap, and the A–F grade for the turn.
 *
 * Pure TypeScript. No renderer, no clock of its own — the caller advances
 * the phases. The same inputs always give the same queue and the same grade.
 */

export const DOCK_PHASES = ['idle', 'route', 'approach', 'align', 'service', 'depart'] as const
export type DockPhase = (typeof DOCK_PHASES)[number]

export type AnchorKind = 'fuel_hose' | 'catering_door' | 'baggage_hold' | 'pushback' | 'loading_bay' | 'dock'

export type TurnGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/** Minutes and metres. Change the feel of the dock here, not in the engine. */
export const DOCK_TIMING = {
  approachMin: 0.6,
  alignMin: 0.45,
  departMin: 0.5,
  /** How far behind the stop line the approach starts, metres. */
  approachGapM: 14,
  /** Gap between vehicles waiting for a busy bay, metres. */
  queueGapM: 8,
  /** How far a tug shoves the nose back while it is on the job, metres. */
  pushbackRollM: 10,
} as const

/** Work units per minute while one bay of that kind is actually in service. */
export const BAY_RATE: Record<AnchorKind, number> = {
  fuel_hose: 1000,
  catering_door: 40,
  baggage_hold: 20,
  pushback: 1,
  loading_bay: 40,
  dock: 800,
}

const FRAME: Record<'S' | 'M' | 'L', { lengthM: number; spanM: number }> = {
  S: { lengthM: 28, spanM: 26 },
  M: { lengthM: 39.5, spanM: 35.8 },
  L: { lengthM: 72, spanM: 64 },
}

export interface AnchorSpec {
  id: string
  kind: AnchorKind
  ownerId: string
  owner: 'stand' | 'building'
  /** Stop point in the owner's frame. +x is forward (nose, or out from a building door). +y is left. */
  x: number
  y: number
  /** Vehicle heading in the owner frame. 0 faces +x. */
  heading: number
  bays: number
  ratePerBay: number
}

export interface DockConfig {
  fuelBays?: number
  kitchenBays?: number
  makeupBays?: number
  cargoBays?: number
  terminalBays?: number
  /** How many of a type may be out of the depot at once. Omitted types use the owned count. */
  fleetCap?: Partial<Record<string, number>>
}

export interface FlowActor {
  id: string
  type: string
  phase: DockPhase
  anchorId: string | null
  /** 0 occupies a bay. 1+ is waiting, 1 being next. */
  queueIndex: number
  slot: number
  reason: string
  turnaroundId: string
  /** 0..1 through the current phase. The caller sets this from its own clock. */
  u: number
}

export interface DockVisual {
  phase: DockPhase
  u: number
  queueIndex: number
  reason: string
  owner: 'stand' | 'building'
  standId: string | null
  /** Metres in the owner frame. */
  localX: number
  localY: number
  /** Heading in the owner frame, radians. */
  heading: number
  /** Rearward shove of a pushback, metres, already folded into localX. */
  rollM: number
}

export interface AnchorThroughput {
  id: string
  kind: AnchorKind
  ownerId: string
  bays: number
  /** Bays whose vehicle is in the service phase (hose on, belt running). */
  inUse: number
  /** Vehicles waiting because every bay is taken. */
  queued: number
  /** inUse × rate per bay. An empty bay adds nothing. */
  unitsPerMin: number
  ratePerBay: number
}

export interface GradeInput {
  scheduledMin: number
  actualMin: number
  queuedMin: number
}

export interface GradeResult {
  grade: TurnGrade
  lateMin: number
  queuedMin: number
  note: string
}

function finite(n: number | undefined, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function baysOf(n: number | undefined, fallback: number): number {
  const v = Math.floor(finite(n, fallback))
  return v < 1 ? 1 : v
}

/** Nose / wing envelope used to place stand points. Size class, not a mesh. */
export function frameFor(sizeClass: 'S' | 'M' | 'L'): { lengthM: number; spanM: number } {
  return FRAME[sizeClass]
}

export function standLabel(id: string): string {
  const numbered = /stand-(\d+)/i.exec(id)
  if (numbered) return `Stand ${numbered[1]}`
  const remote = /remote-(\d+)/i.exec(id)
  if (remote) return `Remote ${remote[1]}`
  return id
}

/**
 * Fuel hose, catering door, baggage hold and the pushback point for one stand.
 * The hold has two bays so a belt loader and a cart train can be on it together.
 */
export function standAnchors(
  standId: string,
  sizeClass: 'S' | 'M' | 'L',
  fuelPoints = 1,
  cateringBays = 1,
): AnchorSpec[] {
  const { lengthM, spanM } = frameFor(sizeClass)
  const wing = spanM / 2 + 8
  const holdY = spanM * 0.42 + 5
  return [
    {
      id: `stand:${standId}:fuel`,
      kind: 'fuel_hose',
      ownerId: standId,
      owner: 'stand',
      x: lengthM * 0.12,
      y: wing,
      heading: -Math.PI / 2,
      bays: Math.max(1, fuelPoints),
      ratePerBay: BAY_RATE.fuel_hose,
    },
    {
      id: `stand:${standId}:catering`,
      kind: 'catering_door',
      ownerId: standId,
      owner: 'stand',
      x: lengthM * 0.28,
      y: -(spanM * 0.28 + 6),
      heading: Math.PI / 2,
      bays: Math.max(1, cateringBays),
      ratePerBay: BAY_RATE.catering_door,
    },
    {
      id: `stand:${standId}:hold`,
      kind: 'baggage_hold',
      ownerId: standId,
      owner: 'stand',
      x: -lengthM * 0.18,
      y: holdY,
      heading: -Math.PI / 2,
      bays: 2,
      ratePerBay: BAY_RATE.baggage_hold,
    },
    {
      id: `stand:${standId}:pushback`,
      kind: 'pushback',
      ownerId: standId,
      owner: 'stand',
      x: lengthM / 2 + 7,
      y: 0,
      heading: 0,
      bays: 1,
      ratePerBay: BAY_RATE.pushback,
    },
    {
      id: `stand:${standId}:dock`,
      kind: 'dock',
      ownerId: standId,
      owner: 'stand',
      x: -lengthM * 0.32,
      y: -(spanM * 0.2 + 5),
      heading: Math.PI / 2,
      bays: 2,
      ratePerBay: BAY_RATE.dock,
    },
  ]
}

export interface BuildingNodes {
  fuel: string
  kitchen: string
  makeup: string
  cargo: string
  terminal: string
}

/** Loading bays and docks on the farm, kitchen, bag makeup, cargo shed and terminal kerb. */
export function buildingAnchors(nodes: BuildingNodes, cfg: DockConfig = {}): AnchorSpec[] {
  const row = (id: string, kind: AnchorKind, ownerId: string, bays: number, rate: number): AnchorSpec => ({
    id,
    kind,
    ownerId,
    owner: 'building',
    x: 8,
    y: 0,
    heading: 0,
    bays,
    ratePerBay: rate,
  })
  return [
    row('building:fuel', 'dock', nodes.fuel, baysOf(cfg.fuelBays, 2), BAY_RATE.dock),
    row('building:kitchen', 'dock', nodes.kitchen, baysOf(cfg.kitchenBays, 1), BAY_RATE.catering_door),
    row('building:makeup', 'loading_bay', nodes.makeup, baysOf(cfg.makeupBays, 2), BAY_RATE.loading_bay),
    row('building:cargo', 'loading_bay', nodes.cargo, baysOf(cfg.cargoBays, 1), BAY_RATE.loading_bay),
    row('building:terminal', 'dock', nodes.terminal, baysOf(cfg.terminalBays, 2), BAY_RATE.dock),
  ]
}

/** Which stand point a service uses. Loaders share the hold with the cart train. */
export function anchorIdFor(standId: string, service: string, place: 'stand' | 'source' | 'drop'): string {
  if (place === 'source') {
    if (service === 'fuel') return 'building:fuel'
    if (service === 'catering') return 'building:kitchen'
    if (service === 'bag_load' || service === 'boarding') return service === 'boarding' ? 'building:terminal' : 'building:makeup'
    return 'building:cargo'
  }
  if (place === 'drop') return service === 'cargo_unload' ? 'building:cargo' : 'building:terminal'
  if (service === 'fuel') return `stand:${standId}:fuel`
  if (service === 'catering') return `stand:${standId}:catering`
  if (service === 'pushback') return `stand:${standId}:pushback`
  if (
    service === 'bag_unload' ||
    service === 'bag_load' ||
    service === 'bag_offload' ||
    service === 'cargo_unload' ||
    service === 'cargo_load' ||
    service === 'loader'
  ) {
    return `stand:${standId}:hold`
  }
  return `stand:${standId}:dock`
}

/** 'Refuel ZO116 at Stand 3'. */
export function serviceReason(service: string, callsign: string, where: string): string {
  const who = callsign ? `${callsign} at ${where}` : where
  switch (service) {
    case 'fuel':
      return `Refuel ${who}`
    case 'catering':
      return `Cater ${who}`
    case 'pushback':
      return `Push back ${who}`
    case 'bag_unload':
    case 'bag_load':
    case 'bag_offload':
    case 'loader':
      return `Bags for ${who}`
    case 'cargo_unload':
    case 'cargo_load':
      return `Cargo for ${who}`
    case 'gpu':
      return `Ground power for ${who}`
    case 'lav':
      return `Lav service for ${who}`
    case 'water':
      return `Water for ${who}`
    case 'boarding':
    case 'deplane':
      return `Board ${who}`
    case 'fill':
      return callsign ? `Fill tanker for ${callsign} at ${where}` : `Fill tanker at ${where}`
    case 'drop':
      return callsign ? `Drop for ${callsign} at ${where}` : `Drop at ${where}`
    default:
      return `Service ${who}`
  }
}

const PHASE_LINE: Record<DockPhase, string> = {
  idle: 'at the depot',
  route: 'en route',
  approach: 'approaching',
  align: 'lining up',
  service: 'on the job',
  depart: 'clearing',
}

/** Reason plus what the vehicle is doing right now. Queue position is part of the line. */
export function taskLine(reason: string, phase: DockPhase, queueIndex: number): string {
  if (!reason) return PHASE_LINE[phase]
  if (queueIndex > 0) {
    const ahead = queueIndex === 1 ? '1 ahead' : `${queueIndex} ahead`
    return `${reason} — waiting, ${ahead}`
  }
  return `${reason} — ${PHASE_LINE[phase]}`
}

/**
 * A on time with a clear bay. Queue time and lateness walk the letter down.
 * F is a turn that ran more than half again as long as the slot, or a long queue on top of a miss.
 */
export function gradeTurnaround(input: GradeInput): GradeResult {
  const scheduled = Math.max(0, finite(input.scheduledMin))
  const actual = Math.max(0, finite(input.actualMin))
  const queued = Math.max(0, finite(input.queuedMin))
  const late = Math.max(0, actual - scheduled)
  const ratio = scheduled > 0 ? (late + queued * 0.5) / scheduled : late > 0 ? 1 : 0
  let grade: TurnGrade = 'A'
  if (queued > 0.5 && late <= 0) grade = 'B'
  else if (ratio <= 0) grade = 'A'
  else if (ratio <= 0.1) grade = 'C'
  else if (ratio <= 0.25) grade = 'D'
  else if (ratio <= 0.5) grade = 'E'
  else grade = 'F'
  const note =
    grade === 'A'
      ? 'On time'
      : grade === 'B'
        ? 'Made the slot, with a bay queue'
        : grade === 'C'
          ? 'A few minutes over'
          : grade === 'D'
            ? 'Bay queue slowed the turn'
            : grade === 'E'
              ? 'The ramp was stacked'
              : 'Missed the turn by a wide margin'
  return { grade, lateMin: late, queuedMin: queued, note }
}

function approachPoint(anchor: AnchorSpec, queueIndex: number): { x: number; y: number } {
  const back = DOCK_TIMING.approachGapM + Math.max(0, queueIndex) * DOCK_TIMING.queueGapM
  const hx = Math.cos(anchor.heading)
  const hy = Math.sin(anchor.heading)
  return { x: anchor.x - hx * back, y: anchor.y - hy * back }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Where the vehicle sits for this phase. Queue slots step back along the approach
 * so a busy bay shows a line, not a pile.
 */
/**
 * Phase the renderer already knows how to draw.
 * Approach and align ramp the hose, lift or belt. Service holds it open. Depart stows it.
 * Route stays on the road pose the logistics sim already interpolated.
 */
export function shownPhase(phase: DockPhase, u: number): { phase: 'servicing' | 'to_stand'; u: number } | null {
  const t = u <= 0 ? 0 : u >= 1 ? 1 : u
  if (phase === 'approach') return { phase: 'servicing', u: 0.03 + t * 0.04 }
  if (phase === 'align') return { phase: 'servicing', u: 0.07 + t * 0.06 }
  if (phase === 'service') return { phase: 'servicing', u: 0.5 }
  if (phase === 'depart') return { phase: 'servicing', u: 0.9 + t * 0.08 }
  return null
}

export function poseFor(
  anchor: AnchorSpec,
  phase: DockPhase,
  u: number,
  queueIndex: number,
  slot = 0,
): { localX: number; localY: number; heading: number; rollM: number } {
  const t = u <= 0 ? 0 : u >= 1 ? 1 : u
  // Extra bays park beside the first so a belt loader and a cart train can both touch the hold.
  const px = -Math.sin(anchor.heading)
  const py = Math.cos(anchor.heading)
  const side = (slot > 0 ? slot : 0) * 6
  const stop = { x: anchor.x + px * side, y: anchor.y + py * side }
  const from = approachPoint({ ...anchor, x: stop.x, y: stop.y }, queueIndex)
  let x = stop.x
  let y = stop.y
  let rollM = 0
  if (phase === 'route' || phase === 'approach' || queueIndex > 0) {
    const at = queueIndex > 0 && phase === 'route' ? approachPoint({ ...anchor, x: stop.x, y: stop.y }, queueIndex) : from
    if (phase === 'approach' && queueIndex === 0) {
      x = lerp(from.x, stop.x, t)
      y = lerp(from.y, stop.y, t)
    } else {
      x = at.x
      y = at.y
    }
  } else if (phase === 'align') {
    x = lerp(from.x, stop.x, 0.72 + 0.28 * t)
    y = lerp(from.y, stop.y, 0.72 + 0.28 * t)
  } else if (phase === 'depart') {
    x = lerp(stop.x, from.x, t)
    y = lerp(stop.y, from.y, t)
  } else if (phase === 'service' && anchor.kind === 'pushback') {
    rollM = DOCK_TIMING.pushbackRollM * t * t * (3 - 2 * t)
    x = stop.x - rollM
    y = stop.y
  }
  return { localX: x, localY: y, heading: anchor.heading, rollM }
}

interface Actor extends FlowActor {
  queuedMin: number
}

/**
 * Bays, queue and fleet cap for one airport.
 * Actors start idle. markOut sends one out (counts against the cap).
 * claim takes a bay or parks the vehicle in the queue.
 */
export class ServiceFlow {
  readonly timing = DOCK_TIMING
  private readonly anchors = new Map<string, AnchorSpec>()
  private readonly slots = new Map<string, (string | null)[]>()
  private readonly actors = new Map<string, Actor>()
  private readonly queueWait = new Map<string, number>()
  private readonly caps: Record<string, number>

  constructor(anchors: readonly AnchorSpec[], caps: Record<string, number> = {}) {
    this.caps = { ...caps }
    for (const a of anchors) this.addAnchor(a)
  }

  private addAnchor(a: AnchorSpec): void {
    const bays = a.bays < 1 ? 1 : Math.floor(a.bays)
    const spec = { ...a, bays }
    this.anchors.set(spec.id, spec)
    this.slots.set(spec.id, Array.from({ length: bays }, () => null))
  }

  /** Widebody fuel points, or a building the player expanded. */
  setBays(anchorId: string, bays: number): void {
    const spec = this.anchors.get(anchorId)
    if (!spec) return
    const n = bays < 1 ? 1 : Math.floor(bays)
    const prev = this.slots.get(anchorId) ?? []
    const next: (string | null)[] = Array.from({ length: n }, () => null)
    let w = 0
    for (const id of prev) {
      if (id && w < n) next[w++] = id
    }
    spec.bays = n
    this.slots.set(anchorId, next)
  }

  anchor(id: string): AnchorSpec | undefined {
    return this.anchors.get(id)
  }

  actor(id: string): FlowActor | undefined {
    const a = this.actors.get(id)
    if (!a) return undefined
    return {
      id: a.id,
      type: a.type,
      phase: a.phase,
      anchorId: a.anchorId,
      queueIndex: a.queueIndex,
      slot: a.slot,
      reason: a.reason,
      turnaroundId: a.turnaroundId,
      u: a.u,
    }
  }

  /** True when another of this type may leave the depot. */
  canDispatch(type: string): boolean {
    const cap = this.caps[type]
    if (cap === undefined) return true
    if (cap <= 0) return false
    let out = 0
    for (const a of this.actors.values()) {
      if (a.type === type && a.phase !== 'idle') out++
    }
    return out < cap
  }

  markOut(id: string, type: string, reason: string, turnaroundId: string): void {
    const prev = this.actors.get(id)
    this.actors.set(id, {
      id,
      type,
      phase: 'route',
      anchorId: prev?.anchorId ?? null,
      queueIndex: 0,
      slot: -1,
      reason,
      turnaroundId,
      u: 0,
      queuedMin: prev?.queuedMin ?? 0,
    })
  }

  /**
   * Take a free bay, or join the line. A queued vehicle stays in `route`
   * with queueIndex ≥ 1 until a bay frees and the caller promotes it.
   */
  claim(id: string, anchorId: string): 'bay' | 'queue' {
    const actor = this.actors.get(id)
    const spec = this.anchors.get(anchorId)
    if (!actor || !spec) return 'queue'
    const slots = this.slots.get(anchorId)
    if (!slots) return 'queue'
    actor.anchorId = anchorId
    const existing = slots.indexOf(id)
    if (existing >= 0) {
      actor.slot = existing
      actor.queueIndex = 0
      actor.phase = 'approach'
      actor.u = 0
      return 'bay'
    }
    const free = slots.indexOf(null)
    if (free >= 0) {
      slots[free] = id
      actor.slot = free
      actor.queueIndex = 0
      actor.phase = 'approach'
      actor.u = 0
      return 'bay'
    }
    const waiting = this.waiting(anchorId)
    actor.slot = -1
    actor.queueIndex = waiting.length + 1
    actor.phase = 'route'
    actor.u = 1
    return 'queue'
  }

  enter(id: string, phase: DockPhase): void {
    const actor = this.actors.get(id)
    if (!actor) return
    actor.phase = phase
    actor.u = 0
    if (phase === 'approach' || phase === 'align' || phase === 'service' || phase === 'depart') {
      actor.queueIndex = 0
    }
  }

  beginDepart(id: string): void {
    this.enter(id, 'depart')
  }

  /**
   * Leave the bay. The vehicle is idle and off the cap.
   * Returns the id that may start its approach, if anyone was waiting.
   */
  release(id: string): string | null {
    const actor = this.actors.get(id)
    if (!actor) return null
    const promoted = this.freeBay(actor)
    this.actors.delete(id)
    return promoted
  }

  /** Free the bay but keep the vehicle out (it is driving to the next stop). */
  releaseBay(id: string): string | null {
    const actor = this.actors.get(id)
    if (!actor) return null
    const promoted = this.freeBay(actor)
    actor.phase = 'route'
    actor.anchorId = null
    actor.queueIndex = 0
    actor.slot = -1
    actor.u = 0
    return promoted
  }

  private freeBay(actor: Actor): string | null {
    if (!actor.anchorId) return null
    const slots = this.slots.get(actor.anchorId)
    if (slots) {
      const i = slots.indexOf(actor.id)
      if (i >= 0) slots[i] = null
    }
    const anchorId = actor.anchorId
    const line = this.waiting(anchorId)
    const next = line[0]
    if (!next) return null
    const rest = line.slice(1)
    const slot = slots ? slots.indexOf(null) : -1
    if (slot < 0 || !slots) return null
    slots[slot] = next.id
    next.slot = slot
    next.queueIndex = 0
    next.phase = 'approach'
    next.u = 0
    rest.forEach((a, i) => {
      a.queueIndex = i + 1
    })
    return next.id
  }

  private waiting(anchorId: string): Actor[] {
    const line: Actor[] = []
    for (const a of this.actors.values()) {
      if (a.anchorId === anchorId && a.queueIndex > 0) line.push(a)
    }
    line.sort((a, b) => a.queueIndex - b.queueIndex || (a.id < b.id ? -1 : 1))
    return line
  }

  /** Add queue time. Call with the same dt the logistics clock just advanced. */
  accrue(dt: number): void {
    if (!(dt > 0)) return
    for (const a of this.actors.values()) {
      if (a.queueIndex <= 0 || !a.turnaroundId) continue
      a.queuedMin += dt
      this.queueWait.set(a.turnaroundId, (this.queueWait.get(a.turnaroundId) ?? 0) + dt)
    }
  }

  queuedMinutes(turnaroundId: string): number {
    return this.queueWait.get(turnaroundId) ?? 0
  }

  visual(id: string, u: number): DockVisual | null {
    const actor = this.actors.get(id)
    if (!actor || actor.phase === 'idle' || !actor.anchorId) return null
    const spec = this.anchors.get(actor.anchorId)
    if (!spec) return null
    const posed = poseFor(spec, actor.phase, u, actor.queueIndex, actor.slot)
    return {
      phase: actor.phase,
      u,
      queueIndex: actor.queueIndex,
      reason: actor.reason,
      owner: spec.owner,
      standId: spec.owner === 'stand' ? spec.ownerId : null,
      localX: posed.localX,
      localY: posed.localY,
      heading: posed.heading,
      rollM: posed.rollM,
    }
  }

  /** Throughput is the bays in service, not the bays that merely exist. */
  throughput(): AnchorThroughput[] {
    const out: AnchorThroughput[] = []
    for (const spec of this.anchors.values()) {
      let inUse = 0
      let queued = 0
      for (const a of this.actors.values()) {
        if (a.anchorId !== spec.id) continue
        if (a.queueIndex > 0) queued++
        else if (a.phase === 'service') inUse++
      }
      out.push({
        id: spec.id,
        kind: spec.kind,
        ownerId: spec.ownerId,
        bays: spec.bays,
        inUse,
        queued,
        unitsPerMin: inUse * spec.ratePerBay,
        ratePerBay: spec.ratePerBay,
      })
    }
    return out
  }

  tasks(): { id: string; phase: DockPhase; queueIndex: number; reason: string }[] {
    return [...this.actors.values()].map((a) => ({
      id: a.id,
      phase: a.phase,
      queueIndex: a.queueIndex,
      reason: a.reason,
    }))
  }
}
