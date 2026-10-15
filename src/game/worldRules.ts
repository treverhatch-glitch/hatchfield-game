/**
 * Placement and world-consistency rules for the apron.
 * Roads, taxiways, buildings, stands, and runway clearances may not occupy
 * the same ground. The build ghost asks `placementReason`. CI asks `auditWorld`
 * for a whole map.
 */
import { footprintBlock, footprintCells as buildingCells } from './buildingFootprint'
import { clearanceBlocks, clearanceRect, runwayBoxes, type RunwayBox } from './runwayClearance'
import { type IcaoCode } from '../render/aircraft/stands'
import {
  WING_CLEAR_TILES,
  footprintCells as standFootprint,
  footprintCellsForLetter,
  placementHitsStand,
  standPlaceBlock,
} from './standFoot'
import { LOS_BLOCK_TILES, SOLID_TILES, tileLabel } from './worldRulesData'
import { inBounds } from './path'
import type { StandClass, Tile, Vec } from './types'

export type WorldRule = 'overlap' | 'junction' | 'wingtip' | 'runway-strip' | 'resa' | 'tower-los'

export interface WorldViolation {
  rule: WorldRule
  c: number
  r: number
  /** Map scan wording, with the cell. */
  message: string
  /** Build-ghost wording. */
  placeMessage: string
}

export type StandScale = 'small' | 'wide' | 'jumbo'

export interface PendingStamp {
  cells: Vec[]
  tile: Tile
  standClass?: StandClass
  standScale?: StandScale
  standLetter?: IcaoCode
}

export interface Stamp {
  tile: Tile
  cells: Vec[]
  origin: Vec
  /** Tool label, used by the older footprint / clearance sentences. */
  name?: string
  standClass?: StandClass
  standScale?: StandScale | null
  standLetter?: IcaoCode
}

export interface AuditInput {
  tiles: Tile[][]
  standClass?: Record<string, StandClass>
  standScale?: Record<string, StandScale | undefined>
  standLetter?: Record<string, IcaoCode>
  /** In-progress sites count as the tile they will become. */
  pending?: PendingStamp[]
  /** Stamp under the cursor. Its claims stack on top of whatever is already there. */
  proposal?: Stamp
}

const SOLID = new Set<Tile>(SOLID_TILES)
const LOS_BLOCK = new Set<Tile>(LOS_BLOCK_TILES)
const CLEAR_ZONE_OK = new Set<Tile>(['grass', 'runway', 'taxi'])
const PAVEMENT = new Set<Tile>(['taxi', 'runway'])

interface Owner {
  id: string
  kind: 'solid' | 'road' | 'taxi' | 'runway' | 'stand' | 'wing'
  tile: Tile
  at: Vec
}

function keyOf(c: number, r: number): string {
  return `${c},${r}`
}

function sig(v: WorldViolation): string {
  return `${v.rule}@${v.c},${v.r}:${v.message}`
}

function pushOwner(map: Map<string, Owner[]>, cell: Vec, owner: Owner) {
  if (!inBounds(cell.c, cell.r)) return
  const key = keyOf(cell.c, cell.r)
  const list = map.get(key)
  if (list) list.push(owner)
  else map.set(key, [owner])
}

function tileAt(tiles: Tile[][], c: number, r: number): Tile | null {
  if (!inBounds(c, r)) return null
  return tiles[r]?.[c] ?? null
}

interface Surface {
  tiles: Tile[][]
  standClass: Record<string, StandClass>
  standScale: Record<string, StandScale | undefined>
  standLetter: Record<string, IcaoCode>
}

function workingSurface(input: AuditInput): Surface {
  const tiles = input.tiles.map((row) => row.slice())
  const standClass: Record<string, StandClass> = { ...(input.standClass ?? {}) }
  const standScale: Record<string, StandScale | undefined> = { ...(input.standScale ?? {}) }
  const standLetter: Record<string, IcaoCode> = { ...(input.standLetter ?? {}) }
  for (const site of input.pending ?? []) {
    for (const cell of site.cells) {
      if (!inBounds(cell.c, cell.r)) continue
      tiles[cell.r][cell.c] = site.tile
      if (site.tile === 'stand') {
        const key = keyOf(cell.c, cell.r)
        if (site.standClass) standClass[key] = site.standClass
        if (site.standScale) standScale[key] = site.standScale
        if (site.standLetter) standLetter[key] = site.standLetter
      }
    }
  }
  return { tiles, standClass, standScale, standLetter }
}

