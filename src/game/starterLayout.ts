/**
 * Deterministic starter kits. One fixed stamp per start focus.
 * Passenger and hybrid share the hall and two concrete stands; hybrid adds a police post.
 * Cargo has no passenger hall. None of them is random. No kit fits a jet bridge.
 */
import type { StandRung, StandSize } from '../stands/types.ts'
import type { StandAccess, StandClass, StartFocus, Tile, Vec } from './types'
import { SIZE } from './types'

export interface StarterStand {
  c: number
  r: number
  cls: StandClass
  access: StandAccess
  size: StandSize
  rung: StandRung
}

export interface StarterKitPreview {
  focus: StartFocus
  /** Shown on the start menu and on the stamp button. */
  label: string
  summary: string
  includes: string[]
}

export interface StarterStamp {
  focus: StartFocus
  label: string
  summary: string
  terminal: Vec | null
  stands: StarterStand[]
}

export const STARTER_KITS: Record<StartFocus, StarterKitPreview> = {
  pax: {
    focus: 'pax',
    label: 'Passenger-focused starter kit',
    summary: 'Hall curb on the public road, two concrete stands facing the gates, one runway linked by taxiway.',
    includes: [
      'One 14×2 runway with a clearance shoulder',
      'Taxiway linking the strip to the stands, plus two exits',
      'Terminal rotated so the curb faces the road and the gates face the stands',
      'Staffed check-in desk, self-service kiosk, and spare desk cells',
      'Two security lanes, with empty lane cells beside them',
      'Gate seats, café counter, newsagent, toilets, claim belt, and wayfinding',
      'Two concrete stands, bag-sort bays, fuel bays, guard, and a cargo shed',
    ],
  },
  cargo: {
    focus: 'cargo',
    label: 'Cargo-focused starter kit',
    summary: 'Freighter stand, guard, and shed on the city road. One runway. No passenger hall.',
    includes: [
      'One 14×2 runway with a clearance shoulder',
      'Taxiway to one remote freighter stand, plus two exits',
      'Guard post and cargo shed',
      'No passenger terminal',
    ],
  },
  hybrid: {
    focus: 'hybrid',
    label: 'Hybrid starter kit',
    summary: 'Passenger hall and two concrete stands, plus a police post on the freight road. Day passengers, night freight.',
    includes: [
      'Passenger hall, curb, and two concrete stands',
      'Same hall as the passenger kit: desks, kiosk, lanes, shop, claim, wayfinding',
      'Guard, cargo shed, and a police post',
      'One runway with a taxiway to the stands and two exits',
      'Landside road stays off the hall footprint',
    ],
  },
}

/** East face of the passenger hall. The public road sits on this column. */
export const PAX_ROAD_COL = 17
/**
 * 2×4 hall origin (44 m east-west, 88 m north-south).
 * The long side faces the apron on the west. The east face sits on the road.
 */
export const PAX_TERMINAL: Vec = { c: 15, r: 7 }

type Chart = Map<string, Tile>

function put(chart: Chart, c: number, r: number, tile: Tile) {
  if (c < 0 || r < 0 || c >= SIZE || r >= SIZE) {
    throw new Error(`starter kit cell ${c},${r} is off the map`)
  }
  const key = `${c},${r}`
  const prev = chart.get(key)
  if (prev && prev !== tile) {
    throw new Error(`starter kit overlap at ${key}: ${prev} then ${tile}`)
  }
  chart.set(key, tile)
}

/** One 14×2 east-west strip (the regional prefab at c8,r26) with a taxi to the apron. */
function paintRunways(putAt: (c: number, r: number, tile: Tile) => void) {
  for (let c = 8; c <= 21; c++) {
    putAt(c, 26, 'runway')
    putAt(c, 27, 'runway')
  }
  // Spine just west of the threshold, from the apron to the strip.
  for (let r = 6; r <= 27; r++) putAt(7, r, 'taxi')
  // Mid-strip exit along the north edge of the strip. Row 24 stays grass:
  // the clearance tests place a shoulder taxi there. This row touches the
  // pavement, so an arrival can leave without rolling to the far threshold.
  for (let c = 8; c <= 15; c++) putAt(c, 25, 'taxi')
  // Second exit on the south shoulder, tied to the west spine. Lineup stays
  // on the threshold. An arrival can clear on this taxi when the north exit is busy.
  putAt(7, 28, 'taxi')
  for (let c = 8; c <= 21; c++) putAt(c, 28, 'taxi')
}

