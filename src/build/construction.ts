/**
 * Construction stages for placed buildings. A site rises in three visible stages,
 * driven by the existing BuildSite timer (elapsed / duration):
 *   foundation (0 → 0.25)  concrete pad pours, scaffold poles go up
 *   frame      (0.25 → 0.6) steel frame (the real model's edges) climbs floor by floor
 *   finish     (0.6 → 1)   the real finished model is revealed bottom-up, scaffold comes down
 * The finished model is the same mesh World#building makes, so a site always matches
 * what you get when the timer ends.
 */
import * as THREE from 'three'

export type ConstructionStage = 'foundation' | 'frame' | 'finish' | 'done'

export const FOUNDATION_END = 0.25
export const FRAME_END = 0.6

export interface StageInfo {
  stage: ConstructionStage
  /** 0..1 within the current stage. */
  local: number
  /** Concrete pad height factor 0..1. */
  pad: number
  /** Fraction of model height covered by the steel frame. */
  frame: number
  /** Fraction of model height revealed as the finished model. */
  finish: number
  /** Scaffold visibility 0..1. */
  scaffold: number
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
const ease = (t: number) => t * t * (3 - 2 * t)

export function stageAt(progress: number): StageInfo {
  const p = clamp01(progress)
  if (p >= 1) return { stage: 'done', local: 1, pad: 1, frame: 1, finish: 1, scaffold: 0 }
  if (p < FOUNDATION_END) {
    const local = p / FOUNDATION_END
    return { stage: 'foundation', local, pad: ease(local), frame: 0, finish: 0, scaffold: ease(local) }
  }
  if (p < FRAME_END) {
    const local = (p - FOUNDATION_END) / (FRAME_END - FOUNDATION_END)
    return { stage: 'frame', local, pad: 1, frame: ease(local), finish: 0, scaffold: 1 }
  }
  const local = (p - FRAME_END) / (1 - FRAME_END)
  return {
    stage: 'finish',
    local,
    pad: 1,
    frame: 1,
    finish: ease(local),
    scaffold: local < 0.8 ? 1 : 1 - (local - 0.8) / 0.2,
  }
}

/** Progress of a site timer, safe for zero/NaN durations. */
export function siteProgress(elapsed: number, duration: number): number {
  if (!(duration > 0)) return 1
  return clamp01(elapsed / duration)
}

/** Flat tiles (paving) have no frame stage worth drawing; they just pour. */
export function isFlat(height: number): boolean {
  return height < 0.6
}

const steel = () => new THREE.LineBasicMaterial({ color: '#d9822b', transparent: true, opacity: 0.95 })

/**
 * One building under construction. Owns the finished model (with cloned, clipped
 * materials), a frame made from the model's edges, a pad and scaffolding.
 */
export class ConstructionPiece {
  readonly root = new THREE.Group()
  private readonly model: THREE.Object3D
  private readonly frameLines: THREE.LineSegments[] = []
  private readonly pad: THREE.Mesh
  private readonly scaffold = new THREE.Group()
  private readonly finishPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  private readonly framePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  private readonly owned: { dispose(): void }[] = []
  readonly baseY: number
  readonly height: number