function paintProposal(surface: Surface, proposal: Stamp | undefined): Surface {
  if (!proposal) return surface
  const tiles = surface.tiles.map((row) => row.slice())
  const standClass = { ...surface.standClass }
  const standScale = { ...surface.standScale }
  const standLetter = { ...surface.standLetter }
  for (const cell of proposal.cells) {
    if (!inBounds(cell.c, cell.r)) continue
    tiles[cell.r][cell.c] = proposal.tile
  }
  if (proposal.tile === 'stand') {
    const key = keyOf(proposal.origin.c, proposal.origin.r)
    standClass[key] = proposal.standClass ?? 'M'
    if (proposal.standScale) standScale[key] = proposal.standScale
    if (proposal.standLetter) standLetter[key] = proposal.standLetter
  }
  return { tiles, standClass, standScale, standLetter }
}

function addTileOwners(
  map: Map<string, Owner[]>,
  tiles: Tile[][],
  standClass: Record<string, StandClass>,
  standScale: Record<string, StandScale | undefined>,
  standLetter: Record<string, IcaoCode>,
  idPrefix: string,
) {
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const tile = row[c]
      if (!tile || tile === 'grass') continue
      const id = `${idPrefix}${tile}@${c},${r}`
      const at = { c, r }
      if (tile === 'tower') {
        for (const cell of buildingCells('tower', at)) {
          pushOwner(map, cell, { id, kind: 'solid', tile, at })
        }
        continue
      }
      if (SOLID.has(tile)) {
        pushOwner(map, at, { id, kind: 'solid', tile, at })
        continue
      }
      if (tile === 'road') {
        pushOwner(map, at, { id, kind: 'road', tile, at })
        continue
      }
      if (tile === 'taxi') {
        pushOwner(map, at, { id, kind: 'taxi', tile, at })
        continue
      }
      if (tile === 'runway') {
        pushOwner(map, at, { id, kind: 'runway', tile, at })
        continue
      }
      if (tile === 'stand') {
        pushOwner(map, at, { id, kind: 'stand', tile, at })
        const letter = standLetter[keyOf(c, r)]
        const wing = letter
          ? footprintCellsForLetter(tiles, at, letter)
          : standFootprint(tiles, at, standClass[keyOf(c, r)] ?? 'M', standScale[keyOf(c, r)])
        for (const cell of wing) {
          if (cell.c === c && cell.r === r) continue
          pushOwner(map, cell, { id, kind: 'wing', tile: 'stand', at })
        }
      }
    }
  }
}

function addProposalOwners(map: Map<string, Owner[]>, surface: Surface, proposal: Stamp) {
  const id = 'proposal'
  const tile = proposal.tile
  if (tile === 'tower') {
    for (const cell of buildingCells('tower', proposal.origin)) {
      pushOwner(map, cell, { id, kind: 'solid', tile, at: proposal.origin })
    }
    return
  }
  if (tile === 'stand') {
    const at = proposal.origin
    pushOwner(map, at, { id, kind: 'stand', tile, at })
    const wing = proposal.standLetter
      ? footprintCellsForLetter(surface.tiles, at, proposal.standLetter)
      : standFootprint(surface.tiles, at, proposal.standClass ?? 'M', proposal.standScale)
    for (const cell of wing) {
      if (cell.c === at.c && cell.r === at.r) continue
      pushOwner(map, cell, { id, kind: 'wing', tile: 'stand', at })
    }
    return
  }
  const kind = tile === 'road' ? 'road' : tile === 'taxi' ? 'taxi' : tile === 'runway' ? 'runway' : SOLID.has(tile) ? 'solid' : null
  if (!kind) return
  for (const cell of proposal.cells) {
    pushOwner(map, cell, { id, kind, tile, at: proposal.origin })
  }
}

function noun(tile: Tile): string {
  return tileLabel(tile)
}

