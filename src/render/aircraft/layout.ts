import * as THREE from 'three'
import type { ModelSpec } from './specs'

/** Group-space stations every builder and the door layout share (metres, +X nose, +Z port). */
export function airframeStations(spec: ModelSpec) {
  const centerY = spec.gear + spec.ry
  return {
    nose: spec.lengthM / 2,
    tailX: -spec.lengthM / 2,
    centerY,
    wingX: spec.lengthM * (0.5 - spec.wingAt),
    wingY: spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28,
  }
}

/** Engine centres (nacelle axis midpoints). */
export function engineLayout(spec: ModelSpec): THREE.Vector3[] {
  const { wingX, wingY, centerY, nose, tailX } = airframeStations(spec)
  const eng = spec.engines
  if (eng.count === 0) return []
  const pts: THREE.Vector3[] = []
  if (eng.mount === 'nose') {
    pts.push(new THREE.Vector3(nose - eng.length * 0.15, centerY, 0))
    return pts
  }
  if (eng.mount === 'rear') {
    // High on the rear fuselage, ahead of the tail cone: CRJ, E-Jet, Citation.
    const x = tailX + spec.lengthM * 0.22
    const y = centerY + spec.ry * 0.38
    const z = spec.rx + eng.radius * 0.42
    pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, -z))
    return pts
  }
  if (eng.mount === 'tail') {
    const x = tailX + eng.length * 0.35
    const z = spec.rx * 0.42
    pts.push(new THREE.Vector3(x, centerY, z), new THREE.Vector3(x, centerY, -z))
    return pts
  }
  const semi = spec.spanM / 2
  // Inboard pair for quads (747, A380, C-130). Narrowbody twins sit closer to the root than widebody twins.
  const fracs = eng.count === 4 ? [0.25, 0.52] : [spec.spanM >= 55 ? 0.34 : 0.3]
  const tanSweep = Math.tan((spec.sweep * Math.PI) / 180)
  const tanDih = Math.tan((spec.dihedral * Math.PI) / 180)
  const fan = eng.kind !== 'turboprop'
  for (const frac of fracs) {
    const z = semi * frac
    // Follow the swept, dihedral leading edge so the pod hangs under the wing, not behind it.
    const chordAt = spec.rootChord + (spec.tipChord - spec.rootChord) * frac
    const le = wingX + spec.rootChord / 2 - tanSweep * z
    const wy = wingY + tanDih * z
    const x = fan ? le + eng.length * 0.12 : le - chordAt * 0.15 + eng.length * 0.2
    const y = spec.wingHigh
      ? (fan ? wy - eng.radius * 1.15 : wy - eng.radius * 0.2)
      : (fan ? wy - eng.radius * 1.3 - spec.thickness * 0.2 : wy + eng.radius * 0.1)
    pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, -z))
  }
  return pts
}
