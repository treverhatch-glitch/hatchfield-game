/**
 * Visible service actions at building service points (Manor Lords feel):
 * fuel hose + nozzle glow at the farm, bags sliding off carts into sort doors,
 * catering scissor lift rising at the kitchen bay, crates rolling off a
 * backed-in cargo truck, glycol mist at the de-ice pad, passengers boarding
 * buses at the kerb, light bars on tenders leaving the fire bays, and a tow
 * tug ahead of aircraft taxiing into hangars / MRO.
 */
import * as THREE from 'three'
import { WORLD_PER_METER } from './aircraft/index'

type ToWorld = (c: number, r: number, y?: number) => THREE.Vector3
const wu = (m: number) => m * WORLD_PER_METER

interface YardPose {
  key: string
  action: string | null
  phase: string
  progress: number
  heading: number
  point: number
}
interface FxGame {
  trucks: readonly { id: string; x: number; y: number; yard?: YardPose }[]
  flights: readonly { id: string; phase: string; x: number; y: number; path: readonly { c: number; r: number }[] }[]
  yard: { spec(key: string): { points: { c: number; r: number }[] } | undefined }
  tugPoses?: () => { id: string; flightId: string; key: string; phase: string; c: number; r: number; heading: number }[]
}

const M = {
  hose: new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.6 }),
  glow: new THREE.MeshBasicMaterial({ color: '#ffd166' }),
  bag: new THREE.MeshStandardMaterial({ color: '#3ec6ff', roughness: 0.5 }),
  bag2: new THREE.MeshStandardMaterial({ color: '#ffb703', roughness: 0.5 }),
  lift: new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.45 }),
  scissor: new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.3, roughness: 0.5 }),
  crate: new THREE.MeshStandardMaterial({ color: '#9a7a40', roughness: 0.6 }),
  mist: new THREE.MeshBasicMaterial({ color: '#c8f1ff', transparent: true, opacity: 0.35, depthWrite: false }),
  pax: [
    new THREE.MeshStandardMaterial({ color: '#3d6a8a' }),
    new THREE.MeshStandardMaterial({ color: '#c0392b' }),
    new THREE.MeshStandardMaterial({ color: '#27ae60' }),
    new THREE.MeshStandardMaterial({ color: '#8e44ad' }),
  ],
  red: new THREE.MeshBasicMaterial({ color: '#ff3b30' }),
  blue: new THREE.MeshBasicMaterial({ color: '#3b82ff' }),
  tug: new THREE.MeshStandardMaterial({ color: '#f2d24a', roughness: 0.5 }),
  bar: new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 }),
}
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
const unitCone = new THREE.ConeGeometry(0.5, 1, 10, 1, true)

function bx(g: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, name?: string) {
  const o = new THREE.Mesh(unitBox, m)
  o.scale.set(w, h, d)
  if (name) o.name = name
  g.add(o)
  return o
}

/** Build the fx group for one action, in metres-scaled local space (+x = vehicle nose). */
function makeFx(action: string): THREE.Group {
  const g = new THREE.Group()
  g.userData.action = action
  switch (action) {
    case 'refuel': {
      // Sagging hose rebuilt as a tube when its reach changes; reel drum on the truck side.
      const hose = new THREE.Mesh(new THREE.BufferGeometry(), M.hose)
      hose.name = 'hose'
      hose.castShadow = true
      g.add(hose)
      const reel = new THREE.Mesh(unitCyl, M.bar)
      reel.name = 'reel'
      reel.scale.set(wu(1.1), wu(0.8), wu(1.1))
      reel.rotation.x = Math.PI / 2
      reel.position.set(-wu(1.2), wu(1.3), 0)
      g.add(reel)
      bx(g, M.glow, wu(0.5), wu(0.5), wu(0.5), 'nozzle')
      break
    }
    case 'unload':
      for (let i = 0; i < 4; i++) bx(g, i % 2 ? M.bag2 : M.bag, wu(0.7), wu(0.5), wu(0.4), 'item')
      break
    case 'load': {
      const lift = new THREE.Group()
      lift.name = 'lift'
      bx(lift, M.lift, wu(4.2), wu(2.2), wu(2.3)).position.y = wu(1.1)
      g.add(lift)
      for (let i = 0; i < 2; i++) bx(g, M.scissor, wu(4.0), wu(0.12), wu(0.15), `x${i}`)
      break
    }
    case 'backin':
      for (let i = 0; i < 3; i++) bx(g, M.crate, wu(1.1), wu(1.0), wu(1.1), 'item')
      break
    case 'spray': {
      const cone = new THREE.Mesh(unitCone, M.mist)
      cone.name = 'mist'
      g.add(cone)
      break
    }
    case 'park':
    case 'board':
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(unitCyl, M.pax[i % M.pax.length]!)
        p.scale.set(wu(0.5), wu(1.75), wu(0.5))
        p.name = 'pax'
        g.add(p)
      }
      break
    case 'exit':
      bx(g, M.red, wu(0.6), wu(0.3), wu(0.5), 'l0')
      bx(g, M.blue, wu(0.6), wu(0.3), wu(0.5), 'l1')
      break
  }
  return g
}

