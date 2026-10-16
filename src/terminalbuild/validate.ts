/**
 * Whole-layout validator. Pure; run it after every edit.
 *
 * Checks, in the player's words:
 * - Enclosed: every outer floor edge has a wall or a door.
 * - Security is the only way from before security to after security.
 * - Departures reach check-in, security and every gate; arrivals reach the curb.
 * - Required rooms exist (check-in, security, a gate, bag make-up) and hold their kit.
 * - Bags from every check-in desk reach a make-up carousel, and make-up reaches the apron.
 * - Equipment is in the right room, not boxed in, and reachable by the people it serves.
 */
import { EQUIP_SPEC, ROOM_SPEC, ZONE_LABEL } from './config.ts'
import { beltReachesPort, fittingRoomViolation, fittingTiles, isSecurityKit } from './fittings.ts'
import {
  around,
  edgeClosed,
  edgeOpen,
  edgeTiles,
  flood,
  indexLayout,
  isFloor,
  outsideDoors,
  sideAt,
  standable,
  tileKey,
  walkStep,
  type GridIndex,
} from './grid.ts'
import type { BuildLayout, Equip, Finding, FindingSeverity, RoomKind, Tile } from './types.ts'

export interface Validation {
  /** No blockers. The terminal can open. */
  ok: boolean
  findings: Finding[]
}

const RANK: Record<FindingSeverity, number> = { blocker: 0, warning: 1, tip: 2 }

/** Tiles a passenger can stand on to use this kit. */
export function serviceTiles(l: BuildLayout, ix: GridIndex, eq: Equip): Tile[] {
  return around(eq).filter((t) => standable(l, ix, t, 'depart') && edgeOpen(ix, eq, t, 'depart'))
}

function laneTileSet(l: BuildLayout): Set<string> {
  const out = new Set<string>()
  for (const e of l.equipment) if (e.kind === 'security_lane') out.add(tileKey(e.x, e.y, e.floor ?? 0))
  for (const f of l.fittings ?? []) {
    if (f.kind !== 'security_lane') continue
    for (const t of fittingTiles(f)) out.add(tileKey(t.x, t.y, f.floor))
  }
  return out
}

export interface Reach {
  /** Curb tiles (inside face of a curb door). */
  curb: Tile[]
  /** Departures walking from the curb without passing a security lane. */
  beforeSec: Set<string>
  /** Departures walking from the curb, lanes allowed. */
  departs: Set<string>
  /** Arrivals walking from gate apron doors (exit doors allowed, lanes not). */
  arrives: Set<string>
  /** Apron door tiles inside gate rooms. */
  gateApron: Tile[]
}

export function reachOf(l: BuildLayout, ix: GridIndex = indexLayout(l)): Reach {
  const lanes = laneTileSet(l)
  const isLane = (t: Tile) => lanes.has(tileKey(t.x, t.y, t.floor ?? 0))
  const curb = outsideDoors(l, ['curb'])
    .map((d) => d.tile)
    .filter((t) => standable(l, ix, t, 'depart'))
  const beforeSec = new Set(flood(curb, walkStep(l, ix, 'depart', isLane)).dist.keys())
  const departs = new Set(flood(curb, walkStep(l, ix, 'depart')).dist.keys())
  const gateApron = outsideDoors(l, ['apron', 'gate_apron', 'gate_bridge'])
    .map((d) => d.tile)
    .filter((t) => ix.roomAt.get(tileKey(t.x, t.y))?.kind === 'gate')
  const arrivalStarts = [
    ...gateApron,
    ...outsideDoors(l, ['arrivals_in']).map((d) => d.tile),
  ].filter((t) => standable(l, ix, t, 'arrive'))
  const arrives = new Set(flood(arrivalStarts, walkStep(l, ix, 'arrive', isLane)).dist.keys())
  return { curb, beforeSec, departs, arrives, gateApron }
}

/** Bag network from a check-in desk: belts carry bags through walls (hatches). */
export function bagRoute(l: BuildLayout, ix: GridIndex, desk: Equip): { carousel: Equip; beltTiles: number } | null {
  const res = flood([desk], (from, to) => {
    // Carousels end a run: bags do not ride through one onto the next belt.
    if (ix.equipAt.get(tileKey(from.x, from.y))?.kind === 'makeup_carousel') return false
    const eq = ix.equipAt.get(tileKey(to.x, to.y))
    return isFloor(l, to.x, to.y) && !!eq && (eq.kind === 'bag_belt' || eq.kind === 'makeup_carousel')
  })
  let best: { carousel: Equip; beltTiles: number } | null = null
  for (const [k, d] of res.dist) {
    const eq = ix.equipAt.get(k)
    if (eq?.kind === 'makeup_carousel' && (!best || d < best.beltTiles)) best = { carousel: eq, beltTiles: d }
  }
  return best
}

