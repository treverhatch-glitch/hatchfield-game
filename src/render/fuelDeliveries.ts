/**
 * Draws the fuel snapshot: a tanker on the public road, and the fill hose
 * locked from farm_fill to truck_fill while it is docked.
 * The sim never imports this file.
 */
import * as THREE from 'three'
import type { FuelView } from '../fuel/index.ts'
import { CELL, WORLD_PER_METER } from './aircraft/specs.ts'
import { SIZE } from '../game/types.ts'
import { FARM_SOCKETS } from './socketLayout.ts'
import { disposeVehicleRig, vehicleRig } from './vehicles.ts'

function atCell(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3((c - (SIZE - 1) / 2) * CELL, y, (r - (SIZE - 1) / 2) * CELL)
}

function along(path: FuelView['path'], progress: number): { c: number; r: number; heading: number } {
  if (!path.length) return { c: 0, r: 0, heading: 0 }
  if (path.length === 1) return { c: path[0].c, r: path[0].r, heading: 0 }
  const t = Math.max(0, Math.min(1, progress)) * (path.length - 1)
  const i = Math.min(path.length - 2, Math.floor(t))
  const f = t - i
  const a = path[i]
  const b = path[i + 1]
  return {
    c: a.c + (b.c - a.c) * f,
    r: a.r + (b.r - a.r) * f,
    heading: Math.atan2(b.r - a.r, b.c - a.c),
  }
}

function hoseBetween(a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh {
  const mid = a.clone().lerp(b, 0.5)
  mid.y = Math.min(a.y, b.y) + Math.max(0.15, a.distanceTo(b) * 0.18)
  const curve = new THREE.CatmullRomCurve3([a, mid, b])
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 8, 0.035 * WORLD_PER_METER, 5, false),
    new THREE.MeshLambertMaterial({ color: '#2a2e28' }),
  )
  mesh.name = 'farm-hose'
  return mesh
}

export class FuelLayer {
  readonly group = new THREE.Group()
  private tanker: THREE.Group | null = null
  private pipe: THREE.Mesh | null = null
  private pipeKey = ''
  private hose: THREE.Mesh | null = null

  sync(view: FuelView): void {
    const rolling = view.queue.find((row) => row.mode === 'tanker' && row.state === 'road')
    const docked = view.queue.find((row) => row.mode === 'tanker' && row.docked && view.dock)
    if (!rolling && !docked) {
      this.dropTanker()
      this.clearHose()
    } else {
      const rig = this.ensureTanker()
      if (docked && view.farm) {
        if (!this.hose) this.parkAtFarm(rig, view)
      } else if (rolling) {
        this.clearHose()
        const pose = along(view.path, rolling.progress)
        rig.position.copy(atCell(pose.c, pose.r, 0))
        rig.rotation.set(0, -pose.heading, 0)
      }
    }
    const pipeOn = view.queue.some((row) => row.mode === 'pipeline' && row.state !== 'wait_cash')
    if (pipeOn && view.path.length > 1) this.ensurePipe(view)
    else this.dropPipe()
  }

  dispose(): void {
    this.dropTanker()
    this.dropPipe()
    this.clearHose()
  }

  private ensureTanker(): THREE.Group {
    if (this.tanker) return this.tanker
    const rig = vehicleRig('fuel', '#c9a227', WORLD_PER_METER)
    rig.name = 'fuel-delivery'
    this.tanker = rig
    this.group.add(rig)
    return rig
  }

  private parkAtFarm(rig: THREE.Group, view: FuelView): void {
    const farm = view.farm
    if (!farm) return
    const bay = FARM_SOCKETS.farm_bay
    const fill = FARM_SOCKETS.farm_fill
    const origin = atCell(farm.c, farm.r, 0)
    const bayWorld = origin.clone().add(new THREE.Vector3(bay[0], bay[1], bay[2]).multiplyScalar(WORLD_PER_METER))
    const fillWorld = origin.clone().add(new THREE.Vector3(fill[0], fill[1], fill[2]).multiplyScalar(WORLD_PER_METER))
    const face = view.path.length > 1 ? view.path[view.path.length - 1] : farm
    const prev = view.path.length > 1 ? view.path[view.path.length - 2] : farm
    rig.rotation.set(0, -Math.atan2(face.r - prev.r, face.c - prev.c), 0)
    rig.position.copy(bayWorld)
    rig.updateMatrixWorld(true)
    const inlet = rig.getObjectByName('truck_fill')
    if (inlet) {
      const inletWorld = inlet.getWorldPosition(new THREE.Vector3())
      rig.position.add(bayWorld.clone().sub(inletWorld))
      rig.updateMatrixWorld(true)
      const hoseEnd = inlet.getWorldPosition(new THREE.Vector3())
      this.clearHose()
      this.hose = hoseBetween(fillWorld, hoseEnd)
      this.group.add(this.hose)
    }
  }

  private ensurePipe(view: FuelView): void {
    const key = `${view.path.map((cell) => `${cell.c},${cell.r}`).join('|')}:${view.farm ? `${view.farm.c},${view.farm.r}` : ''}`
    if (this.pipe && this.pipeKey === key) return
    this.dropPipe()
    this.pipeKey = key
    const points = view.path.map((cell) => atCell(cell.c, cell.r, 0.35))
    if (view.farm) {
      const fill = FARM_SOCKETS.farm_fill
      points.push(
        atCell(view.farm.c, view.farm.r, 0).add(
          new THREE.Vector3(fill[0], fill[1], fill[2]).multiplyScalar(WORLD_PER_METER),
        ),
      )
    }
    const curve = new THREE.CatmullRomCurve3(points)
    this.pipe = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), 0.08 * WORLD_PER_METER, 5, false),
      new THREE.MeshLambertMaterial({ color: '#6d5a32' }),
    )
    this.pipe.name = 'fuel-pipeline'
    this.group.add(this.pipe)
  }

  private dropTanker(): void {
    if (!this.tanker) return
    this.group.remove(this.tanker)
    disposeVehicleRig(this.tanker)
    this.tanker = null
  }

  private dropPipe(): void {
    if (!this.pipe) return
    this.group.remove(this.pipe)
    this.pipe.geometry.dispose()
    const mat = this.pipe.material
    if (!Array.isArray(mat)) mat.dispose()
    this.pipe = null
    this.pipeKey = ''
  }

  private clearHose(): void {
    if (!this.hose) return
    this.group.remove(this.hose)
    this.hose.geometry.dispose()
    const mat = this.hose.material
    if (!Array.isArray(mat)) mat.dispose()
    this.hose = null
  }
}
