/**
 * Rate-limited phone texts. One warmth crossing, one text.
 * Not an offer and not a fee. Decline silences that step. Later only acks.
 */
import type { AssignKind } from './assign.ts'
import { checklistAssignTarget } from './assign.ts'
import type { ChecklistLine } from './checklist.ts'
import { HUB_TIER_LABEL, NUDGE_DAY_CAP, NUDGE_GAP_DAYS, type HubOfferTier, type VehicleRole } from './config.ts'

export interface NudgeCard {
  id: string
  airlineId: string
  name: string
  step: HubOfferTier
  text: string
  assignKind: AssignKind | null
  assignRole?: VehicleRole
}

export interface NudgeMemory {
  lastDay: Record<string, number>
  /** `${airlineId}:${step}` silenced by Decline. */
  silenced: string[]
  pending: { airlineId: string; step: HubOfferTier }[]
  /** Last contract tier already considered. A first sight is not a crossing. */
  notedTier: Record<string, number>
  inbox: NudgeCard[]
  day: number
  sent: number
}

export interface NudgeCarrier {
  id: string
  name: string
  contractTier: number
  linesFor: (step: HubOfferTier) => readonly ChecklistLine[]
}

const WARMTH: { tier: number; step: HubOfferTier }[] = [
  { tier: 2, step: 'focus' },
  { tier: 3, step: 'base' },
  { tier: 4, step: 'hub' },
  { tier: 5, step: 'primary' },
]

const STEPS = new Set<string>(WARMTH.map((row) => row.step))

const SCRIPT: Record<string, Partial<Record<HubOfferTier, string>>> = {
  brisa: {
    focus: 'We can make this a focus city. Tag a desk for us.',
    base: 'Request dedicated desks. Two of them, and a tug in our colours, and we will overnight.',
  },
  gulf_pearl: {
    hub: "The east pier is still everyone else's. Dedicated desks, a lounge, and our own trucks.",
    primary: 'One hub. The pier, the fuel hook, and we will bring the big type.',
  },
  atlas_cargo: {
    base: 'No desks. A night ramp and a bowser in our colours.',
  },
}

const GATE_IDS = new Set(['relation', 'band', 'onTime', 'tenure', 'signed', 'primary'])

export function emptyNudgeMemory(): NudgeMemory {
  return { lastDay: {}, silenced: [], pending: [], notedTier: {}, inbox: [], day: -1, sent: 0 }
}

function stepKey(airlineId: string, step: string): string {
  return `${airlineId}:${step}`
}

/** The first unmet place or vehicle on that rung. Relationship gates are not the ask. */
export function unmetHardLine(lines: readonly ChecklistLine[]): ChecklistLine | null {
  return lines.find((line) => line.status !== 'ok' && !GATE_IDS.has(line.id)) ?? null
}

export function nudgeText(airlineId: string, step: HubOfferTier, unmetLabel: string): string {
  return (
    SCRIPT[airlineId]?.[step] ??
    `Request ${unmetLabel.toLowerCase()}. That is the next step toward ${HUB_TIER_LABEL[step]}.`
  )
}

function isStep(value: string): value is HubOfferTier {
  return STEPS.has(value)
}

/**
 * Notice warmth crossings and send what the day cap and the per-airline gap allow.
 * A step whose hard line is already met is dropped. A full day keeps the step for later.
 */
export function considerNudges(memory: NudgeMemory, today: number, carriers: readonly NudgeCarrier[]): NudgeMemory {
  const next: NudgeMemory = {
    lastDay: { ...memory.lastDay },
    silenced: [...memory.silenced],
    pending: memory.pending.map((row) => ({ ...row })),
    notedTier: { ...memory.notedTier },
    inbox: memory.inbox.map((row) => ({ ...row })),
    day: memory.day === today ? memory.day : today,
    sent: memory.day === today ? memory.sent : 0,
  }
  const silenced = new Set(next.silenced)
  const known = new Set<string>([
    ...next.pending.map((row) => stepKey(row.airlineId, row.step)),
    ...next.inbox.map((row) => stepKey(row.airlineId, row.step)),
  ])

  for (const carrier of carriers) {
    const tier = Number.isFinite(carrier.contractTier) ? Math.max(1, Math.floor(carrier.contractTier)) : 1
    const seen = next.notedTier[carrier.id]
    if (seen == null) {
      next.notedTier[carrier.id] = tier
      continue
    }
    if (tier <= seen) continue
    for (const row of WARMTH) {
      if (row.tier <= seen || row.tier > tier) continue
      const id = stepKey(carrier.id, row.step)
      if (silenced.has(id) || known.has(id)) continue
      if (!unmetHardLine(carrier.linesFor(row.step))) continue
      next.pending.push({ airlineId: carrier.id, step: row.step })
      known.add(id)
    }
    next.notedTier[carrier.id] = tier
  }

  const queued = next.pending
  const still: NudgeMemory['pending'] = []
  for (const row of queued) {
    const carrier = carriers.find((item) => item.id === row.airlineId)
    if (!carrier) continue
    if (silenced.has(stepKey(row.airlineId, row.step))) continue
    const unmet = unmetHardLine(carrier.linesFor(row.step))
    if (!unmet) continue
    const last = next.lastDay[row.airlineId]
    const gap = last != null && today - last < NUDGE_GAP_DAYS
    if (next.sent >= NUDGE_DAY_CAP || gap) {
      still.push(row)
      continue
    }
    const target = checklistAssignTarget(unmet.id)
    next.inbox.push({
      id: `${row.airlineId}:${row.step}:${today}`,
      airlineId: row.airlineId,
      name: carrier.name,
      step: row.step,
      text: nudgeText(row.airlineId, row.step, unmet.label),
      assignKind: target?.kind ?? null,
      assignRole: target?.role,
    })
    next.lastDay[row.airlineId] = today
    next.sent += 1
  }
  next.pending = still
  return next
}

