/**
 * Shared building animation system. Models tag movable parts with
 * `userData.anim` (see `animate()`); the World collects them once per tile rebuild
 * and calls `update()` per frame with sim-derived signals. Roots outside the
 * camera frustum are skipped, so idle cost is one sphere test per building.
 */
import * as THREE from 'three'

export type AnimSignal =
  | 'always'
  | 'night'
  | 'wind'
  | 'bagsFlow'
  | 'fuelFlow'
  | 'fireDispatch'
  | 'gateTraffic'
  | 'dockActive'
  | 'hangarBusy'
  | 'deicing'

export type AnimKind = 'spin' | 'slide' | 'roll' | 'rot' | 'blink' | 'sway' | 'cycle'

export interface AnimSpec {
  kind: AnimKind
  signal: AnimSignal
  axis?: 'x' | 'y' | 'z'
  /** slide/cycle: distance; rot: radians; roll: part height. */
  amount?: number
  /** spin: rad/s; cycle: loops/s; blink: Hz. */
  rate?: number
  phase?: number
  /** Service-point index this part belongs to (only that dock/bay/door opens). */
  point?: number
}

/** Tag a part as movable. Returns it for chaining. */
export function animate<T extends THREE.Object3D>(o: T, spec: AnimSpec): T {
  o.userData.anim = spec
  return o
}

export type Signals = Partial<Record<AnimSignal, number>> & { windDir?: number }

interface Part {
  o: THREE.Object3D
  spec: AnimSpec
  pos: THREE.Vector3
  rot: THREE.Euler
  scl: THREE.Vector3
  state: number
}

/** Per-building overrides: signals for this site plus which service points are in use. */
export type SiteSignals = Signals & { points?: readonly boolean[] }

interface Root {
  key?: string
  root: THREE.Object3D
  sphere: THREE.Sphere
  parts: Part[]
}

/** What the sim currently implies for each signal (0..1). Pure; feed it a Game-like view. */
export function buildingSignals(g: {
  isNight?: () => boolean
  weather?: string
  trucks?: readonly { kind: string }[]
  flights?: readonly { phase: string }[]
}): Signals {
  const trucks = g.trucks ?? []
  const has = (...k: string[]) => (trucks.some((t) => k.includes(t.kind)) ? 1 : 0)
  const phases = new Set((g.flights ?? []).map((f) => f.phase))
  const w = g.weather ?? 'clear'
  return {
    always: 1,
    night: g.isNight?.() ? 1 : 0,
    wind: w === 'storm' ? 1 : w === 'rain' ? 0.6 : w === 'fog' ? 0.15 : 0.35,
    windDir: w === 'storm' ? 1.2 : 0.4,
    bagsFlow: has('bags') || phases.has('board') || phases.has('deboard') ? 1 : 0,
    fuelFlow: has('fuel'),
    fireDispatch: has('fire'),
    gateTraffic: has('citycargo', 'delivery', 'contractor', 'police'),
    dockActive: has('citycargo', 'delivery'),
    hangarBusy: phases.has('mx_bay') || phases.has('mx_taxi') || phases.has('mx_return') ? 1 : 0,
    deicing: has('deice') || w === 'storm' ? 1 : 0,
  }
}

const YARD_SIGNAL: Record<string, AnimSignal> = {
  fuel: 'fuelFlow',
  bags: 'bagsFlow',
  cargo: 'dockActive',
  fire: 'fireDispatch',
  deice: 'deicing',
}

/**
 * Signals for one building from its own service-point occupancy: only the
 * dock / bay / door actually in use opens. Hangars and MRO read their own
 * maintenance slot.
 */
export function siteSignals(
  tile: string | undefined,
  points: readonly boolean[],
  hangarBusy?: boolean,
): SiteSignals | undefined {
  if (!tile) return undefined
  if (tile === 'hangar' || tile === 'mro') {
    const busy = hangarBusy ? 1 : 0
    return { hangarBusy: busy, points: points.length ? points : undefined }
  }
  const sig = YARD_SIGNAL[tile]
  if (!sig) return undefined
  const any = points.some(Boolean) ? 1 : 0
  return { [sig]: any, points } as SiteSignals
}