/** Can bag carts get from this carousel to an apron door through the bag hall? */
export function makeupReachesApron(l: BuildLayout, ix: GridIndex, carousel: Equip): boolean {
  const apron = new Set(outsideDoors(l, ['apron']).map((d) => tileKey(d.tile.x, d.tile.y)))
  const starts = around(carousel).filter(
    (t) => isFloor(l, t.x, t.y) && l.zones[t.y][t.x] === 'baggage' && standable(l, ix, t, 'staff') && edgeOpen(ix, carousel, t, 'staff'),
  )
  const res = flood(starts, (from, to) => {
    if (!isFloor(l, to.x, to.y) || l.zones[to.y][to.x] !== 'baggage') return false
    return standable(l, ix, to, 'staff') && edgeOpen(ix, from, to, 'staff')
  })
  return [...res.dist.keys()].some((k) => apron.has(k))
}

function roomTiles(r: { x: number; y: number; w: number; h: number }): Tile[] {
  const out: Tile[] = []
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y })
  return out
}

export function validateLayout(l: BuildLayout): Validation {
  const ix = indexLayout(l)
  const F: Finding[] = []
  const add = (f: Finding) => F.push(f)

  // 1. Enclosure: no gaps in the outer wall.
  const gaps: Tile[] = []
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      if (!l.floor[y][x]) continue
      const open = around({ x, y }).some((n) => {
        if (isFloor(l, n.x, n.y)) return false
        const e = n.x !== x ? { x: Math.min(x, n.x), y, dir: 'E' as const } : { x, y: Math.min(y, n.y), dir: 'S' as const }
        return !edgeClosed(ix, e)
      })
      if (open) gaps.push({ x, y })
    }
  }
  if (gaps.length) {
    add({
      id: 'wall_gap',
      severity: 'blocker',
      blocksFlow: false,
      title: 'Gaps in the outer wall',
      detail: `${gaps.length} floor tile${gaps.length === 1 ? '' : 's'} open straight onto the outside.`,
      fix: 'Close the edge with a wall, or put a door there.',
      cells: gaps,
    })
  }

  // 2. Doors: outside doors must be curb/apron and on the right side of security.
  for (const d of l.doors) {
    const [a, b] = edgeTiles(d)
    const fa = isFloor(l, a.x, a.y)
    const fb = isFloor(l, b.x, b.y)
    const tile = fa ? a : b
    const id = `${d.x},${d.y},${d.dir}`
    if (!fa && !fb) {
      add({ id: `door_floating:${id}`, severity: 'tip', blocksFlow: false, title: 'Door with no floor', detail: 'This door opens onto nothing on both sides.', fix: 'Lay floor next to it, or remove it.', cells: [a] })
      continue
    }
    if (fa && fb) {
      const sideA = sideAt(l, a)
      const sideB = sideAt(l, b)
      if ((sideA === 'airside' && sideB === 'sterile_arr') || (sideA === 'sterile_arr' && sideB === 'airside')) {
        add({ id: `door_sterile:${id}`, severity: 'blocker', blocksFlow: true, title: 'Door joins the gates to baggage claim', detail: 'Arrivals and departures would share a door.', fix: 'Wall this edge. Claim meets the hall only through an exit door.', cells: [a, b] })
      }
      continue
    }
    const outerOk = d.kind === 'curb' || d.kind === 'apron' || d.kind === 'gate_apron' || d.kind === 'gate_bridge' || d.kind === 'arrivals_in'
    if (!outerOk) {
      add({ id: `door_kind:${id}`, severity: 'warning', blocksFlow: false, title: 'Inside door on the outer wall', detail: 'Only curb doors and apron doors work on the outside wall.', fix: 'Swap it for a curb door or an apron door.', cells: [tile] })
      continue
    }
    const side = sideAt(l, tile)
    if (d.kind === 'curb' && side !== 'landside' && side !== 'either') {
      add({ id: `door_side:${id}`, severity: 'blocker', blocksFlow: false, title: 'Curb door opens past security', detail: 'People off the street would walk straight in without screening.', fix: 'Move the curb door to check-in or the hall before security.', cells: [tile] })
    }
    const apronish = d.kind === 'apron' || d.kind === 'gate_apron' || d.kind === 'gate_bridge'
    if (apronish && (side === 'landside' || side === 'security' || side === 'sterile_arr')) {
      add({ id: `door_side:${id}`, severity: 'blocker', blocksFlow: false, title: 'Apron door opens before security', detail: 'The apron is after security. This door lets the public onto it.', fix: 'Move the apron door to a gate or the bag hall.', cells: [tile] })
    }
    if (d.kind === 'arrivals_in' && side !== 'sterile_arr') {
      add({ id: `door_side:${id}`, severity: 'blocker', blocksFlow: false, title: 'Arrivals door opens off the claim hall', detail: 'An arrivals door has to open into baggage claim or the arrivals corridor.', fix: 'Move it onto a claim or arrivals tile.', cells: [tile] })
    }
  }

  // 3. Rooms: required set, zone fit, kit.
  const kinds = new Set(l.rooms.map((r) => r.kind))
  for (const [kind, spec] of Object.entries(ROOM_SPEC) as [RoomKind, (typeof ROOM_SPEC)[RoomKind]][]) {
    if (!spec.required || kinds.has(kind)) continue
    if (kind === 'bagmakeup' && l.version === 2) continue
    add({ id: `missing_${kind}`, severity: 'blocker', blocksFlow: true, title: `No ${spec.label.toLowerCase()}`, detail: `A terminal cannot open without a ${spec.label.toLowerCase()}.`, fix: `Place a ${spec.label.toLowerCase()} room.`, cells: [] })
  }
  for (const room of l.rooms) {
    const spec = ROOM_SPEC[room.kind]
    const tiles = roomTiles(room)
    const bare = tiles.filter((t) => !isFloor(l, t.x, t.y))
    if (bare.length) {
      add({ id: `room_floor:${room.id}`, severity: 'warning', blocksFlow: false, title: `${spec.label} hangs off the floor`, detail: `${bare.length} tile${bare.length === 1 ? '' : 's'} of the room have no floor.`, fix: 'Lay floor under the whole room.', cells: bare })
    }
    const off = tiles.filter((t) => isFloor(l, t.x, t.y) && !spec.zones.includes(l.zones[t.y][t.x]!))
    if (off.length) {
      const want = spec.zones.map((z) => ZONE_LABEL[z]).join(' or ')
      add({ id: `room_zone:${room.id}`, severity: 'warning', blocksFlow: false, title: `${spec.label} is on the wrong zone`, detail: `It should sit on ${want}.`, fix: `Paint ${want} under it.`, cells: off })
    }
    for (const need of spec.needs) {
      const has = l.equipment.some((e) => e.kind === need && ix.roomAt.get(tileKey(e.x, e.y))?.id === room.id)
      if (has) continue
      add({ id: `room_empty:${room.id}:${need}`, severity: spec.required ? 'blocker' : 'warning', blocksFlow: spec.required, title: `${spec.label} has no ${EQUIP_SPEC[need].label.toLowerCase()}`, detail: 'The room is built but nothing in it can serve anyone.', fix: `Place a ${EQUIP_SPEC[need].label.toLowerCase()} inside it.`, cells: tiles.slice(0, 1) })
    }
  }

  // 4. Paths.
  const R = reachOf(l, ix)
  if (!R.curb.length) {
    add({ id: 'no_entrance', severity: 'blocker', blocksFlow: true, title: 'No way in from the curb', detail: 'There is no curb door on check-in or the hall before security.', fix: 'Put a curb door in the outer wall before security.', cells: [] })
  } else {
    const leak: Tile[] = []
    for (const k of R.beforeSec) {
      const [x, y] = k.split(',').map(Number)
      if (sideAt(l, { x, y }) === 'airside') leak.push({ x, y })
    }
    if (leak.length) {
      add({ id: 'security_bypass', severity: 'blocker', blocksFlow: true, title: 'Security can be walked around', detail: 'Passengers can get from the curb to after security without passing a security lane.', fix: 'Wall off the seam so the only way through is a security lane.', cells: leak.slice(0, 6) })
    }
  }

  const reached = (tiles: Tile[], set: Set<string>) => tiles.some((t) => set.has(tileKey(t.x, t.y)))
  const servedBy = (kind: Equip['kind'], set: Set<string>) =>
    l.equipment.filter((e) => e.kind === kind).some((e) => reached(serviceTiles(l, ix, e), set))
  const lanes = l.equipment.filter((e) => e.kind === 'security_lane')
  if (R.curb.length) {
    const desks = l.equipment.filter((e) => e.kind === 'checkin_desk')
    if (desks.length && !servedBy('checkin_desk', R.beforeSec)) {
      add({ id: 'checkin_unreachable', severity: 'blocker', blocksFlow: true, title: 'Check-in cannot be reached', detail: 'No check-in desk has a free side people can walk to from the curb.', fix: 'Open a path from the curb door to the desks.', cells: desks.map((e) => ({ x: e.x, y: e.y })) })
    }
    if (lanes.length && !lanes.some((e) => reached(serviceTiles(l, ix, e), R.beforeSec))) {
      add({ id: 'security_unreachable', severity: 'blocker', blocksFlow: true, title: 'Security cannot be reached', detail: 'No security lane can be walked to from check-in.', fix: 'Open a path from check-in to the lanes.', cells: lanes.map((e) => ({ x: e.x, y: e.y })) })
    }
  }
  for (const lane of lanes) {
    const out = serviceTiles(l, ix, lane).some((t) => sideAt(l, t) === 'airside' || sideAt(l, t) === 'either')
    if (!out) {
      add({ id: `lane_dead_end:${lane.id}`, severity: 'warning', blocksFlow: false, title: 'Security lane leads nowhere', detail: 'The far side of this lane is not after security.', fix: 'Put after-security floor on the other side of the lane.', cells: [{ x: lane.x, y: lane.y }] })
    }
  }

  for (const room of l.rooms.filter((r) => r.kind === 'gate')) {
    const desks = l.equipment.filter((e) => e.kind === 'gate_desk' && ix.roomAt.get(tileKey(e.x, e.y))?.id === room.id)
    if (R.curb.length && desks.length && !desks.some((d) => reached(serviceTiles(l, ix, d), R.departs))) {
      add({ id: `gate_unreachable:${room.id}`, severity: 'blocker', blocksFlow: true, title: 'Gate cannot be reached', detail: 'Departures cannot walk from security to this gate desk.', fix: 'Open a door from the hall after security into the gate.', cells: roomTiles(room).slice(0, 1) })
    }
    const apron = R.gateApron.some((t) => ix.roomAt.get(tileKey(t.x, t.y))?.id === room.id)
    if (!apron) {
      add({ id: `gate_no_apron:${room.id}`, severity: 'blocker', blocksFlow: true, title: 'Gate has no apron door', detail: 'Passengers have no way out to the aircraft.', fix: 'Put an apron door in the gate’s outer wall.', cells: roomTiles(room).slice(0, 1) })
    }
  }
  if (R.gateApron.length && R.curb.length) {
    const out = R.curb.some((t) => R.arrives.has(tileKey(t.x, t.y)))
    if (!out) {
      add({ id: 'arrivals_no_exit', severity: 'blocker', blocksFlow: true, title: 'Arrivals cannot leave', detail: 'Arriving passengers cannot get from the gates back to the curb. Security lanes are one way.', fix: 'Add an exit door from after security to before security.', cells: R.gateApron.slice(0, 1) })
    }
  }

  // 5. Bags. A version-2 hall uses belts and ports. Older halls still use make-up carousels.
  if (l.version === 2) {
    for (const piece of (l.fittings ?? []).filter((f) => f.kind === 'checkin_desk' || f.kind === 'bag_drop')) {
      if (beltReachesPort(l, { x: Math.floor(piece.x), y: Math.floor(piece.y) }, 'bag_out')) continue
      add({ id: `bags_no_route:${piece.id}`, severity: 'blocker', blocksFlow: true, title: 'Bags from a desk go nowhere', detail: 'No belt links this desk or bag drop to a bag-out port.', fix: 'Run the takeaway belt to a bag-out port.', cells: [{ x: Math.floor(piece.x), y: Math.floor(piece.y) }] })
    }
    for (const car of (l.fittings ?? []).filter((f) => f.kind === 'claim_carousel')) {
      const hit = fittingTiles(car).some((t) => beltReachesPort(l, t, 'bag_in'))
      if (hit) continue
      add({ id: `bags_no_feed:${car.id}`, severity: 'blocker', blocksFlow: true, title: 'Claim carousel has no feed', detail: 'No belt links a bag-in port to this carousel.', fix: 'Run the claim belt from a bag-in port to the carousel.', cells: [{ x: Math.floor(car.x), y: Math.floor(car.y) }] })
    }
  } else {
    for (const desk of l.equipment.filter((e) => e.kind === 'checkin_desk')) {
      if (bagRoute(l, ix, desk)) continue
      add({ id: `bags_no_route:${desk.id}`, severity: 'blocker', blocksFlow: true, title: 'Bags from a desk go nowhere', detail: 'No belt links this check-in desk to a make-up carousel. Bags would be left behind.', fix: 'Run bag belts from the desk to make-up.', cells: [{ x: desk.x, y: desk.y }] })
    }
    for (const car of l.equipment.filter((e) => e.kind === 'makeup_carousel')) {
      if (makeupReachesApron(l, ix, car)) continue
      add({ id: `makeup_no_apron:${car.id}`, severity: 'blocker', blocksFlow: true, title: 'Bag carts cannot reach the apron', detail: 'No path through the bag hall from this carousel to an apron door.', fix: 'Add an apron door to the baggage zone and keep a lane clear.', cells: [{ x: car.x, y: car.y }] })
    }
  }

  // 6. Equipment: placement, boxed in, unreachable.
  for (const eq of l.equipment) {
    const spec = EQUIP_SPEC[eq.kind]
    const room = ix.roomAt.get(tileKey(eq.x, eq.y))
    const at = [{ x: eq.x, y: eq.y }]
    if (spec.rooms.length && (!room || !spec.rooms.includes(room.kind))) {
      add({ id: `equip_room:${eq.id}`, severity: 'warning', blocksFlow: false, title: `${spec.label} is outside its room`, detail: `It only works inside: ${spec.rooms.map((k) => ROOM_SPEC[k].label.toLowerCase()).join(', ')}.`, fix: 'Move it into the right room.', cells: at })
    }
    if (!spec.servesPax) continue
    const sides = serviceTiles(l, ix, eq)
    const required = Object.values(ROOM_SPEC).some((r) => r.required && r.needs.includes(eq.kind))
    if (!sides.length) {
      add({ id: `equip_blocked:${eq.id}`, severity: required ? 'blocker' : 'warning', blocksFlow: true, title: `${spec.label} is boxed in`, detail: 'Walls or other kit cover every side, so nobody can use it.', fix: 'Clear one side of it.', cells: at })
      continue
    }
    if (!R.curb.length) continue
    const users = eq.kind === 'checkin_desk' || eq.kind === 'security_lane' ? R.beforeSec : R.departs
    if (!reached(sides, users)) {
      add({ id: `equip_unreachable:${eq.id}`, severity: required ? 'warning' : 'tip', blocksFlow: true, title: `${spec.label} cannot be reached`, detail: 'Nobody can walk to it from the curb.', fix: 'Open a door or path to it.', cells: at })
    }
  }

  // 6b. Fitting room rules. Security kit stays in the security room. Passport stays sterile.
  for (const piece of l.fittings ?? []) {
    if (!isSecurityKit(piece.kind) && piece.kind !== 'passport_booth') continue
    const why = fittingRoomViolation(l, piece.kind, piece.x, piece.y)
    if (!why) continue
    add({
      id: `room_rule:${piece.id}`,
      severity: 'blocker',
      blocksFlow: true,
      title: piece.kind === 'passport_booth' ? 'Passport booth is outside claim' : 'Security kit is outside security',
      detail: why,
      fix: piece.kind === 'passport_booth' ? 'Move the booth into baggage claim or the arrivals corridor.' : 'Move it into the security room.',
      cells: [{ x: Math.floor(piece.x), y: Math.floor(piece.y) }],
    })
  }

  // 7. Unzoned floor reads as nothing.
  const bare: Tile[] = []
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.floor[y][x] && !l.zones[y][x]) bare.push({ x, y })
  if (bare.length) {
    add({ id: 'floor_unzoned', severity: 'tip', blocksFlow: false, title: 'Floor with no zone', detail: `${bare.length} tile${bare.length === 1 ? '' : 's'} have no zone painted. Passengers ignore them.`, fix: 'Paint a zone or lift the floor.', cells: bare.slice(0, 6) })
  }

  F.sort((a, b) => RANK[a.severity] - RANK[b.severity])
  return { ok: !F.some((f) => f.severity === 'blocker'), findings: F }
}