  constructor(model: THREE.Object3D) {
    this.model = model
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    if (box.isEmpty()) box.set(model.position.clone(), model.position.clone().add(new THREE.Vector3(0, 1, 0)))
    this.baseY = box.min.y
    this.height = Math.max(0.05, box.max.y - box.min.y)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Finished model: clone materials so clipping never touches the shared live palette.
    model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const clip = (m: THREE.Material) => {
        const c = m.clone()
        c.clippingPlanes = [this.finishPlane]
        c.clipShadows = true
        // Open-topped while rising: show inner walls instead of a hollow gap.
        c.side = THREE.DoubleSide
        this.owned.push(c)
        return c
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clip) : clip(mesh.material)
      if (!isFlat(this.height)) {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 28)
        const mat = steel()
        mat.clippingPlanes = [this.framePlane]
        const lines = new THREE.LineSegments(edges, mat)
        lines.matrixAutoUpdate = false
        mesh.updateWorldMatrix(true, false)
        lines.matrix.copy(mesh.matrixWorld)
        this.frameLines.push(lines)
        this.owned.push(edges, mat)
      }
    })
    this.root.add(model)
    for (const l of this.frameLines) this.root.add(l)

    // Concrete pad slightly larger than the footprint.
    const padGeo = new THREE.BoxGeometry(size.x * 1.06 + 0.2, 0.14, size.z * 1.06 + 0.2)
    const padMat = new THREE.MeshStandardMaterial({ color: '#a9a49a', roughness: 0.92 })
    this.pad = new THREE.Mesh(padGeo, padMat)
    this.pad.position.set(center.x, this.baseY + 0.07, center.z)
    this.pad.receiveShadow = true
    this.owned.push(padGeo, padMat)
    this.root.add(this.pad)

    if (!isFlat(this.height)) this.buildScaffold(size, center)
    this.root.add(this.scaffold)
    this.update(0)
  }

  private buildScaffold(size: THREE.Vector3, center: THREE.Vector3) {
    const h = this.height * 1.08
    const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, h, 6)
    const poleMat = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.6, roughness: 0.4 })
    const plankMat = new THREE.MeshStandardMaterial({ color: '#b98a4e', roughness: 0.8 })
    const netMat = new THREE.MeshStandardMaterial({
      color: '#3f8f4d',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.owned.push(poleGeo, poleMat, plankMat, netMat)
    const hx = size.x / 2 + 0.18
    const hz = size.z / 2 + 0.18
    const nx = Math.max(2, Math.round(size.x / 0.9))
    const nz = Math.max(2, Math.round(size.z / 0.9))
    const addPole = (x: number, z: number) => {
      const p = new THREE.Mesh(poleGeo, poleMat)
      p.position.set(center.x + x, this.baseY + h / 2, center.z + z)
      p.castShadow = true
      this.scaffold.add(p)
    }
    for (let i = 0; i <= nx; i++) {
      const x = -hx + (2 * hx * i) / nx
      addPole(x, -hz)
      addPole(x, hz)
    }
    for (let i = 1; i < nz; i++) {
      const z = -hz + (2 * hz * i) / nz
      addPole(-hx, z)
      addPole(hx, z)
    }
    const levels = Math.max(1, Math.round(h / 0.7))
    for (let l = 1; l <= levels; l++) {
      const y = this.baseY + (h * l) / (levels + 0.3)
      for (const [w, d, x, z] of [
        [2 * hx, 0.22, 0, -hz],
        [2 * hx, 0.22, 0, hz],
        [0.22, 2 * hz, -hx, 0],
        [0.22, 2 * hz, hx, 0],
      ] as const) {
        const g = new THREE.BoxGeometry(w, 0.04, d)
        this.owned.push(g)
        const plank = new THREE.Mesh(g, plankMat)
        plank.position.set(center.x + x, y, center.z + z)
        this.scaffold.add(plank)
      }
    }
    // Safety netting on two faces for a readable silhouette.
    for (const [w, x, z, ry] of [
      [2 * hx, 0, hz + 0.02, 0],
      [2 * hz, hx + 0.02, 0, Math.PI / 2],
    ] as const) {
      const g = new THREE.PlaneGeometry(w, h * 0.85)
      this.owned.push(g)
      const net = new THREE.Mesh(g, netMat)
      net.position.set(center.x + x, this.baseY + h * 0.5, center.z + z)
      net.rotation.y = ry
      this.scaffold.add(net)
    }
  }

  /** Apply a 0..1 progress. Cheap: only plane constants, scales and visibility change. */
  update(progress: number): StageInfo {
    const s = stageAt(progress)
    this.pad.scale.y = Math.max(0.05, s.pad)
    this.pad.visible = s.stage !== 'done'
    this.finishPlane.constant = this.baseY + this.height * s.finish + (s.finish > 0 ? 0.001 : -0.01)
    this.framePlane.constant = this.baseY + this.height * s.frame + 0.001
    this.model.visible = s.finish > 0 || isFlat(this.height)
    if (isFlat(this.height)) this.finishPlane.constant = this.baseY + this.height * Math.max(s.pad, s.finish) + 0.001
    for (const l of this.frameLines) l.visible = s.frame > 0 && s.stage !== 'done'
    this.scaffold.visible = s.scaffold > 0.02
    this.scaffold.scale.y = 1
    this.scaffold.position.y = (1 - Math.min(1, s.scaffold)) * -this.height
    return s
  }

  dispose() {
    for (const o of this.owned) o.dispose()
    this.root.clear()
  }
}

/** Live construction pieces keyed by site id + cell. Rebuilt only when the site list changes. */
export class ConstructionLayer {
  readonly group = new THREE.Group()
  private pieces = new Map<string, { piece: ConstructionPiece; siteId: string }>()

  private readonly make: (tile: string, c: number, r: number) => THREE.Object3D | null

  constructor(make: (tile: string, c: number, r: number) => THREE.Object3D | null) {
    this.make = make
    this.group.name = 'construction'
  }

  sync(sites: readonly { id: string; tile: string; cells: { c: number; r: number }[]; elapsed: number; duration: number }[]) {
    const live = new Set<string>()
    for (const site of sites) {
      const p = siteProgress(site.elapsed, site.duration)
      for (const cell of site.cells) {
        const key = `${site.id}@${cell.c},${cell.r}`
        live.add(key)
        let entry = this.pieces.get(key)
        if (!entry) {
          const model = this.make(site.tile, cell.c, cell.r)
          if (!model) continue
          entry = { piece: new ConstructionPiece(model), siteId: site.id }
          this.pieces.set(key, entry)
          this.group.add(entry.piece.root)
        }
        entry.piece.update(p)
      }
    }
    for (const [key, entry] of this.pieces) {
      if (live.has(key)) continue
      this.group.remove(entry.piece.root)
      entry.piece.dispose()
      this.pieces.delete(key)
    }
  }

  get size() {
    return this.pieces.size
  }

  dispose() {
    for (const e of this.pieces.values()) e.piece.dispose()
    this.pieces.clear()
    this.group.clear()
  }
}
