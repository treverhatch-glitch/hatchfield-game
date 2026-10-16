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
/** 3×3 hall origin. Airside is west, toward the stands. */
export const PAX_TERMINAL: Vec = { c: 14, r: 8 }

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
  // Apron on the west face of the hall so the gates read as the airside.
  // The centre cell of that face is the bag sort, so the corners stay taxi.
  putAt(11, 9, 'taxi')
  putAt(13, 8, 'taxi')
  putAt(13, 10, 'taxi')
  for (let c = 8; c <= 10; c++) {
    putAt(c, 6, 'taxi')
    putAt(c, 12, 'taxi')
  }
  putAt(11, 6, 'stand')
  putAt(11, 12, 'stand')
  for (let r = 8; r <= 10; r++) {
    for (let c = 14; c <= 16; c++) putAt(c, r, 'terminal')
  }
  // Public road on the east face. Continuous, so drop-off never enters the guard.
  for (let r = 0; r <= 12; r++) putAt(PAX_ROAD_COL, r, 'road')
  // North service road. The guard is the only cell joining it to the public road.
  for (let c = 7; c <= 15; c++) putAt(c, 4, 'road')
  putAt(16, 4, 'guard')
  // South apron road. It meets the taxi spine, not column 17, so it is not a second gate.
  for (let c = 8; c <= 16; c++) putAt(c, 14, 'road')
  // One belt beside the sort, out to both stands. No belt cell touches the hall.
  putAt(11, 7, 'belt')
  putAt(11, 8, 'belt')
  putAt(12, 8, 'belt')
  putAt(12, 9, 'belt')
  putAt(12, 10, 'belt')
  putAt(12, 11, 'belt')
  putAt(12, 12, 'belt')
  // Against the west facade. The mesh yaws so the bays face the apron.
  putAt(13, 9, 'bags')
  putAt(7, 5, 'fuel')
  putAt(15, 3, 'cargo')
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
  for (let r = 0; r <= 12; r++) putAt(PAX_ROAD_COL, r, 'road')
  for (let c = 13; c <= 15; c++) putAt(c, 10, 'road')
  putAt(16, 10, 'guard')
  putAt(15, 9, 'cargo')
  putAt(6, 10, 'fuel')
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