function paintPassenger(chart: Chart, police: boolean) {
  const putAt = (c: number, r: number, tile: Tile) => put(chart, c, r, tile)
  paintRunways(putAt)
  // Apron on the west face. The stands stay a full bay apart so both can
  // taxi while the 2×4 hall occupies the curb.
  for (const c of [11, 12, 13]) putAt(c, 9, 'taxi')
  for (let c = 8; c <= 10; c++) {
    putAt(c, 6, 'taxi')
    putAt(c, 12, 'taxi')
  }
  putAt(11, 6, 'stand')
  putAt(11, 12, 'stand')
  for (let r = 7; r <= 10; r++) {
    for (let c = 15; c <= 16; c++) putAt(c, r, 'terminal')
  }
  // Public road on the east face. It meets the curb and does not enter the hall.
  for (let r = 0; r <= 12; r++) {
    if (r === 2) continue
    putAt(PAX_ROAD_COL, r, 'road')
  }
  putAt(PAX_ROAD_COL, 2, 'guard')
  // North and south bypasses so trucks reach the apron without crossing the hall.
  for (let c = 7; c <= 16; c++) putAt(c, 4, 'road')
  for (let c = 8; c <= 16; c++) putAt(c, 14, 'road')
  putAt(PAX_ROAD_COL, 14, 'road')
  // Belts reach the 2-wide hall. Column 14 is the gap the old 3-wide hall filled.
  putAt(11, 7, 'belt')
  putAt(11, 8, 'belt')
  putAt(12, 8, 'belt')
  putAt(13, 8, 'belt')
  putAt(14, 8, 'belt')
  putAt(12, 12, 'belt')
  putAt(13, 12, 'belt')
  putAt(13, 11, 'belt')
  putAt(13, 10, 'belt')
  putAt(14, 10, 'belt')
  // East of the south stand's wing. (12,13) sat inside that 3×3 envelope.
  putAt(13, 13, 'bags')
  putAt(7, 5, 'fuel')
  putAt(18, 4, 'road')
  putAt(19, 4, 'cargo')
  putAt(19, 8, 'fire')
  putAt(19, 10, 'tower')
  putAt(19, 13, 'snack')
  if (police) putAt(20, 5, 'police')
}

function paintCargo(chart: Chart) {
  const putAt = (c: number, r: number, tile: Tile) => put(chart, c, r, tile)
  paintRunways(putAt)
  for (let c = 8; c <= 11; c++) putAt(c, 10, 'taxi')
  putAt(12, 10, 'stand')
  for (let r = 0; r <= 12; r++) {
    if (r === 2) continue
    putAt(PAX_ROAD_COL, r, 'road')
  }
  putAt(PAX_ROAD_COL, 2, 'guard')
  for (let c = 13; c <= 16; c++) putAt(c, 10, 'road')
  putAt(PAX_ROAD_COL, 10, 'road')
  putAt(6, 10, 'fuel')
  putAt(18, 5, 'road')
  putAt(19, 5, 'cargo')
  putAt(19, 8, 'fire')
  putAt(19, 11, 'police')
  putAt(19, 14, 'tower')
}

function chartFor(focus: StartFocus): Chart {
  const chart: Chart = new Map()
  if (focus === 'cargo') paintCargo(chart)
  else paintPassenger(chart, focus === 'hybrid')
  return chart
}

export function starterKitPreview(focus: StartFocus): StarterKitPreview {
  return STARTER_KITS[focus]
}

/** Writes the kit onto a grass field. The same focus always writes the same cells. */
export function stampStarterKit(tiles: Tile[][], focus: StartFocus): StarterStamp {
  const preview = STARTER_KITS[focus]
  const chart = chartFor(focus)
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = chart.get(`${c},${r}`)
      if (tile) tiles[r][c] = tile
    }
  }
  if (focus === 'cargo') {
    return {
      focus,
      label: preview.label,
      summary: preview.summary,
      terminal: null,
      // Large: the feeder freighter is a 757 (code D). Heavy slab (code F) still takes it.
      stands: [{ c: 12, r: 10, cls: 'L', access: 'remote', size: 'heavy', rung: 2 }],
    }
  }
  return {
    focus,
    label: preview.label,
    summary: preview.summary,
    terminal: { ...PAX_TERMINAL },
    stands: [
      { c: 11, r: 6, cls: 'M', access: 'remote', size: 'narrow', rung: 1 },
      { c: 11, r: 12, cls: 'M', access: 'remote', size: 'narrow', rung: 1 },
    ],
  }
}