function makeTug(): THREE.Group {
  const g = new THREE.Group()
  bx(g, M.tug, wu(6), wu(1.6), wu(3)).position.y = wu(0.8)
  bx(g, M.bar, wu(5), wu(0.2), wu(0.25)).position.set(wu(5.4), wu(0.6), 0)
  return g
}

export class ServiceFx {
  private fx = new Map<string, THREE.Group>()
  private tugs = new Map<string, THREE.Group>()
  private time = 0
  private parent: THREE.Object3D
  private toWorld: ToWorld
  constructor(parent: THREE.Object3D, toWorld: ToWorld) {
    this.parent = parent
    this.toWorld = toWorld
  }

  /** Live fx count (tests / perf). */
  get count() {
    return this.fx.size + this.tugs.size
  }

  sync(game: FxGame, dt: number) {
    this.time += dt
    const t = this.time
    const seen = new Set<string>()
    for (const tr of game.trucks) {
      const y = tr.yard
      if (!y || !y.action || (y.phase !== 'work' && !(y.action === 'exit' && y.phase === 'exit'))) continue
      const id = `${tr.id}:${y.action}`
      seen.add(id)
      let g = this.fx.get(id)
      if (!g) {
        g = makeFx(y.action)
        this.fx.set(id, g)
        this.parent.add(g)
      }
      const at = this.toWorld(tr.x, tr.y, 0)
      g.position.copy(at)
      g.rotation.y = -y.heading
      const [kc, kr] = y.key.split(',').map(Number)
      g.updateMatrixWorld(true)
      // Building anchor in the fx group's local frame (hoses / items aim at it).
      const toB = g.worldToLocal(this.toWorld(kc!, kr!, 0))
      this.animate(g, y, t, toB, game, tr.x, tr.y)
    }
    for (const [id, g] of this.fx) if (!seen.has(id)) {
      const hose = g.getObjectByName('hose') as THREE.Mesh | undefined
      hose?.geometry.dispose()
      this.parent.remove(g)
      this.fx.delete(id)
    }
    // Tow tugs: yard vehicles at the hangar / MRO. They queue in the hangar's own
    // lane while the door is busy, hook up and lead the aircraft while towing,
    // then roll out the exit lane.
    const seenT = new Set<string>()
    const poses = game.tugPoses?.() ?? []
    const byFlight = new Map(game.flights.map((f) => [f.id, f]))
    for (const p of poses) {
      seenT.add(p.id)
      let g = this.tugs.get(p.id)
      if (!g) {
        g = makeTug()
        this.tugs.set(p.id, g)
        this.parent.add(g)
      }
      const f = byFlight.get(p.flightId)
      if (p.phase === 'work' && f && (f.phase === 'mx_taxi' || f.phase === 'mx_return')) {
        const end = f.path[f.path.length - 1] ?? { c: f.x, r: f.y }
        const dir = Math.atan2(end.r - f.y, end.c - f.x)
        const lead = 0.42
        g.position.copy(this.toWorld(f.x + Math.cos(dir) * lead, f.y + Math.sin(dir) * lead, 0))
        // Tug faces the aircraft (towbar toward the nose gear).
        g.rotation.y = -(dir + Math.PI)
      } else {
        g.position.copy(this.toWorld(p.c, p.r, 0))
        g.rotation.y = -p.heading
      }
    }
    // Saves without yard tugs (or tests): fall back to a tug leading each tow.
    if (!game.tugPoses) {
      for (const f of game.flights) {
        if (f.phase !== 'mx_taxi' && f.phase !== 'mx_return') continue
        seenT.add(f.id)
        let g = this.tugs.get(f.id)
        if (!g) {
          g = makeTug()
          this.tugs.set(f.id, g)
          this.parent.add(g)
        }
        const end = f.path[f.path.length - 1] ?? { c: f.x, r: f.y }
        const dir = Math.atan2(end.r - f.y, end.c - f.x)
        g.position.copy(this.toWorld(f.x + Math.cos(dir) * 0.42, f.y + Math.sin(dir) * 0.42, 0))
        g.rotation.y = -(dir + Math.PI)
      }
    }
    for (const [id, g] of this.tugs) if (!seenT.has(id)) {
      this.parent.remove(g)
      this.tugs.delete(id)
    }
  }

