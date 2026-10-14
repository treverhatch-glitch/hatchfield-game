/**
 * The five body meshes every hall guest used to draw on their own:
 * legs, arms, torso, head, and the carry-on. One InstancedMesh each,
 * so a full concourse stays five draw calls.
 *
 * Sim guests stay plain data. This file only poses meshes.
 */
import * as THREE from 'three'

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
const WHITE = new THREE.Color('#ffffff')

export interface FigureDraw {
  id: string
  legL: THREE.Object3D
  legR: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  torso: THREE.Object3D
  head: THREE.Object3D
  carry: THREE.Object3D
  showCarry: boolean
  shirt: THREE.Color
  trousers: THREE.Color
  skin: THREE.Color
}

/** Separate meshes a guest used before instancing: two legs, two arms, torso, head, carry-on. */
export const FIGURE_MESHES_PER_GUEST = 7
export const FIGURE_DRAW_CALLS = 5

function partMesh(name: string, geo: THREE.BufferGeometry, mat: THREE.Material, capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, capacity)
  mesh.name = name
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
  return mesh
}

function lambert(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35 })
}

/**
 * Instanced hall guests. Capacity starts at the passenger budget so a full
 * concourse does not rebuild the buffers on the first busy day.
 */
export class HallFigureBatch {
  readonly group = new THREE.Group()
  leg: THREE.InstancedMesh
  arm: THREE.InstancedMesh
  torso: THREE.InstancedMesh
  head: THREE.InstancedMesh
  carry: THREE.InstancedMesh
  private capacity: number
  private readonly legGeo = new THREE.BoxGeometry(0.18, 0.86, 0.18)
  private readonly armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.12)
  private readonly torsoGeo = new THREE.BoxGeometry(0.46, 0.56, 0.26)
  private readonly headGeo = new THREE.SphereGeometry(0.2, 14, 10)
  private readonly carryGeo = new THREE.BoxGeometry(0.18, 0.24, 0.1)
  private readonly legMat = lambert()
  private readonly armMat = lambert()
  private readonly torsoMat = lambert()
  private readonly headMat = lambert()
  private readonly carryMat = new THREE.MeshBasicMaterial({ color: '#3ec6ff', fog: false })
  private ids: string[] = []

  constructor(capacity = 2048) {
    this.capacity = Math.max(1, capacity)
    this.group.name = 'hall-figures'
    this.leg = partMesh('hall-fig-leg', this.legGeo, this.legMat, this.capacity * 2)
    this.arm = partMesh('hall-fig-arm', this.armGeo, this.armMat, this.capacity * 2)
    this.torso = partMesh('hall-fig-torso', this.torsoGeo, this.torsoMat, this.capacity)
    this.head = partMesh('hall-fig-head', this.headGeo, this.headMat, this.capacity)
    this.carry = partMesh('hall-fig-carry', this.carryGeo, this.carryMat, this.capacity)
    this.group.add(this.leg, this.arm, this.torso, this.head, this.carry)
  }

  guestId(instanceId: number): string | null {
    return this.ids[instanceId] ?? null
  }

  write(draws: readonly FigureDraw[]) {
    const n = draws.length
    if (n > this.capacity) this.grow(n)
    for (let i = 0; i < n; i++) {
      const d = draws[i]
      this.pose(this.leg, i * 2, d.legL, d.trousers)
      this.pose(this.leg, i * 2 + 1, d.legR, d.trousers)
      this.pose(this.arm, i * 2, d.armL, d.shirt)
      this.pose(this.arm, i * 2 + 1, d.armR, d.shirt)
      this.pose(this.torso, i, d.torso, d.shirt)
      this.pose(this.head, i, d.head, d.skin)
      if (d.showCarry) this.pose(this.carry, i, d.carry, WHITE)
      else this.carry.setMatrixAt(i, HIDDEN)
    }
    this.leg.count = n * 2
    this.arm.count = n * 2
    this.torso.count = n
    this.head.count = n
    this.carry.count = n
    this.touch(this.leg)
    this.touch(this.arm)
    this.touch(this.torso)
    this.touch(this.head)
    this.touch(this.carry)
    this.ids = draws.map((d) => d.id)
  }

  /** Draw calls for this batch. Empty stays at zero. */
  drawCalls(): number {
    return [this.leg, this.arm, this.torso, this.head, this.carry].filter((mesh) => mesh.count > 0).length
  }

  dispose() {
    for (const mesh of [this.leg, this.arm, this.torso, this.head, this.carry]) mesh.dispose()
    this.legGeo.dispose()
    this.armGeo.dispose()
    this.torsoGeo.dispose()
    this.headGeo.dispose()
    this.carryGeo.dispose()
    this.legMat.dispose()
    this.armMat.dispose()
    this.torsoMat.dispose()
    this.headMat.dispose()
    this.carryMat.dispose()
  }

  private pose(mesh: THREE.InstancedMesh, index: number, node: THREE.Object3D, color: THREE.Color | null) {
    node.updateWorldMatrix(true, false)
    mesh.setMatrixAt(index, node.matrixWorld)
    if (color) mesh.setColorAt(index, color)
  }

  private touch(mesh: THREE.InstancedMesh) {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  private grow(needed: number) {
    let cap = this.capacity
    while (cap < needed) cap *= 2
    this.capacity = cap
    const next = {
      leg: partMesh('hall-fig-leg', this.legGeo, this.legMat, cap * 2),
      arm: partMesh('hall-fig-arm', this.armGeo, this.armMat, cap * 2),
      torso: partMesh('hall-fig-torso', this.torsoGeo, this.torsoMat, cap),
      head: partMesh('hall-fig-head', this.headGeo, this.headMat, cap),
      carry: partMesh('hall-fig-carry', this.carryGeo, this.carryMat, cap),
    }
    this.leg.dispose()
    this.arm.dispose()
    this.torso.dispose()
    this.head.dispose()
    this.carry.dispose()
    this.group.clear()
    this.leg = next.leg
    this.arm = next.arm
    this.torso = next.torso
    this.head = next.head
    this.carry = next.carry
    this.group.add(this.leg, this.arm, this.torso, this.head, this.carry)
  }
}

/** How many color draws a crowd of separate figure meshes costs (no shadows). */
export function separateFigureDraws(guests: number): number {
  return Math.max(0, guests) * FIGURE_MESHES_PER_GUEST
}
