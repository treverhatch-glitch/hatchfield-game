/**
 * A small terminal built from scratch with the build tools, edit by edit.
 * Used by tests and as a reference layout. 8 x 6 tiles (32 m x 24 m).
 *
 *   y0  G G G G G G B B   gate room, apron door on the north wall at x0; bag hall x6-7
 *   y1  A A A A A A B B   hall after security; one-way exit door at (5,1)->(5,2)
 *   y2  S L S L S S B B   security; lanes at x1 and x3, walls north of the rest
 *   y3  H H H H H H B B   hall before security
 *   y4  C C C C C D b B   check-in; desk D at x5, belt b, carousel at (7,4)
 *   y5  C C C C C D b B   curb doors on the south wall at x1, x2
 */
import { applyEdits, blankLayout, encloseFloor, paintZone, placeDoor, placeEquipment, placeFloor, placeRoom, placeWall } from './layout.ts'
import type { BuildLayout, EditResult } from './types.ts'

export type Edit = (l: BuildLayout) => EditResult

export function sampleTerminalEdits(): Edit[] {
  const edits: Edit[] = [
    (l) => placeFloor(l, { x: 0, y: 0, w: 8, h: 6 }),
    (l) => paintZone(l, { x: 0, y: 0, w: 6, h: 1 }, 'gates'),
    (l) => paintZone(l, { x: 0, y: 1, w: 6, h: 1 }, 'airside'),
    (l) => paintZone(l, { x: 0, y: 2, w: 6, h: 1 }, 'security'),
    (l) => paintZone(l, { x: 0, y: 3, w: 6, h: 1 }, 'landside'),
    (l) => paintZone(l, { x: 0, y: 4, w: 6, h: 2 }, 'checkin'),
    (l) => paintZone(l, { x: 6, y: 0, w: 2, h: 6 }, 'baggage'),
  ]
  // Bag hall is walled off from the public side.
  for (let y = 0; y < 6; y++) edits.push((l) => placeWall(l, { x: 5, y, dir: 'E' }))
  // Security line: only the lanes (x1, x3) and the exit (x5) cross it.
  for (const x of [0, 2, 4]) edits.push((l) => placeWall(l, { x, y: 1, dir: 'S' }))
  edits.push(
    (l) => placeDoor(l, { x: 5, y: 1, dir: 'S', kind: 'exit' }),
    (l) => placeDoor(l, { x: 1, y: 5, dir: 'S', kind: 'curb' }),
    (l) => placeDoor(l, { x: 2, y: 5, dir: 'S', kind: 'curb' }),
    (l) => placeDoor(l, { x: 0, y: -1, dir: 'S', kind: 'apron' }),
    (l) => placeDoor(l, { x: 7, y: -1, dir: 'S', kind: 'apron' }),
    encloseFloor,
    (l) => placeRoom(l, { id: 'ci', kind: 'checkin', x: 0, y: 4, w: 6, h: 2 }),
    (l) => placeRoom(l, { id: 'sec', kind: 'security', x: 0, y: 2, w: 6, h: 1 }),
    (l) => placeRoom(l, { id: 'g1', kind: 'gate', x: 0, y: 0, w: 6, h: 1 }),
    (l) => placeRoom(l, { id: 'mk', kind: 'bagmakeup', x: 6, y: 0, w: 2, h: 6 }),
    (l) => placeEquipment(l, { id: 'desk1', kind: 'checkin_desk', x: 5, y: 4 }),
    (l) => placeEquipment(l, { id: 'desk2', kind: 'checkin_desk', x: 5, y: 5 }),
    (l) => placeEquipment(l, { id: 'belt1', kind: 'bag_belt', x: 6, y: 4 }),
    (l) => placeEquipment(l, { id: 'belt2', kind: 'bag_belt', x: 6, y: 5 }),
    (l) => placeEquipment(l, { id: 'mk1', kind: 'makeup_carousel', x: 7, y: 4 }),
    (l) => placeEquipment(l, { id: 'lane1', kind: 'security_lane', x: 1, y: 2 }),
    (l) => placeEquipment(l, { id: 'lane2', kind: 'security_lane', x: 3, y: 2 }),
    (l) => placeEquipment(l, { id: 'gd1', kind: 'gate_desk', x: 2, y: 0 }),
    (l) => placeEquipment(l, { id: 'seat1', kind: 'seat', x: 4, y: 0 }),
  )
  return edits
}

export function sampleTerminal(): EditResult {
  return applyEdits(blankLayout(8, 6), sampleTerminalEdits())
}
