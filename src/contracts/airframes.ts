import type { AirframeInfo, SizeClass } from './types.ts'
import { SIZE_ORDER } from './types.ts'

/** Default lookup; the game should pass its own AIRFRAMES-derived table. */
export const DEFAULT_AIRFRAMES: Record<string, AirframeInfo> = {
  atr72: { sizeClass: 'regional', mtowTonnes: 23, seats: 70 },
  e175: { sizeClass: 'regional', mtowTonnes: 40, seats: 80 },
  crj900: { sizeClass: 'regional', mtowTonnes: 38, seats: 90 },
  a320: { sizeClass: 'narrow', mtowTonnes: 78, seats: 180 },
  a321: { sizeClass: 'narrow', mtowTonnes: 93, seats: 220 },
  b737_800: { sizeClass: 'narrow', mtowTonnes: 79, seats: 189 },
  b757: { sizeClass: 'narrow', mtowTonnes: 116, seats: 200 },
  a330: { sizeClass: 'wide', mtowTonnes: 242, seats: 290 },
  a350: { sizeClass: 'wide', mtowTonnes: 280, seats: 325 },
  b777: { sizeClass: 'wide', mtowTonnes: 351, seats: 396 },
  b787: { sizeClass: 'wide', mtowTonnes: 254, seats: 296 },
  b747: { sizeClass: 'super', mtowTonnes: 448, seats: 410 },
  a380: { sizeClass: 'super', mtowTonnes: 575, seats: 525 },
}

/** Typical minimum turnaround (MTT) in minutes by class (design doc §2). */
export const DEFAULT_MTT: Record<SizeClass, number> = { regional: 30, narrow: 40, wide: 75, super: 105 }

/** Jet bridge count per stand class (PR #6). */
export const BRIDGES_BY_CLASS: Record<SizeClass, number> = { regional: 1, narrow: 1, wide: 2, super: 3 }

export function classRank(c: SizeClass): number {
  return SIZE_ORDER.indexOf(c)
}

/** A stand of class `stand` can take an aircraft of class `aircraft`. */
export function standFits(stand: SizeClass, aircraft: SizeClass): boolean {
  return classRank(stand) >= classRank(aircraft)
}

export function airframeInfo(table: Record<string, AirframeInfo>, id: string): AirframeInfo {
  const info = table[id]
  if (!info) throw new Error(`unknown airframe "${id}"`)
  return info
}
