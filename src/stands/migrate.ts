import type { StandAccess, StandClass } from '../game/types.ts'
import { FITTINGS, parseHostKey } from './catalog.ts'
import type { Fitting, FittingId, StandRung, StandSize } from './types.ts'

export interface LegacyStand {
  cls?: StandClass
  scale?: 'small' | 'wide' | 'jumbo'
  /** Missing means the old proximity rule may still call it a jetway. */
  access?: StandAccess
  /** Hall within jetway range, used only when access was never stored. */
  hallNear?: boolean
}

export interface MigratedStand {
  size: StandSize
  rung: StandRung
  jetBridge: boolean
}

/**
 * Old class and scale become a size and a rung that accepts the same letter.
 * S is light concrete. M is narrow concrete. Wide L is the widebody slab.
 * An L stand with no scale stays the heavy slab, which is today's code F.
 */
export function migrateStand(legacy: LegacyStand): MigratedStand {
  const cls = legacy.cls ?? 'M'
  const jetBridge = legacy.access === 'jetway' || (legacy.access == null && legacy.hallNear === true)
  if (cls === 'S') return { size: 'light', rung: 1, jetBridge }
  if (cls === 'L') {
    if (legacy.scale === 'wide') return { size: 'heavy', rung: 1, jetBridge }
    return { size: 'heavy', rung: 2, jetBridge }
  }
  return { size: 'narrow', rung: 1, jetBridge }
}

/** A bought bridge for an old jetway. No grant flag, so a later remove refunds it. */
export function legacyFitting(migrated: MigratedStand): Fitting | null {
  if (!migrated.jetBridge) return null
  return { id: 'jet_bridge' }
}

const SIZES = new Set<StandSize>(['light', 'narrow', 'heavy'])
const RUNGS = new Set<StandRung>([0, 1, 2])
const KNOWN = new Set<FittingId>(FITTINGS.map((row) => row.id))

export function readStandSizes(raw: unknown): Record<string, StandSize> {
  const out: Record<string, StandSize> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (SIZES.has(value as StandSize)) out[key] = value as StandSize
  }
  return out
}

export function readStandRungs(raw: unknown): Record<string, StandRung> {
  const out: Record<string, StandRung> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (RUNGS.has(value as StandRung)) out[key] = value as StandRung
  }
  return out
}

/** Drop unknown hosts and unknown ids. A missing map stays empty. */
export function readFittings(raw: unknown): Record<string, Fitting[]> {
  const out: Record<string, Fitting[]> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!parseHostKey(key) || !Array.isArray(list)) continue
    const clean: Fitting[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'string' || !KNOWN.has(id as FittingId)) continue
      const granted = (item as { granted?: unknown }).granted === 'legacy'
      clean.push(granted ? { id: id as FittingId, granted: 'legacy' } : { id: id as FittingId })
    }
    if (clean.length) out[key] = clean
  }
  return out
}