function overlapPlace(stamp: Tile, other: Tile): string {
  if (stamp === 'road' && other === 'tower') return 'That road cuts through the tower footprint.'
  if (stamp === 'road' && SOLID.has(other)) return `That road cuts through the ${noun(other)}.`
  if (stamp === 'taxi' && SOLID.has(other)) return `That taxiway cuts through the ${noun(other)}.`
  if (stamp === 'runway' && SOLID.has(other)) return `That runway cuts through the ${noun(other)}.`
  if (SOLID.has(stamp) && other === 'road') return `That ${noun(stamp)} overlaps a road.`
  if (SOLID.has(stamp) && other === 'taxi') return `That ${noun(stamp)} overlaps a taxiway.`
  if (SOLID.has(stamp) && other === 'runway') return `That ${noun(stamp)} overlaps the runway.`
  if (SOLID.has(stamp) && other === 'terminal') return `That ${noun(stamp)} overlaps the terminal.`
  return `That ${noun(stamp)} overlaps the ${noun(other)}.`
}

function overlapAudit(a: Owner, b: Owner): string {
  const left = a.kind === 'road' ? 'Road' : a.kind === 'taxi' ? 'Taxiway' : a.kind === 'runway' ? 'Runway' : noun(a.tile)
  const where = `${b.at.c},${b.at.r}`
  if (a.kind === 'road' && b.tile === 'tower') return `Road at ${a.at.c},${a.at.r} cuts through the tower footprint (${where}).`
  if (a.kind === 'road' && SOLID.has(b.tile)) return `Road at ${a.at.c},${a.at.r} cuts through the ${noun(b.tile)} at ${where}.`
  if (a.kind === 'taxi' && SOLID.has(b.tile)) return `Taxiway at ${a.at.c},${a.at.r} cuts through the ${noun(b.tile)} at ${where}.`
  return `${left} at ${a.at.c},${a.at.r} overlaps the ${noun(b.tile)} at ${where}.`
}

function zoneKind(boxes: RunwayBox[], c: number, r: number): 'strip' | 'resa' | null {
  for (const box of boxes) {
    const rect = clearanceRect(box)
    if (c < rect.minC || c > rect.maxC || r < rect.minR || r > rect.maxR) continue
    if (c >= box.minC && c <= box.maxC && r >= box.minR && r <= box.maxR) continue
    const pastEnd = box.axis === 'h' ? c < box.minC || c > box.maxC : r < box.minR || r > box.maxR
    return pastEnd ? 'resa' : 'strip'
  }
  return null
}

/** Pavement sandwiched between terminal cells, or sitting in a hole in the hall. */
function cutsTerminal(tiles: Tile[][], c: number, r: number): boolean {
  if (tileAt(tiles, c, r) === 'terminal') return false
  const north = tileAt(tiles, c, r - 1) === 'terminal'
  const south = tileAt(tiles, c, r + 1) === 'terminal'
  const east = tileAt(tiles, c + 1, r) === 'terminal'
  const west = tileAt(tiles, c - 1, r) === 'terminal'
  if ((north && south) || (east && west)) return true
  return enclosedBy(tiles, 'terminal', c, r)
}

/** A cell with the same tile strictly on both sides, on both axes, sits inside that building. */
function enclosedBy(tiles: Tile[][], tile: Tile, c: number, r: number): boolean {
  if (tileAt(tiles, c, r) === tile) return false
  let west = false
  let east = false
  let north = false
  let south = false
  const row = tiles[r]
  if (!row) return false
  for (let x = 0; x < c; x++) if (row[x] === tile) west = true
  for (let x = c + 1; x < row.length; x++) if (row[x] === tile) east = true
  for (let y = 0; y < r; y++) if (tiles[y]?.[c] === tile) north = true
  for (let y = r + 1; y < tiles.length; y++) if (tiles[y]?.[c] === tile) south = true
  return west && east && north && south
}

function oppositePavement(tiles: Tile[][], c: number, r: number): boolean {
  const n = tileAt(tiles, c, r - 1)
  const s = tileAt(tiles, c, r + 1)
  const e = tileAt(tiles, c + 1, r)
  const w = tileAt(tiles, c - 1, r)
  const pave = (t: Tile | null) => t != null && PAVEMENT.has(t)
  return (pave(n) && pave(s)) || (pave(e) && pave(w))
}

