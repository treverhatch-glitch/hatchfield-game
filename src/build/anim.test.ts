import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { AnimSystem, buildingSignals } from './anim'
import { buildModel } from './models'

function parts(root: THREE.Object3D, kind?: string) {
  const out: THREE.Object3D[] = []
  root.traverse((o) => {
    const a = o.userData.anim
    if (a && (!kind || a.kind === kind)) out.push(o)
  })
  return out
}

function run(sys: AnimSystem, sig: Record<string, number>, secs = 4, camera?: THREE.Camera) {
  for (let i = 0; i < secs * 30; i++) sys.update(1 / 30, sig, camera)
}

describe('building animation', () => {
  it('every animated family tags movable parts', () => {
    for (const id of ['hangar', 'cargo', 'guard', 'atc_approach', 'tower', 'fuel', 'hydrant', 'tilt_tray', 'bags', 'fire', 'kitchen', 'helipad', 'deice', 'mro', 'nighthub', 'travelator']) {
      expect(parts(buildModel(id)!).length, id).toBeGreaterThan(0)
    }
  })

  it('hangar doors stay shut when idle and slide open when an aircraft is in work', () => {
    const root = new THREE.Group()
    root.add(buildModel('hangar')!)
    const sys = new AnimSystem()
    sys.collect(root)
    const leaf = parts(root, 'slide')[0]!
    const x0 = leaf.position.x
    run(sys, { hangarBusy: 0 })
    expect(leaf.position.x).toBeCloseTo(x0, 3)
    run(sys, { hangarBusy: 1 })
    expect(Math.abs(leaf.position.x - x0)).toBeGreaterThan(0.5)
  })

  it('guard boom lifts with gate traffic; cargo shutters roll up with dock activity', () => {
    const root = new THREE.Group()
    root.add(buildModel('guard')!, buildModel('cargo')!)
    const sys = new AnimSystem()
    sys.collect(root)
    const boom = parts(root.children[0]!, 'rot')[0]!
    const shutter = parts(root.children[1]!, 'roll')[0]!
    run(sys, { gateTraffic: 1, dockActive: 1 })
    expect(boom.rotation.z).toBeGreaterThan(1.0)
    expect(shutter.scale.y).toBeLessThan(0.3)
  })

  it('radar rotates continuously; tilt trays only run when bags flow', () => {
    const root = new THREE.Group()
    root.add(buildModel('atc_approach')!, buildModel('tilt_tray')!)
    const sys = new AnimSystem()
    sys.collect(root)
    const radar = parts(root.children[0]!, 'spin').find((o) => (o as THREE.Mesh).geometry instanceof THREE.BoxGeometry && o.position.y > 2.5)!
    const trays = parts(root.children[1]!, 'spin').find((o) => o.type === 'Group')!
    run(sys, { always: 1, bagsFlow: 0 })
    const r1 = radar.rotation.y
    expect(Math.abs(r1)).toBeGreaterThan(1)
    expect(Math.abs(trays.rotation.y)).toBeLessThan(0.01)
    run(sys, { always: 1, bagsFlow: 1 })
    expect(Math.abs(trays.rotation.y)).toBeGreaterThan(0.5)
  })

  it('pauses roots outside the camera frustum', () => {
    const root = new THREE.Group()
    root.add(buildModel('hangar')!)
    const sys = new AnimSystem()
    sys.collect(root)
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    cam.position.set(0, 10, 40)
    cam.lookAt(0, 10, 80) // facing away
    const leaf = parts(root, 'slide')[0]!
    const x0 = leaf.position.x
    run(sys, { hangarBusy: 1 }, 3, cam)
    expect(sys.lastActive).toBe(0)
    expect(leaf.position.x).toBe(x0)
    cam.lookAt(0, 0, 0)
    run(sys, { hangarBusy: 1 }, 3, cam)
    expect(sys.lastActive).toBe(1)
    expect(leaf.position.x).not.toBe(x0)
  })

  it('signals come from sim state', () => {
    const quiet = buildingSignals({ weather: 'clear', trucks: [], flights: [], isNight: () => false })
    expect(quiet.fireDispatch).toBe(0)
    expect(quiet.bagsFlow).toBe(0)
    const busy = buildingSignals({
      weather: 'storm',
      isNight: () => true,
      trucks: [{ kind: 'fire' }, { kind: 'fuel' }, { kind: 'citycargo' }, { kind: 'deice' }],
      flights: [{ phase: 'board' }, { phase: 'mx_bay' }],
    })
    expect(busy).toMatchObject({ fireDispatch: 1, fuelFlow: 1, dockActive: 1, gateTraffic: 1, deicing: 1, bagsFlow: 1, hangarBusy: 1, night: 1, wind: 1 })
  })
})
