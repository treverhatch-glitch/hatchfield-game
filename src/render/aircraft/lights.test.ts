import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildAircraft } from './build'
import { MODEL_SPECS } from './specs'

const LIVERY = { body: '#ffffff', stripe: '#0b4ea2', tail: '#0b4ea2' } as never
const LAMP = /^(nav-|strobe|beacon|landing-light)/

/** Every triangle of the non-lamp meshes, in airframe space. */
function skin(group: THREE.Group): THREE.Triangle[] {
  group.updateMatrixWorld(true)
  const tris: THREE.Triangle[] = []
  const m = new THREE.Matrix4()
  const im = new THREE.Matrix4()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || LAMP.test(mesh.name)) return
    const geo = mesh.geometry
    const pos = geo.getAttribute('position')
    const idx = geo.getIndex()
    const n = idx ? idx.count : pos.count
    const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh) : null
    const copies = inst ? inst.count : 1
    for (let k = 0; k < copies; k++) {
      m.copy(mesh.matrixWorld)
      if (inst) {
        inst.getMatrixAt(k, im)
        m.multiply(im)
      }
      for (let i = 0; i < n; i += 3) {
        const i0 = idx ? idx.getX(i) : i
        const i1 = idx ? idx.getX(i + 1) : i + 1
        const i2 = idx ? idx.getX(i + 2) : i + 2
        a.fromBufferAttribute(pos, i0).applyMatrix4(m)
        b.fromBufferAttribute(pos, i1).applyMatrix4(m)
        c.fromBufferAttribute(pos, i2).applyMatrix4(m)
        tris.push(new THREE.Triangle(a.clone(), b.clone(), c.clone()))
      }
    }
  })
  return tris
}

function gap(p: THREE.Vector3, tris: THREE.Triangle[]): number {
  const q = new THREE.Vector3()
  let best = Infinity
  for (const t of tris) {
    t.closestPointToPoint(p, q)
    best = Math.min(best, q.distanceTo(p))
  }
  return best
}

describe('aircraft lights sit on the airframe', () => {
  for (const spec of Object.values(MODEL_SPECS)) {
    it(`${spec.id}: nav, strobe and beacon lamps touch the mesh`, () => {
      const built = buildAircraft(spec, 'mid', LIVERY)
      const tris = skin(built.group)
      const lamps = built.lamps.filter((l) => /^(nav-|strobe|beacon)/.test(l.name))
      expect(lamps.length).toBeGreaterThan(0)
      for (const lamp of lamps) {
        const p = lamp.getWorldPosition(new THREE.Vector3())
        const r = lamp.scale.x
        // Center within one lamp radius (plus 10 cm) of the skin: flush, not floating.
        expect(gap(p, tris), `${spec.id} ${lamp.name}`).toBeLessThan(r + 0.1)
        // Scaled to the airframe, never bigger than the fuselage is wide.
        // Small point lamps: fist-sized, scaled to the fuselage, never a glowing ball.
        expect(r, `${spec.id} ${lamp.name} size`).toBeLessThanOrEqual(Math.min(0.35, Math.max(0.12, spec.rx * 0.15)))
        // Worst-case runtime glow (night x strobe peak) still sits on the skin.
        const peak = r * 1.25 * 1.3
        expect(gap(p, tris), `${spec.id} ${lamp.name} peak`).toBeLessThan(peak + 0.1)
      }
      const port = lamps.find((l) => l.name === 'nav-port')
      const star = lamps.find((l) => l.name === 'nav-starboard')
      const tail = lamps.find((l) => l.name === 'nav-tail')
      if (port && star) {
        expect(port.position.z).toBeLessThan(0)
        expect(star.position.z).toBeGreaterThan(0)
        if (spec.family !== 'helo') {
          expect(Math.abs(port.position.z)).toBeGreaterThan(spec.spanM * 0.45)
        }
      }
      if (tail) expect(tail.position.x).toBeLessThan(-spec.lengthM * 0.45)
    })
  }
})
