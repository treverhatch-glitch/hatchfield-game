/**
 * Instanced people renderer: one InstancedMesh per body part, per-instance
 * colour, three detail levels chosen by camera distance. Joint poses are
 * computed once per person and shared by all of that person's parts.
 */
import * as THREE from 'three'
import { PEOPLE_CAPACITY, PEOPLE_LOD, WORK_POSE } from './config.ts'
import { assignPeopleLod, type LodLimits } from './lod.ts'
import { emitPerson, PART_DEFS, partGeometry, type PartDef } from './parts.ts'
import { InstancePool } from './pool.ts'
import { blendPose, copyPose, neutralPose, phaseRate, samplePose, type JointPose } from './pose.ts'
import type { PersonLook, PersonPose } from './types.ts'

export interface PeopleAgent {
  /** Stable id: animation phase is tracked per id. */
  id: string
  look: PersonLook
  /** World position of the feet. */
  x: number
  y: number
  z: number
  /** Rotation about +Y. 0 faces +z. */
  yaw: number
  pose: PersonPose
  /** Ground speed in m/s; drives stride rate. */
  speed: number
}

export interface PeopleStats {
  near: number
  mid: number
  far: number
  hidden: number
  /** Instances written across all part meshes this frame. */
  instances: number
  /** Instances dropped because a part mesh was full. */
  overflow: number
}

export interface PeopleRendererOptions {
  capacity?: number
  /** World units per metre. Distances for LOD are converted to metres. */
  unitsPerMeter?: number
  lod?: LodLimits
}

export class PeopleRenderer {
  readonly group = new THREE.Group()
  readonly stats: PeopleStats = { near: 0, mid: 0, far: 0, hidden: 0, instances: 0, overflow: 0 }
  private readonly meshes = new Map<string, THREE.InstancedMesh>()
  private readonly pool: InstancePool
  private readonly material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true })
  private readonly phases = new Map<string, number>()
  /** Per person: last pose, joints drawn last frame, and the snapshot a pose change blends from. */
  private readonly blends = new Map<string, { pose: PersonPose; age: number; from: JointPose; last: JointPose }>()
  private readonly target = neutralPose()
  private readonly unitsPerMeter: number
  private readonly lod: LodLimits
  private readonly joints = neutralPose()
  private readonly frustum = new THREE.Frustum()
  private readonly pv = new THREE.Matrix4()
  private readonly sphere = new THREE.Sphere()
  private readonly cam = new THREE.Vector3()
  private readonly color = new THREE.Color()

  constructor(
    parent: THREE.Object3D,
    opts: PeopleRendererOptions = {},
  ) {
    const capacity = opts.capacity ?? PEOPLE_CAPACITY
    this.unitsPerMeter = opts.unitsPerMeter ?? 1
    this.lod = opts.lod ?? PEOPLE_LOD
    this.pool = new InstancePool(capacity)
    this.group.name = 'people'
    for (const def of PART_DEFS) {
      const mesh = new THREE.InstancedMesh(partGeometry(def), this.material, capacity)
      mesh.name = `people-${def.id}`
      mesh.frustumCulled = false
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.setColorAt(0, this.color.setHex(0xffffff))
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage)
      mesh.count = 0
      this.group.add(mesh)
      this.meshes.set(def.id, mesh)
    }
    parent.add(this.group)
  }

  /** Part meshes by part id, for tests and inspection. */
  mesh(id: string): THREE.InstancedMesh | undefined {
    return this.meshes.get(id)
  }

  /** With no camera everyone is drawn, and detail comes from the caps alone. */
  update(agents: readonly PeopleAgent[], camera: THREE.Camera | null, dt: number, lite = false): PeopleStats {
    const upm = this.unitsPerMeter
    if (camera) {
      camera.updateMatrixWorld()
      camera.getWorldPosition(this.cam)
      this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      this.frustum.setFromProjectionMatrix(this.pv)
    }
    this.sphere.radius = 1.6 * upm

    const n = agents.length
    const visible: boolean[] = new Array(n)
    const dist = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const a = agents[i]
      this.sphere.center.set(a.x, a.y + 0.9 * upm, a.z)
      visible[i] = camera ? this.frustum.intersectsSphere(this.sphere) : true
      dist[i] = !visible[i] ? Infinity : camera ? this.cam.distanceTo(this.sphere.center) / upm : 0
    }
    const levels = assignPeopleLod(dist, lite, this.lod)

    this.pool.reset()
    let near = 0
    let mid = 0
    let far = 0
    let hidden = 0
    let instances = 0
    const seen = new Set<string>()
    const sink = (def: PartDef, matrix: THREE.Matrix4, hex: number) => {
      const slot = this.pool.take(def.id)
      if (slot < 0) return
      const mesh = this.meshes.get(def.id)!
      mesh.setMatrixAt(slot, matrix)
      mesh.setColorAt(slot, this.color.setHex(hex))
      instances++
    }
    for (let i = 0; i < n; i++) {
      const a = agents[i]
      seen.add(a.id)
      const lod = levels[i]
      let phase = this.phases.get(a.id) ?? a.look.phase
      phase += phaseRate(a.pose, a.speed) * Math.max(0, dt)
      phase -= Math.floor(phase)
      this.phases.set(a.id, phase)
      if (lod === -1) {
        hidden++
        continue
      }
      if (lod === 0) near++
      else if (lod === 1) mid++
      else far++
      if (lod !== 2) this.poseFor(a, phase, dt)
      emitPerson(a.look, lod, this.joints, a.x, a.y, a.z, a.yaw, upm, sink)
    }
    for (const id of this.phases.keys()) if (!seen.has(id)) this.phases.delete(id)
    for (const id of this.blends.keys()) if (!seen.has(id)) this.blends.delete(id)

    for (const [id, mesh] of this.meshes) {
      mesh.count = this.pool.count(id)
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
    }
    this.stats.near = near
    this.stats.mid = mid
    this.stats.far = far
    this.stats.hidden = hidden
    this.stats.instances = instances
    this.stats.overflow = this.pool.overflow()
    return this.stats
  }

  /** Sample the agent's pose into `joints`, easing over WORK_POSE.blendSec when the pose changes. */
  private poseFor(a: PeopleAgent, phase: number, dt: number) {
    samplePose(a.pose, phase, a.speed, this.target)
    let b = this.blends.get(a.id)
    if (!b) {
      b = { pose: a.pose, age: Infinity, from: neutralPose(), last: copyPose(this.target, neutralPose()) }
      this.blends.set(a.id, b)
    } else if (b.pose !== a.pose) {
      copyPose(b.last, b.from)
      b.pose = a.pose
      b.age = 0
    } else b.age += Math.max(0, dt)
    const u = b.age / WORK_POSE.blendSec
    if (u >= 1) copyPose(this.target, this.joints)
    else blendPose(b.from, this.target, u * u * (3 - 2 * u), this.joints)
    copyPose(this.joints, b.last)
  }

  dispose(): void {
    this.group.removeFromParent()
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
    this.material.dispose()
    this.phases.clear()
    this.blends.clear()
  }
}