export function silenceNudge(memory: NudgeMemory, airlineId: string, step: HubOfferTier): NudgeMemory {
  const id = stepKey(airlineId, step)
  return {
    ...memory,
    lastDay: { ...memory.lastDay },
    notedTier: { ...memory.notedTier },
    silenced: memory.silenced.includes(id) ? [...memory.silenced] : [...memory.silenced, id],
    pending: memory.pending.filter((row) => !(row.airlineId === airlineId && row.step === step)),
    inbox: memory.inbox.filter((row) => !(row.airlineId === airlineId && row.step === step)),
  }
}

export function dismissNudge(memory: NudgeMemory, cardId: string): NudgeMemory {
  return { ...memory, inbox: memory.inbox.filter((row) => row.id !== cardId) }
}

export function readNudgeMemory(raw: unknown): NudgeMemory {
  const empty = emptyNudgeMemory()
  if (!raw || typeof raw !== 'object') return empty
  const src = raw as Record<string, unknown>
  const lastDay: Record<string, number> = {}
  if (src.lastDay && typeof src.lastDay === 'object') {
    for (const [id, value] of Object.entries(src.lastDay as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) lastDay[id] = Math.floor(value)
    }
  }
  const notedTier: Record<string, number> = {}
  if (src.notedTier && typeof src.notedTier === 'object') {
    for (const [id, value] of Object.entries(src.notedTier as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) notedTier[id] = Math.floor(value)
    }
  }
  const silenced = Array.isArray(src.silenced) ? src.silenced.filter((row): row is string => typeof row === 'string') : []
  const pending: NudgeMemory['pending'] = []
  if (Array.isArray(src.pending)) {
    for (const row of src.pending) {
      if (!row || typeof row !== 'object') continue
      const airlineId = (row as { airlineId?: unknown }).airlineId
      const step = (row as { step?: unknown }).step
      if (typeof airlineId === 'string' && typeof step === 'string' && isStep(step)) pending.push({ airlineId, step })
    }
  }
  const inbox: NudgeCard[] = []
  if (Array.isArray(src.inbox)) {
    for (const row of src.inbox) {
      if (!row || typeof row !== 'object') continue
      const srcRow = row as Record<string, unknown>
      const id = typeof srcRow.id === 'string' ? srcRow.id : ''
      const airlineId = typeof srcRow.airlineId === 'string' ? srcRow.airlineId : ''
      const name = typeof srcRow.name === 'string' ? srcRow.name : airlineId
      const step = srcRow.step
      const text = typeof srcRow.text === 'string' ? srcRow.text : ''
      if (!id || !airlineId || !text || typeof step !== 'string' || !isStep(step)) continue
      const assignKind = typeof srcRow.assignKind === 'string' ? srcRow.assignKind : ''
      inbox.push({
        id,
        airlineId,
        name,
        step,
        text,
        assignKind: assignKind === 'desk' || assignKind === 'lane' || assignKind === 'gate' || assignKind === 'lounge' || assignKind === 'hangar' || assignKind === 'vehicle' ? assignKind : null,
      })
    }
  }
  return {
    lastDay,
    silenced,
    pending,
    notedTier,
    inbox,
    day: typeof src.day === 'number' && Number.isFinite(src.day) ? Math.floor(src.day) : -1,
    sent: typeof src.sent === 'number' && Number.isFinite(src.sent) ? Math.max(0, Math.floor(src.sent)) : 0,
  }
}
