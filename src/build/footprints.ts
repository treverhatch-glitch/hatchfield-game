/**
 * Real-world building lots. One grid cell is 22 m. Each building keeps its single
 * anchor tile (so sim rules, routing and saves are unchanged), and reserves a lot of
 * w×d cells that extends AWAY from its access side (road / pavement edge). The lot
 * holds the building plus its vehicle lanes, docks and turning room.
 *
 * Older saves have no lot records: those buildings are grandfathered at 1×1.
 */
import type { SizeTier } from '../scale/types'
import type { Tile, Vec } from '../game/types'

export const METERS_PER_CELL = 22

export interface LotSize {
  /** Cells across the access face. */
  w: number
  /** Cells deep, away from the access face (anchor row included). */
  d: number
  /** Why this size, in metres. */
  why: string
}

/** Lot per tile (hangars by tier). Links, paths and kiosks stay 1×1. */
export const LOT_SIZE: Partial<Record<Tile, LotSize>> = {
  fuel: { w: 3, d: 3, why: '2 tanks Ø30 m inside a bund + 8 m truck loop (66×66 m)' },
  cargo: { w: 3, d: 2, why: '60×30 m shed + 14 m truck court with docks (66×44 m)' },
  nighthub: { w: 4, d: 3, why: '80×45 m sort hub + ULD dolly lanes (88×66 m)' },
  fire: { w: 2, d: 2, why: '3 crash-tender bays + 14 m tender apron (44×44 m)' },
  kitchen: { w: 2, d: 2, why: 'flight kitchen + high-loader docks + turning (44×44 m)' },
  depot: { w: 2, d: 2, why: 'GSE canopy for ~12 vehicles + fuel island (44×44 m)' },
  bags: { w: 2, d: 2, why: 'sort hall + tug-and-dolly lanes (44×44 m)' },
  hotel: { w: 2, d: 2, why: '250-room block + porte-cochère (44×44 m)' },
  park_s: { w: 2, d: 2, why: '~60 surface bays with aisles (44×44 m)' },
  park_l: { w: 3, d: 3, why: '~150 surface bays with aisles (66×66 m)' },
  park_g: { w: 3, d: 2, why: '4-deck garage 60×40 m + ramps (66×44 m)' },
  park_u: { w: 2, d: 2, why: 'ramp portal + landscaped deck (44×44 m)' },
  bus: { w: 2, d: 1, why: '2-bay coach curb, 12 m coaches (44×22 m)' },
  rail: { w: 3, d: 1, why: 'island platform for a 60 m train set (66×22 m)' },
  termbus: { w: 2, d: 2, why: 'apron bus garage + charging (44×44 m)' },
  xferbus: { w: 2, d: 2, why: 'transfer-bus garage + boarding island (44×44 m)' },
  helipad: { w: 2, d: 2, why: 'FATO + safety area for a 20 m helicopter (44×44 m)' },
  deice: { w: 3, d: 3, why: 'narrowbody de-ice bay with boom trucks either side (66×66 m)' },
  fuel_rail: { w: 3, d: 1, why: 'tank-wagon siding + loading gantry (66×22 m)' },
}

export const HANGAR_LOT: Record<SizeTier, LotSize> = {
  small: { w: 3, d: 3, why: 'narrowbody bay: 36 m span + door apron (66×66 m)' },
  wide: { w: 4, d: 4, why: '787/A350 bay: 65 m span + tail dock (88×88 m)' },
  jumbo: { w: 5, d: 5, why: 'A380/747-8 bay: 80 m span, 25 m tail (110×110 m)' },
}

/** Lot for a tile / hangar tier; null = single cell. */
export function lotSize(tile: Tile, hangarTier?: SizeTier | null): LotSize | null {
  if (tile === 'hangar') return HANGAR_LOT[hangarTier ?? 'small']
  return LOT_SIZE[tile] ?? null
}

/** Placed lot: size, and the access direction (unit step from anchor to its access cell). */
export interface Lot {
  w: number
  d: number
  /** Access direction, e.g. {c:0,r:1} = access is south of the anchor; lot grows north. */
  dir: Vec
}

const DIRS: readonly Vec[] = [
  { c: 0, r: 1 },
  { c: 1, r: 0 },
  { c: 0, r: -1 },
  { c: -1, r: 0 },
]

/** Cells of a lot, anchor first. Width is centred on the anchor (extra cell to the right of the face). */
export function lotCells(anchor: Vec, lot: Lot): Vec[] {
  const back = { c: -lot.dir.c, r: -lot.dir.r }
  const across = { c: -lot.dir.r, r: lot.dir.c }
  const lo = -Math.floor((lot.w - 1) / 2)
  const out: Vec[] = [anchor]
  for (let k = 0; k < lot.d; k++) {
    for (let a = lo; a < lo + lot.w; a++) {
      if (k === 0 && a === 0) continue
      out.push({ c: anchor.c + back.c * k + across.c * a, r: anchor.r + back.r * k + across.r * a })
    }
  }
  return out
}

/** Lot centre in cell units relative to the anchor, and model yaw so its front faces the access side. */
export function lotFrame(lot: Lot): { dc: number; dr: number; yaw: number; scale: number } {
  const back = { c: -lot.dir.c, r: -lot.dir.r }
  const across = { c: -lot.dir.r, r: lot.dir.c }
  const lo = -Math.floor((lot.w - 1) / 2)
  const midA = lo + (lot.w - 1) / 2
  const midK = (lot.d - 1) / 2
  // Model front is +z (= +r). yaw maps +z onto dir.
  const yaw = Math.atan2(lot.dir.c, lot.dir.r)
  return {
    dc: back.c * midK + across.c * midA,
    dr: back.r * midK + across.r * midA,
    yaw,
    scale: Math.min(lot.w, lot.d),
  }
}

export interface LotQuery {
  inBounds(v: Vec): boolean
  /** Cell is free grass, not a site, not inside another lot. */
  free(v: Vec): boolean
  /** Access predicate for the cell in front of the anchor (null = no requirement). */
  access?: ((v: Vec) => boolean) | null
  /** Preferred directions first (e.g. camera facing). */
  prefer?: readonly Vec[]
}

/** Pick the first orientation whose whole lot is free and whose front cell satisfies access. */
export function chooseLot(anchor: Vec, size: { w: number; d: number }, q: LotQuery): Lot | null {
  const order = [...(q.prefer ?? []), ...DIRS]
  const seen = new Set<string>()
  for (const dir of order) {
    const k = `${dir.c},${dir.r}`
    if (seen.has(k)) continue
    seen.add(k)
    const lot = { w: size.w, d: size.d, dir }
    const front = { c: anchor.c + dir.c, r: anchor.r + dir.r }
    if (q.access && !q.access(front)) continue
    const cells = lotCells(anchor, lot)
    if (cells.every((p) => q.inBounds(p) && q.free(p))) return lot
  }
  return null
}

/** Footprint area in m² (for UI/tests). */
export function lotArea(lot: { w: number; d: number }): number {
  return lot.w * lot.d * METERS_PER_CELL * METERS_PER_CELL
}
