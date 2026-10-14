import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildAircraft } from './build'
import { MODEL_SPECS } from './specs'

const LIVERY = { body: '#ffffff', stripe: '#0b4ea2', tail: '#0b4ea2' } as never
const NOT_SKIN = /^(leg|wheel-well|bay-doors|nav-|strobe|beacon|landing-light)/

describe('landing gear is attached to the airframe', () => {
  for (const spec of Object.values(MODEL_SPECS)) {
    if (spec.skids) continue
    it(`${spec.id}: tyres on the ground, struts start inside the skin`, () => {
      const built = buildAircraft(spec, 'mid', LIVERY)
      built.group.updateMatrixWorld(true)
      const legs = built.gears.filter((g) => g.name.startsWith('gear-') && g.name !== 'gear-bay')
      expect(legs.length).toBeGreaterThan(0)
      const skin: THREE.Object3D[] = []
      built.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !NOT_SKIN.test(o.name) && (o.name === 'sponson' || !o.parent?.name.startsWith('gear'))) skin.push(o)
      })
      const ray = new THREE.Raycaster()
      for (const leg of legs) {
        const box = new THREE.Box3().setFromObject(leg)
        expect(Math.abs(box.min.y), `${spec.id} ${leg.name} tyre height`).toBeLessThan(0.05)
        const top = leg.getWorldPosition(new THREE.Vector3())
        ray.set(new THREE.Vector3(top.x, 0.01, top.z), new THREE.Vector3(0, 1, 0))
        const hit = ray.intersectObjects(skin, false)[0]
        expect(hit, `${spec.id} ${leg.name} has skin overhead`).toBeTruthy()
        // Strut top is at or above the skin it hangs from: no gap between leg and body.
        expect(top.y, `${spec.id} ${leg.name} strut reaches skin`).toBeGreaterThanOrEqual(hit!.point.y - 0.05)
      }
    })
  }
})
