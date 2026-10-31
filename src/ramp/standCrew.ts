/**
 * Arrival crew at a stand: marshaller, chocks pair and cone walker. Same
 * output as the service crew (cells + metres), so CrewFigures draws them
 * with the same LOD. Positions are aircraft-local metres: +X nose, +Z left.
 */
import { STAND_TIMELINE as T, type CrewPose, type CrewRole } from './crewConfig.ts'
import { walkOutside, type CrewFootprint } from './crewPath.ts'
import { placeLocal, type CrewPerson, type CrewProp } from './present.ts'
import { detAtan2 } from '../game/detMath.ts'

export interface StandArrival {
  id: string
  /** Aircraft origin, cells. */
  x: number
  y: number
  heading: number
  /** Drawn metres (real × aircraft visual scale). */
  lengthM: number
  spanM: number
  /** Drawn fuselage radius. Omit to keep the legacy straight walks. */
  skinM?: number
  /** Seconds since the final taxi-in began (see STAND_TIMELINE). */
  t: number
}

/** Cone spots in aircraft metres, in the order they are set. */
export function standConePoints(a: Pick<StandArrival, 'lengthM' | 'spanM'>): [number, number][] {
  const nose = a.lengthM / 2
  const tip = a.spanM / 2
  return [
    [nose + 1.5, 0],
    [0, tip + 1],
    [0, -tip - 1],
    [-nose - 1.5, 0],
  ]
}

function footOf(a: Pick<StandArrival, 'lengthM' | 'skinM'>): CrewFootprint {
  return { nose: a.lengthM / 2, tail: -a.lengthM / 2, skin: a.skinM ?? 0 }
}

/** Kneel spot: beside the nose gear, outside the drawn skin. */
function chockZ(a: StandArrival, side: number): number {
  return a.skinM && a.skinM > 0 ? side * (a.skinM + 0.85) : side * 1.1
}

function person(
  out: CrewPerson[],
  a: StandArrival,
  id: string,
  role: CrewRole,
  x: number,
  z: number,
  face: number,
  pose: CrewPose,
  metersPerUnit: number,
) {
  const at = placeLocal(a, { x, y: 0, z }, metersPerUnit)
  out.push({ id: `${a.id}:${id}`, role, service: 'stand', c: at.c, r: at.r, alt: 0, heading: a.heading + face, pose })
}

export function standCrewPeople(a: StandArrival, metersPerUnit: number, out: CrewPerson[] = []): CrewPerson[] {
  const t = a.t
  const nose = a.lengthM / 2
  const gear = nose - a.lengthM * 0.12
  if (t < T.marshalOff) {
    // Ahead of the stop line, facing the aircraft: wands waving it in, then held for stop.
    person(out, a, 'marshal', 'walker', nose + 9, 0, Math.PI, t < T.taxi ? 'reach' : 'idle', metersPerUnit)
  }
  for (const side of [-1, 1]) {
    const sx = nose + 6
    const sz = side * 7
    const gz = chockZ(a, side)
    const clearZ = side * Math.max(3.5, Math.abs(gz) )
    const foot = footOf(a)
    if (t < T.chocksWalk) person(out, a, `chock${side}`, 'helper', sx, sz, Math.PI, 'idle', metersPerUnit)
    else if (t < T.chocksOn) {
      const k = (t - T.chocksWalk) / (T.chocksOn - T.chocksWalk)
      const at = walkOutside([sx, sz], [gear, gz], k, foot)
      person(out, a, `chock${side}`, 'helper', at[0], at[1], detAtan2(gz - sz, gear - sx), 'walk', metersPerUnit)
    } else if (t < T.chocksOn + 2.5) person(out, a, `chock${side}`, 'helper', gear, gz, (-side * Math.PI) / 2, 'kneel', metersPerUnit)
    else if (t < T.chocksOn + 4.5) {
      // Stand up and step clear of the nose gear.
      const k = (t - T.chocksOn - 2.5) / 2
      const cx = gear + 1.5
      const at = walkOutside([gear, gz], [cx, clearZ], k, foot)
      person(out, a, `chock${side}`, 'helper', at[0], at[1], detAtan2(clearZ - gz, cx - gear), 'walk', metersPerUnit)
    } else if (t < T.settled) person(out, a, `chock${side}`, 'helper', gear + 1.5, clearZ, 0, 'idle', metersPerUnit)
  }
  if (t >= T.conesStart - 1 && t < T.settled) {
    const pts = standConePoints(a)
    const k = Math.max(0, (t - T.conesStart) / T.conePer)
    const i = Math.min(3, Math.floor(k))
    const from: [number, number] = i === 0 ? [nose + 6, 7] : pts[i - 1]
    const to = pts[i]
    const w = Math.min(1, (k - i) / 0.95)
    const walking = k < 4 && w < 1
    const at = walkOutside(from, to, w, footOf(a))
    const px = at[0]
    const pz = at[1]
    const face = walking ? detAtan2(to[1] - from[1], to[0] - from[0]) : -Math.PI / 2
    person(out, a, 'cones', 'helper', px, pz + 0.6, face, walking ? 'walk' : 'kneel', metersPerUnit)
  }
  return out
}

/** Chocks at the nose gear and the cones set so far, as small apron props. */
export function standProps(a: StandArrival, metersPerUnit: number, out: CrewProp[] = []): CrewProp[] {
  const nose = a.lengthM / 2
  const gear = nose - a.lengthM * 0.12
  if (a.t >= T.chocksOn) {
    for (const side of [-1, 1]) {
      const at = placeLocal(a, { x: gear + 0.45, y: 0.12, z: side * 0.35 }, metersPerUnit)
      out.push({ id: `${a.id}:chockblock${side}`, kind: 'chock', ...at, heading: a.heading + Math.PI / 2, length: 0.5, fill: 1 })
    }
  }
  if (a.t >= T.conesStart) {
    const placed = Math.min(4, Math.floor((a.t - T.conesStart) / T.conePer) + 1)
    standConePoints(a)
      .slice(0, placed)
      .forEach(([x, z], i) => {
        const at = placeLocal(a, { x, y: 0, z }, metersPerUnit)
        out.push({ id: `${a.id}:cone${i}`, kind: 'cone', ...at, heading: a.heading, length: 0.36, fill: 1 })
      })
  }
  return out
}