function legacyReason(surface: Surface, stamp: Stamp): string | null {
  const name = stamp.name ?? noun(stamp.tile)
  if (stamp.tile === 'runway' && clearanceBlocks(surface.tiles, stamp.cells, 'runway')) {
    return 'That strip sits inside runway clearance. Leave the shoulder empty.'
  }
  if (stamp.tile === 'stand') {
    const why = standPlaceBlock(
      surface.tiles,
      stamp.origin,
      stamp.standClass ?? 'M',
      stamp.standScale,
      surface.standClass,
      surface.standScale,
      stamp.standLetter,
      surface.standLetter,
    )
    if (why) return why
  }
  const foot = footprintBlock(surface.tiles, stamp.tile, stamp.origin)
  if (foot === 'road') return `${name} footprint crosses a road.`
  if (foot === 'edge') return `${name} footprint leaves the map.`
  if (stamp.tile !== 'stand' && clearanceBlocks(surface.tiles, stamp.cells, stamp.tile)) {
    return `${name} sits inside runway clearance. Taxiways can still cross.`
  }
  if (
    stamp.tile !== 'stand' &&
    placementHitsStand(
      surface.tiles,
      stamp.cells,
      stamp.tile,
      surface.standClass,
      surface.standScale,
      surface.standLetter,
    )
  ) {
    return `${name} sits inside a stand footprint.`
  }
  return null
}

/** Bresenham cells, plus both side cells when the step is diagonal, so a corner blocks the view. */
function sightCells(a: Vec, b: Vec): Vec[] {
  const out: Vec[] = [{ c: a.c, r: a.r }]
  const dx = Math.abs(b.c - a.c)
  const dy = Math.abs(b.r - a.r)
  const sx = a.c < b.c ? 1 : -1
  const sy = a.r < b.r ? 1 : -1
  let x = a.c
  let y = a.r
  let ix = 0
  let iy = 0
  while (ix < dx || iy < dy) {
    const decision = (1 + 2 * ix) * dy - (1 + 2 * iy) * dx
    if (decision === 0) {
      out.push({ c: x + sx, r: y }, { c: x, r: y + sy })
      x += sx
      y += sy
      ix++
      iy++
    } else if (decision < 0) {
      x += sx
      ix++
    } else {
      y += sy
      iy++
    }
    out.push({ c: x, r: y })
  }
  return out
}

function thresholdCells(box: RunwayBox): Vec[] {
  if (box.axis === 'h') {
    const r = box.minR
    return [
      { c: box.minC, r },
      { c: box.maxC, r },
    ]
  }
  const c = box.minC
  return [
    { c, r: box.minR },
    { c, r: box.maxR },
  ]
}

function towerOrigins(tiles: Tile[][]): Vec[] {
  const out: Vec[] = []
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) if (row[c] === 'tower') out.push({ c, r })
  }
  return out
}

function blocksSight(tiles: Tile[][], cell: Vec, tower: Vec): boolean {
  const tile = tileAt(tiles, cell.c, cell.r)
  if (!tile || !LOS_BLOCK.has(tile)) return false
  if (tile === 'tower') {
    const near = buildingCells('tower', tower).some((p) => p.c === cell.c && p.r === cell.r)
    if (near) return false
  }
  return true
}

/**
 * Every runway threshold must be visible from at least one tower cab.
 * No tower means the rule is not in play.
 */
function lineOfSight(tiles: Tile[][], proposal: Stamp | undefined): WorldViolation[] {
  const towers = towerOrigins(tiles)
  if (!towers.length) return []
  const out: WorldViolation[] = []
  for (const box of runwayBoxes(tiles)) {
    for (const end of thresholdCells(box)) {
      let open = false
      let blocker: { tower: Vec; cell: Vec; tile: Tile } | null = null
      for (const tower of towers) {
        let hit: Vec | null = null
        for (const cell of sightCells(tower, end)) {
          if (cell.c === end.c && cell.r === end.r) break
          if (blocksSight(tiles, cell, tower)) {
            hit = cell
            break
          }
        }
        if (!hit) {
          open = true
          break
        }
        const tile = tileAt(tiles, hit.c, hit.r)
        if (tile && !blocker) blocker = { tower, cell: hit, tile }
      }
      if (open || !blocker) continue
      const placingBlocker = proposal != null && proposal.tile === blocker.tile && proposal.cells.some((p) => p.c === blocker.cell.c && p.r === blocker.cell.r)
      const placingTower = proposal?.tile === 'tower' && towers.some((t) => t.c === proposal.origin.c && t.r === proposal.origin.r)
      out.push({
        rule: 'tower-los',
        c: blocker.cell.c,
        r: blocker.cell.r,
        message: `Tower at ${blocker.tower.c},${blocker.tower.r} cannot see runway threshold ${end.c},${end.r}. The ${noun(blocker.tile)} at ${blocker.cell.c},${blocker.cell.r} blocks the line of sight.`,
        placeMessage: placingTower
          ? 'That tower cannot see a runway threshold.'
          : placingBlocker
            ? `That ${noun(blocker.tile)} blocks the tower's view of the runway.`
            : `The ${noun(blocker.tile)} blocks the tower's view of the runway.`,
      })
    }
  }
  return out
}

