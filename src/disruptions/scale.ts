import {
  CHANCE_AT_MASTERY,
  CHANCE_AT_MID,
  CHANCE_ENDLESS,
  FEE_FLOOR,
  MASTERY_LEVEL,
  MID_GAME_LEVEL,
  STAFF_SCALE_FLOOR,
} from './data.ts'
import type { DisruptionWorld } from './types.ts'

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return v < lo ? lo : v > hi ? hi : v
}

/** 0 at the mid-game gate, 1 at mastery. Endless does not push this past 1. */
export function severityOf(level: number): number {
  if (!Number.isFinite(level) || level < MID_GAME_LEVEL) return 0
  return clamp((level - MID_GAME_LEVEL) / (MASTERY_LEVEL - MID_GAME_LEVEL), 0, 1)
}

export function levelOf(world: DisruptionWorld): number {
  if (!Number.isFinite(world.fieldLevel)) return 0
  return Math.floor(world.fieldLevel)
}

/** Early game and a finished campaign with endless off both stay quiet. */
export function eligible(world: DisruptionWorld): boolean {
  if (levelOf(world) < MID_GAME_LEVEL) return false
  if (world.goalsComplete && !world.endless) return false
  return true
}

export function dailyChance(world: DisruptionWorld): number {
  if (!eligible(world)) return 0
  const severity = severityOf(levelOf(world))
  const chance = CHANCE_AT_MID + (CHANCE_AT_MASTERY - CHANCE_AT_MID) * severity
  if (world.endless && world.goalsComplete) return Math.min(CHANCE_ENDLESS, Math.max(chance, CHANCE_ENDLESS))
  return chance
}

/** Fraction of the struck pool still working. Never zero. */
export function strikeScale(severity: number): number {
  const n = 0.72 - clamp(severity, 0, 1) * 0.3
  return clamp(n, STAFF_SCALE_FLOOR, 0.9)
}

/** Manual check-in is slower and still finishes. */
export function manualCheckIn(severity: number): number {
  return 1.7 + clamp(severity, 0, 1) * 1.3
}

/** Extra screening step. Lanes stay open. */
export function screeningLoad(severity: number): number {
  return 1.4 + clamp(severity, 0, 1) * 0.8
}

/**
 * Fee multiplier under a price war.
 * A bound rival can push it down. The floor holds even if their index is NaN or tiny.
 */
export function feePressure(severity: number, rivalIndex: number | null): number {
  const internal = 0.9 - clamp(severity, 0, 1) * 0.28
  const rival = rivalIndex != null && Number.isFinite(rivalIndex) ? rivalIndex : internal
  return clamp(Math.min(internal, rival), FEE_FLOOR, 1)
}

/** How long the crisis lasts, in days. It always ends. */
export function durationDays(kind: string, severity: number): number {
  const s = clamp(severity, 0, 1)
  if (kind === 'rival-price-war') return 2 + Math.round(s * 2)
  return 1 + Math.round(s)
}