  private animate(g: THREE.Group, y: YardPose, t: number, toPoint: THREE.Vector3 | null, _g: FxGame, _x: number, _y: number) {
    const p = y.progress
    const items = g.children.filter((o) => o.name === 'item')
    switch (y.action) {
      case 'refuel': {
        // Hose pays out from the reel to the farm's hose stand (toward the tanks),
        // sags under its own weight, and reels back in as the transfer finishes.
        const hose = g.getObjectByName('hose') as THREE.Mesh
        const dir = toPoint ? new THREE.Vector3(toPoint.x, 0, toPoint.z) : new THREE.Vector3(-1, 0, 0)
        const full = THREE.MathUtils.clamp(dir.length() * 0.72, wu(8), wu(42))
        const pay = p < 0.12 ? p / 0.12 : p > 0.9 ? Math.max(0.08, (1 - p) / 0.1) : 1
        const len = full * pay
        dir.normalize()
        const key = Math.round(len / wu(0.5)) + ':' + Math.round(Math.atan2(dir.z, dir.x) * 40)
        if (hose.userData.key !== key) {
          hose.userData.key = key
          const a = new THREE.Vector3(-wu(1.2), wu(1.3), 0)
          const b = new THREE.Vector3(dir.x * len, wu(0.9), dir.z * len)
          const mid = a.clone().lerp(b, 0.5)
          mid.y = wu(0.15) // lies on the apron between truck and stand
          const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(wu(0.4)), mid, mid.clone().lerp(b, 0.5).setY(wu(0.35)), b])
          hose.geometry.dispose()
          hose.geometry = new THREE.TubeGeometry(curve, 28, wu(0.16), 7, false)
        }
        ;(g.getObjectByName('reel') as THREE.Mesh).rotation.y = -len / wu(0.6)
        const n = g.getObjectByName('nozzle')!
        n.position.set(dir.x * len, wu(0.9), dir.z * len)
        n.scale.setScalar(0.7 + 0.3 * Math.sin(t * 8))
        break
      }
      case 'unload':
      case 'backin':
        // Items stream out of the vehicle toward the door / dock (vehicle rear = −x).
        items.forEach((o, i) => {
          const f = ((t * 0.6 + i / items.length) % 1)
          const d = toPoint ? new THREE.Vector3(toPoint.x, 0, toPoint.z).normalize() : new THREE.Vector3(-1, 0, 0)
          const k = wu(2) + f * wu(5)
          o.position.set(d.x * k, wu(1.2) - f * wu(0.4), d.z * k)
          o.visible = p < 0.98
        })
        break
      case 'load': {
        const lift = g.getObjectByName('lift')!
        const h = wu(4.5) * Math.sin(Math.min(1, p) * Math.PI)
        lift.position.set(-wu(1.5), wu(1.4) + h, 0)
        for (let i = 0; i < 2; i++) {
          const x = g.getObjectByName(`x${i}`)!
          const ang = Math.atan2(h, wu(3.6))
          x.position.set(-wu(1.5), wu(1.4) + h / 2, 0)
          x.rotation.z = i ? ang : -ang
        }
        break
      }
      case 'spray': {
        const m = g.getObjectByName('mist')!
        const s = 1 + 0.15 * Math.sin(t * 9)
        m.scale.set(wu(5) * s, wu(7), wu(5) * s)
        m.position.set(wu(2), wu(5), 0)
        m.rotation.z = Math.PI * 0.85
        break
      }
      case 'park':
      case 'board': {
        let i = 0
        for (const o of g.children) {
          if (o.name !== 'pax') continue
          // Passengers walk from the kerb (side) into the bus door; queue thins as progress runs.
          const f = Math.min(1, p * 1.3 - i * 0.12)
          o.visible = f < 1 && f > -0.6
          const side = wu(5) * (1 - Math.max(0, f))
          o.position.set(wu(2) - i * wu(0.9) * (f < 0 ? 1 : 0.2), wu(0.9) + Math.abs(Math.sin(t * 6 + i)) * wu(0.1), side + wu(1.6))
          i++
        }
        break
      }
      case 'exit': {
        const on = Math.floor(t * 6) % 2
        const l0 = g.getObjectByName('l0')!
        const l1 = g.getObjectByName('l1')!
        l0.position.set(wu(1.5), wu(3.4), -wu(0.5))
        l1.position.set(wu(1.5), wu(3.4), wu(0.5))
        l0.visible = on === 0
        l1.visible = on === 1
        break
      }
    }
  }
}
