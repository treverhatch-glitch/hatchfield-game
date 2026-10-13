/**
 * Sim hall guests drawn inside the 3D terminal, on the doorway polyline the
 * sim stored (`wx` / `wz`). Decorative walkers stay off so the two do not stack.
 */
import * as THREE from 'three'
import { setTrs, SKIN_COLORS, type PeopleGeo } from './kit'
import { FLOOR_Y, PERSON_SCALE, SEATED_LIFT, SEATED_SCALE } from './terminal'

export interface HallPose {
  id: string
  x: number
  z: number
  yaw: number
  color: string
  bag: boolean
  /** Sitting to eat or wait — drawn squat, no walk bob. */
  seated?: boolean
}

export function posesFrom(view: object): HallPose[] {
  const guests = (
    view as {
      hallGuests?: readonly {
        id: string
        dead?: boolean
        wx?: number
        wz?: number
        wyaw?: number
        color?: string
        carryOn?: boolean
        hasChecked?: boolean
        seated?: boolean
      }[]
    }
  ).hallGuests
  const out: HallPose[] = []
  for (const g of guests ?? []) {
    if (g.dead || g.wx == null || g.wz == null || !Number.isFinite(g.wx) || !Number.isFinite(g.wz)) continue
    out.push({
      id: g.id,
      x: g.wx,
      z: g.wz,
      yaw: g.wyaw ?? 0,
      color: g.color ?? '#8b6b4a',
      bag: g.carryOn !== false || Boolean(g.hasChecked),
      seated: Boolean(g.seated),
    })
  }
  return out
}

function skinIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  return h % SKIN_COLORS.length
}

export class HallCrowd {
  private body: THREE.InstancedMesh | null = null
  private head: THREE.InstancedMesh | null = null
  private bag: THREE.InstancedMesh | null = null
  private cap = 0
  private readonly bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  private readonly headMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  private readonly bagMat = new THREE.MeshLambertMaterial({ color: 0xc4a574 })
  private readonly tint = new THREE.Color()

  private readonly root: THREE.Object3D
  private readonly people: PeopleGeo

  constructor(root: THREE.Object3D, people: PeopleGeo) {
    this.root = root
    this.people = people
  }

  sync(poses: readonly HallPose[], time: number) {
    if (!poses.length) {
      if (this.body) this.body.count = 0
      if (this.head) this.head.count = 0
      if (this.bag) this.bag.count = 0
      return
    }
    this.ensure(poses.length)
    const body = this.body!
    const head = this.head!
    const bag = this.bag!
    body.count = poses.length
    head.count = poses.length
    bag.count = poses.length
    poses.forEach((p, i) => {
      const bob = p.seated ? 0 : Math.abs(Math.sin(time * 7 + i)) * 0.018
      const y = FLOOR_Y + bob + (p.seated ? SEATED_LIFT : 0)
      const sy = (p.seated ? SEATED_SCALE : 1) * PERSON_SCALE
      setTrs(body, i, p.x, y, p.z, p.yaw, PERSON_SCALE, sy)
      setTrs(head, i, p.x, y, p.z, p.yaw, PERSON_SCALE, sy)
      this.tint.set(p.color)
      body.setColorAt(i, this.tint)
      this.tint.setHex(SKIN_COLORS[skinIndex(p.id)])
      head.setColorAt(i, this.tint)
      const back = 0.32 * PERSON_SCALE
      const side = 0.16 * PERSON_SCALE
      const sx = Math.sin(p.yaw)
      const sz = Math.cos(p.yaw)
      setTrs(
        bag,
        i,
        p.x - sx * back + sz * side,
        p.bag ? FLOOR_Y : -20,
        p.z - sz * back - sx * side,
        p.yaw,
        PERSON_SCALE,
        PERSON_SCALE,
      )
    })
    body.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    bag.instanceMatrix.needsUpdate = true
    if (body.instanceColor) body.instanceColor.needsUpdate = true
    if (head.instanceColor) head.instanceColor.needsUpdate = true
  }

  dispose() {
    for (const mesh of [this.body, this.head, this.bag]) mesh?.removeFromParent()
    this.body = this.head = this.bag = null
    this.cap = 0
    this.bodyMat.dispose()
    this.headMat.dispose()
    this.bagMat.dispose()
  }

  private ensure(n: number) {
    if (this.cap >= n && this.body) return
    for (const mesh of [this.body, this.head, this.bag]) mesh?.removeFromParent()
    this.cap = Math.max(128, n)
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
      const mesh = new THREE.InstancedMesh(geo, mat, this.cap)
      mesh.name = name
      mesh.count = 0
      mesh.frustumCulled = false
      mesh.castShadow = false
      this.root.add(mesh)
      return mesh
    }
    this.body = make(this.people.body, this.bodyMat, 'hall-guest-body')
    this.head = make(this.people.head, this.headMat, 'hall-guest-head')
    this.bag = make(this.people.bag, this.bagMat, 'hall-guest-bag')
  }
}
