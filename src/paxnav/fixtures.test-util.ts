/** Test layouts and the checked tick loop shared by the paxnav tests. */
import {
  applyEdits,
  blankLayout,
  encloseFloor,
  paintZone,
  placeDoor,
  placeEquipment,
  placeFloor,
  placeRoom,
  placeWall,
  type BuildLayout,
  type EquipKind,
} from '../terminalbuild/index.ts'
import { sampleTerminal, type Edit } from '../terminalbuild/sample.ts'
import { AIR, LANE, PRE, cellAt, moveOpen } from './grid.ts'
import type { PaxEvent, PaxNav } from './paxnav.ts'

export function build(l: BuildLayout, edits: Edit[]): BuildLayout {
  const res = applyEdits(l, edits)
  if (res.error) throw new Error(res.error)
  return res.layout
}

export function sample(): BuildLayout {
  const res = sampleTerminal()
  if (res.error) throw new Error(res.error)
  return res.layout
}

/**
 * 96 m x 52 m terminal: four gates with seats and jet bridges, a shop and
 * toilets after security, eight security lanes, ten check-in desks, four curb doors.
 */
export function bigTerminal(): BuildLayout {
  const W = 24
  const edits: Edit[] = [
    (l) => placeFloor(l, { x: 0, y: 0, w: W, h: 13 }),
    (l) => paintZone(l, { x: 0, y: 0, w: W, h: 2 }, 'gates'),
    (l) => paintZone(l, { x: 0, y: 2, w: W, h: 3 }, 'airside'),
    (l) => paintZone(l, { x: 0, y: 2, w: 4, h: 2 }, 'retail'),
    (l) => paintZone(l, { x: 0, y: 5, w: W, h: 1 }, 'security'),
    (l) => paintZone(l, { x: 0, y: 6, w: W, h: 3 }, 'landside'),
    (l) => paintZone(l, { x: 0, y: 9, w: W, h: 4 }, 'checkin'),
  ]
  const lanes = [1, 4, 7, 10, 13, 16, 19, 22]
  for (let x = 0; x < W; x++) if (!lanes.includes(x)) edits.push((l) => placeWall(l, { x, y: 4, dir: 'S' }))
  for (const x of [3, 8, 15, 20]) edits.push((l) => placeDoor(l, { x, y: 12, dir: 'S', kind: 'curb' }))
  for (let g = 0; g < 4; g++) {
    const x = g * 6
    edits.push((l) => placeDoor(l, { x: x + 2, y: -1, dir: 'S', kind: 'apron' }))
  }
  edits.push(encloseFloor)
  for (let g = 0; g < 4; g++) {
    const x = g * 6
    edits.push(
      (l) => placeRoom(l, { id: `g${g + 1}`, kind: 'gate', x, y: 0, w: 6, h: 2 }),
      (l) => placeEquipment(l, { id: `gd${g + 1}`, kind: 'gate_desk', x: x + 3, y: 1 }),
      (l) => placeEquipment(l, { id: `seatA${g + 1}`, kind: 'seat', x: x + 1, y: 0 }),
      (l) => placeEquipment(l, { id: `seatB${g + 1}`, kind: 'seat', x: x + 4, y: 0 }),
    )
  }
  edits.push(
    (l) => placeRoom(l, { id: 'shop', kind: 'retail', x: 0, y: 2, w: 4, h: 2 }),
    (l) => placeEquipment(l, { id: 'shop1', kind: 'shop_counter', x: 1, y: 2 }),
    (l) => placeRoom(l, { id: 'wc', kind: 'toilets', x: 20, y: 2, w: 4, h: 2 }),
    (l) => placeEquipment(l, { id: 'wc1', kind: 'toilet', x: 22, y: 2 }),
    (l) => placeRoom(l, { id: 'sec', kind: 'security', x: 0, y: 5, w: W, h: 1 }),
    (l) => placeRoom(l, { id: 'ci', kind: 'checkin', x: 0, y: 9, w: W, h: 4 }),
  )
  lanes.forEach((x, i) => edits.push((l) => placeEquipment(l, { id: `lane${i + 1}`, kind: 'security_lane', x, y: 5 })))
  for (let i = 0; i < 10; i++) {
    edits.push((l) => placeEquipment(l, { id: `desk${i + 1}`, kind: 'checkin_desk', x: 2 + i * 2, y: 9 }))
  }
  return build(blankLayout(W, 13), edits)
}

export interface Track {
  cell: number
  airside: boolean
  kinds: EquipKind[]
}

/**
 * Tick with every invariant checked: on the floor, inside the grid, on a
 * walkable cell of the right side of security, and only ever stepping to a
 * neighbour cell through an open edge.
 */
export function runChecked(nav: PaxNav, from: number, to: number, dt: number, tracks = new Map<string, Track>()) {
  const events: PaxEvent[] = []
  const kindOf = new Map(nav.metrics().map((m) => [m.id, m.kind]))
  for (let t = from; t < to; t += dt) {
    nav.tick(dt, t)
    events.push(...nav.drainEvents())
    const g = nav.nav
    const b = nav.bounds()
    // Plain checks, not expect(): this runs millions of times.
    const fail = (why: string) => {
      throw new Error(`t=${t}: ${why}`)
    }
    for (const p of nav.poses()) {
      if (p.y !== 0) fail(`${p.id} is off the floor`)
      if (!(p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ)) fail(`${p.id} left the grid`)
      const c = cellAt(g, p.x, p.z)
      // Before security only on before-security floor; after only on after-security floor.
      if (!(g.mask[c] & (p.airside ? AIR : PRE))) fail(`${p.id} on unwalkable cell ${c} (${p.x}, ${p.z})`)
      const tr = tracks.get(p.id)
      if (tr && tr.cell !== c && !moveOpen(g, tr.cell, c, PRE | AIR)) fail(`${p.id} stepped ${tr.cell} -> ${c} through a wall`)
      if (tr && tr.airside && !p.airside) fail(`${p.id} went back through security`)
      // Only a security lane lets you through.
      if (tr && !tr.airside && p.airside && !(g.mask[c] & LANE)) fail(`${p.id} got airside off a lane`)
      const kind = p.facility ? kindOf.get(p.facility) : undefined
      const kinds = tr?.kinds ?? []
      if (kind && kinds[kinds.length - 1] !== kind) kinds.push(kind)
      tracks.set(p.id, { cell: c, airside: p.airside, kinds })
    }
  }
  return { events, tracks }
}
