/**
 * Building-lot lamps that really light the ground at night. Every lamp head a
 * building model records (model.userData.lamps, model-local) becomes a
 * candidate; each frame the nearest N to the camera focus get one of a fixed
 * pool of PointLights. The pool size is fixed per quality preset so shaders
 * never recompile as the camera moves; by day the lights sit at intensity 0.
 */
import * as THREE from 'three'

export class LotLamps {
  readonly group = new THREE.Group()
  private lights: THREE.PointLight[] = []
  private spots: THREE.Vector3[] = []
  private picked: number[] = []

  constructor(budget: number) {
    this.group.name = 'lot-lamps'
    this.setBudget(budget)
  }

  setBudget(n: number): void {
    for (const l of this.lights) {
      l.removeFromParent()
      l.dispose()
    }
    this.lights = []
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight('#ffd9a0', 0, 34, 1.3)
      l.castShadow = false
      this.lights.push(l)
      this.group.add(l)
    }
  }

  get budget(): number {
    return this.lights.length
  }

  /** Re-collect lamp heads from the building roots (call after tiles rebuild). */
  collect(root: THREE.Object3D): void {
    root.updateMatrixWorld(true)
    this.spots = []
    root.traverse((o) => {
      const lamps = o.userData?.lamps as number[][] | undefined
      if (!lamps) return
      for (const [x, y, z] of lamps) this.spots.push(new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld))
    })
  }

  get count(): number {
    return this.spots.length
  }

  /** Light the nearest lamps to `focus`. night: 0 day … 1 full night. */
  update(focus: THREE.Vector3, night: number): void {
    const n = this.lights.length
    if (!n) return
    const k = Math.max(0, (night - 0.25) / 0.75)
    if (k <= 0 || !this.spots.length) {
      for (const l of this.lights) l.intensity = 0
      return
    }
    // Partial selection of the n nearest (n is tiny).
    this.picked.length = 0
    const d: number[] = []
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i]!
      const dd = (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2
      if (this.picked.length < n) {
        this.picked.push(i)
        d.push(dd)
        continue
      }
      let worst = 0
      for (let j = 1; j < n; j++) if (d[j]! > d[worst]!) worst = j
      if (dd < d[worst]!) {
        this.picked[worst] = i
        d[worst] = dd
      }
    }
    for (let j = 0; j < n; j++) {
      const l = this.lights[j]!
      const i = this.picked[j]
      if (i === undefined) {
        l.intensity = 0
        continue
      }
      l.position.copy(this.spots[i]!)
      l.position.y -= 0.15
      l.intensity = 90 * k
    }
  }
}