const tmpBox = new THREE.Box3()
const frustum = new THREE.Frustum()
const projView = new THREE.Matrix4()

export class AnimSystem {
  private roots: Root[] = []
  time = 0
  /** Roots updated on the last frame (for tests / perf HUD). */
  lastActive = 0

  get partCount(): number {
    return this.roots.reduce((n, r) => n + r.parts.length, 0)
  }

  clear() {
    this.roots = []
  }

  /** Collect every tagged part under each direct child of `group` (one root per building). */
  collect(group: THREE.Object3D) {
    this.clear()
    for (const child of group.children) this.add(child)
  }

  add(root: THREE.Object3D) {
    const parts: Part[] = []
    root.traverse((o) => {
      const spec = o.userData?.anim as AnimSpec | undefined
      if (spec) parts.push({ o, spec, pos: o.position.clone(), rot: o.rotation.clone(), scl: o.scale.clone(), state: 0 })
    })
    if (!parts.length) return
    root.updateWorldMatrix(true, true)
    tmpBox.setFromObject(root)
    const sphere = tmpBox.isEmpty() ? new THREE.Sphere(root.getWorldPosition(new THREE.Vector3()), 10) : tmpBox.getBoundingSphere(new THREE.Sphere())
    this.roots.push({ key: root.userData?.cellKey as string | undefined, root, sphere, parts })
  }

  update(dt: number, sig: Signals, camera?: THREE.Camera, site?: (key: string) => SiteSignals | undefined) {
    this.time += dt
    if (camera) {
      camera.updateMatrixWorld()
      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(projView)
    }
    let active = 0
    const ease = Math.min(1, dt * 1.6)
    for (const r of this.roots) {
      if (camera && !frustum.intersectsSphere(r.sphere)) continue
      active++
      const over = r.key && site ? site(r.key) : undefined
      const s = over ? { ...sig, ...over } : sig
      for (const p of r.parts) {
        const pts = over?.points
        const target =
          pts && p.spec.point != null && p.spec.signal !== 'always'
            ? pts[p.spec.point] ? 1 : 0
            : s[p.spec.signal] ?? 0
        p.state += (target - p.state) * ease
        apply(p, dt, this.time, s)
      }
    }
    this.lastActive = active
  }
}

function apply(p: Part, dt: number, t: number, sig: Signals) {
  const { o, spec } = p
  const ax = spec.axis ?? 'y'
  const amt = spec.amount ?? 1
  const s = p.state
  switch (spec.kind) {
    case 'spin':
      o.rotation[ax] += (spec.rate ?? 1) * dt * s
      break
    case 'slide':
      o.position[ax] = p.pos[ax] + amt * s
      break
    case 'rot':
      o.rotation[ax] = p.rot[ax] + amt * s
      break
    case 'roll':
      // Shutter rolls up into its head box: top edge stays put.
      o.scale.y = p.scl.y * (1 - 0.85 * s)
      o.position.y = p.pos.y + amt * 0.425 * s
      break
    case 'blink': {
      const hz = spec.rate ?? 1
      o.visible = s < 0.5 ? true : ((t * hz + (spec.phase ?? 0)) % 1) < 0.5
      break
    }
    case 'sway':
      o.rotation.y = p.rot.y + (sig.windDir ?? 0) * s + Math.sin(t * (1 + 3 * s)) * 0.25 * s
      o.rotation.x = p.rot.x - (1 - s) * 0.9
      break
    case 'cycle':
      if (s > 0.05) {
        const f = ((t * (spec.rate ?? 0.5) + (spec.phase ?? 0)) % 1 + 1) % 1
        o.position[ax] = p.pos[ax] + amt * f
      }
      break
  }
}