function scan(input: AuditInput): WorldViolation[] {
  const base = workingSurface(input)
  const view = paintProposal(base, input.proposal)
  const owners = new Map<string, Owner[]>()
  addTileOwners(owners, base.tiles, base.standClass, base.standScale, base.standLetter, '')
  if (input.proposal) addProposalOwners(owners, base, input.proposal)
  const out: WorldViolation[] = []
  const seen = new Set<string>()

  for (const [key, list] of owners) {
    const [c, r] = key.split(',').map(Number)
    const solids = list.filter((o) => o.kind === 'solid')
    const wings = list.filter((o) => o.kind === 'wing')
    const rest = list.filter((o) => o.kind !== 'solid' && o.kind !== 'wing')

    for (const wing of wings) {
      for (const solid of solids) {
        if (WING_CLEAR_TILES.has(solid.tile)) continue
        const message = `${noun(solid.tile)} at ${solid.at.c},${solid.at.r} sits inside the wingtip clearance of the stand at ${wing.at.c},${wing.at.r}.`
        const row: WorldViolation = {
          rule: 'wingtip',
          c,
          r,
          message,
          placeMessage:
            input.proposal?.tile === 'stand'
              ? 'That stand overlaps a building.'
              : `${input.proposal?.name ?? noun(solid.tile)} sits inside a stand footprint.`,
        }
        const mark = sig(row)
        if (!seen.has(mark)) {
          seen.add(mark)
          out.push(row)
        }
      }
    }

    const bodies = [...solids, ...rest]
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]
        if (a.id === b.id) continue
        const leftSolid = a.kind === 'solid'
        const rightSolid = b.kind === 'solid'
        const leftPave = a.kind === 'road' || a.kind === 'taxi' || a.kind === 'runway' || a.kind === 'stand'
        const rightPave = b.kind === 'road' || b.kind === 'taxi' || b.kind === 'runway' || b.kind === 'stand'
        const bothSolid = leftSolid && rightSolid
        const solidAndPave = (leftSolid && rightPave) || (rightSolid && leftPave)
        const paveClash =
          (a.kind === 'road' && (b.kind === 'taxi' || b.kind === 'runway' || b.kind === 'stand')) ||
          (b.kind === 'road' && (a.kind === 'taxi' || a.kind === 'runway' || a.kind === 'stand')) ||
          (a.kind === 'taxi' && (b.kind === 'stand')) ||
          (b.kind === 'taxi' && (a.kind === 'stand'))
        if (!bothSolid && !solidAndPave && !paveClash) continue
        // A road sandwiched in a taxiway is a junction, reported below, not a second overlap.
        if (
          (a.kind === 'road' || b.kind === 'road') &&
          (a.kind === 'taxi' || b.kind === 'taxi' || a.kind === 'runway' || b.kind === 'runway') &&
          oppositePavement(view.tiles, c, r)
        ) {
          continue
        }
        const stampSide = a.id === 'proposal' ? a : b.id === 'proposal' ? b : a
        const otherSide = stampSide === a ? b : a
        const row: WorldViolation = {
          rule: 'overlap',
          c,
          r,
          message: overlapAudit(a.kind === 'road' || a.kind === 'taxi' ? a : b, a.kind === 'road' || a.kind === 'taxi' ? b : a),
          placeMessage: overlapPlace(stampSide.tile, otherSide.tile),
        }
        const mark = sig(row)
        if (!seen.has(mark)) {
          seen.add(mark)
          out.push(row)
        }
      }
    }
  }

  for (let r = 0; r < view.tiles.length; r++) {
    const row = view.tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'road' && row[c] !== 'taxi' && row[c] !== 'runway' && row[c] !== 'stand') continue
      if (!cutsTerminal(view.tiles, c, r)) continue
      const tile = row[c]
      const violation: WorldViolation = {
        rule: 'overlap',
        c,
        r,
        message: `${noun(tile)} at ${c},${r} cuts through the terminal.`,
        placeMessage:
          tile === 'road'
            ? 'That road cuts through the terminal.'
            : `That ${noun(tile)} cuts through the terminal.`,
      }
      const mark = sig(violation)
      if (!seen.has(mark)) {
        seen.add(mark)
        out.push(violation)
      }
    }
  }

  for (let r = 0; r < view.tiles.length; r++) {
    const row = view.tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'road') continue
      if (!oppositePavement(view.tiles, c, r)) continue
      out.push({
        rule: 'junction',
        c,
        r,
        message: `Road at ${c},${r} crosses the taxiway without a junction.`,
        placeMessage: 'That road crosses the taxiway without a junction. Leave the taxiway paved so aircraft can cross.',
      })
    }
  }

  const boxes = runwayBoxes(view.tiles)
  for (let r = 0; r < view.tiles.length; r++) {
    const row = view.tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'stand') continue
      const at = { c, r }
      const marked = view.standLetter[keyOf(c, r)]
      const wing = marked
        ? footprintCellsForLetter(view.tiles, at, marked)
        : standFootprint(view.tiles, at, view.standClass[keyOf(c, r)] ?? 'M', view.standScale[keyOf(c, r)])
      for (const cell of wing) {
        const zone = zoneKind(boxes, cell.c, cell.r)
        if (!zone) continue
        const rule: WorldRule = zone === 'resa' ? 'resa' : 'runway-strip'
        const where = zone === 'resa' ? 'runway end safety area (RESA)' : 'runway strip'
        out.push({
          rule,
          c: cell.c,
          r: cell.r,
          message: `Stand at ${c},${r} sits inside the ${where}.`,
          placeMessage: 'That stand sits inside runway clearance. Taxiways can still cross.',
        })
        break
      }
    }
  }
  for (let r = 0; r < view.tiles.length; r++) {
    const row = view.tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const tile = row[c]
      if (!tile || CLEAR_ZONE_OK.has(tile)) continue
      const zone = zoneKind(boxes, c, r)
      if (!zone) continue
      const rule: WorldRule = zone === 'resa' ? 'resa' : 'runway-strip'
      const where = zone === 'resa' ? 'runway end safety area (RESA)' : 'runway strip'
      out.push({
        rule,
        c,
        r,
        message: `${noun(tile)} at ${c},${r} sits inside the ${where}.`,
        placeMessage: `${input.proposal?.name ?? noun(tile)} sits inside runway clearance. Taxiways can still cross.`,
      })
    }
  }

  out.push(...lineOfSight(view.tiles, input.proposal))
  return out
}

/** Every physical violation on the map. Pending construction counts as built. */
export function auditWorld(input: AuditInput): WorldViolation[] {
  return scan({ ...input, proposal: undefined })
}

/**
 * Why a stamp is illegal, or null when the geometry is fine.
 * Cash, research, and "needs grass" stay with the caller.
 */
export function placementReason(input: AuditInput, stamp: Stamp): string | null {
  const surface = workingSurface(input)
  const legacy = legacyReason(surface, stamp)
  if (legacy) return legacy
  const before = new Set(scan({ ...input, proposal: undefined }).map(sig))
  let fresh = scan({ ...input, proposal: stamp }).filter((v) => !before.has(sig(v)))
  // A new strip does not move the cab. Sight is enforced when the tower or a tall
  // building is placed, and on the finished map. Refusing the strip here would
  // block a runway the hall happens to sit in front of.
  if (stamp.tile === 'runway' || stamp.tile === 'taxi') {
    fresh = fresh.filter((v) => v.rule !== 'tower-los')
  }
  return fresh[0]?.placeMessage ?? null
}
