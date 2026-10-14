/**
 * Placement collision for the playable terminal.
 * A wall fills its cell. A belt fills its cell. Nothing else may share either.
 */
import { itemDef, type ItemDef, type PlacedItem } from '../game/terminal.ts'

export type Footprint = 'open' | 'wall' | 'belt'

export function footprintOf(def: ItemDef | undefined): Footprint {
  return def?.footprint ?? 'open'
}

/** Cells a passenger cannot walk and a builder cannot stamp. */
export function blockedCellKeys(items: readonly { def: string; c: number; r: number }[]): Set<string> {
  const out = new Set<string>()
  for (const it of items) {
    const fp = footprintOf(itemDef(it.def))
    if (fp === 'wall' || fp === 'belt') out.add(`${it.c},${it.r}`)
  }
  return out
}

/**
 * Why this cell rejects the item. Null means the shell is clear.
 * Checked before the slot count so a wall reads as a wall, not a full cell.
 */
export function collisionReason(
  items: readonly PlacedItem[],
  def: ItemDef,
  c: number,
  r: number,
): string | null {
  const here = items.filter((it) => it.c === c && it.r === r)
  for (const it of here) {
    const fp = footprintOf(itemDef(it.def))
    if (fp === 'wall') return 'On a wall'
    if (fp === 'belt') return 'On a bag belt'
  }
  const mine = footprintOf(def)
  if ((mine === 'wall' || mine === 'belt') && here.length > 0) return 'Cell is occupied'
  return null
}
