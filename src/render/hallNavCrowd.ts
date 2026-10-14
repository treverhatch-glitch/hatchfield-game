/**
 * Terminal-view walkers from the hall's PaxNav (src/game/hallNav.ts): one
 * instanced body, head and bag for everyone, plus floor dots along every
 * marked queue line. Real metres: a 1.7 m person on the hall floor (y = 0).
 * Three draw calls for the crowd however many people are in the hall, and
 * low-poly bodies (~130 triangles each) so a 1000+ hall stays cheap to fill.
 */
import * as THREE from 'three'
import type { HallNav } from '../game/hallNav'

const SHIRTS = ['#2f6fb0', '#c0392b', '#2e8b57', '#d68910', '#7d3c98', '#34495e', '#e0e0e0', '#16a085', '#b03a7a', '#5d6d7e']
const SKINS = ['#f6d2b0', '#e0ac69', '#c68642', '#8d5524', '#6b3f2a', '#ffe0c2']
/** Queue line dots, by the kit the line leads to. */
const LINE_COLOR: Record<string, string> = {
  checkin_desk: '#7eb6e0',
  security_lane: '#e05a5a',
  gate_desk: '#5b8fd6',
  toilet: '#3a9a8a',
  shop_counter: '#e0c04a',
}

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

export class HallNavCrowd {
  readonly group = new THREE.Group()
  private readonly bodyGeo = new THREE.CapsuleGeometry(0.2, 0.9, 2, 6)
  private readonly headGeo = new THREE.SphereGeometry(0.12, 7, 5)
  private readonly bagGeo = new THREE.BoxGeometry(0.34, 0.5, 0.22)
  private readonly dotGeo = new THREE.CircleGeometry(0.16, 10)
  private readonly bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  private readonly headMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  private readonly bagMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 })
  private readonly dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })
  private body: THREE.InstancedMesh | null = null
  private head: THREE.InstancedMesh | null = null
  private bag: THREE.InstancedMesh | null = null
  private dots: THREE.InstancedMesh | null = null
  private cap = 0
  private poses = new Float32Array(0)
  private bobSeed = new Float32Array(0)
  private hasBag = new Uint8Array(0)
  private roster = -1
  private lineRev = -1
  private lineNav: unknown = null
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly p = new THREE.Vector3()
  private readonly s = new THREE.Vector3(1, 1, 1)
  private readonly up = new THREE.Vector3(0, 1, 0)
  private readonly c = new THREE.Color()

  constructor() {
    this.group.name = 'hall-nav-crowd'
  }

  /** Draw the walkers. Returns how many were drawn. */
  sync(nav: HallNav, time: number): number {
    const live = nav.live
    this.group.visible = live
    if (!live) return 0
    this.syncLines(nav)
    const n = nav.count
    this.ensure(n)
    const count = nav.writePoses(this.poses)
    if (nav.roster !== this.roster) this.recolour(nav, count)
    const o = nav.origin()
    const body = this.body!
    const head = this.head!
    const bag = this.bag!
    for (let i = 0; i < count; i++) {
      const x = this.poses[i * 4] + o.x
      const z = this.poses[i * 4 + 2] + o.z
      const yaw = this.poses[i * 4 + 3]
      const bob = Math.abs(Math.sin(time * 7 + this.bobSeed[i])) * 0.03
      this.q.setFromAxisAngle(this.up, yaw)
      this.place(body, i, x, 0.65 + bob, z)
      this.place(head, i, x, 1.57 + bob, z)
      // Roller bag trails behind and to the side; parked under the floor when they have none.
      const sx = Math.sin(yaw)
      const sz = Math.cos(yaw)
      this.place(bag, i, x - sx * 0.38 + sz * 0.2, this.hasBag[i] ? 0.25 : -5, z - sz * 0.38 - sx * 0.2)
    }
    for (const mesh of [body, head, bag]) {
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    }
    return count
  }

  dispose() {
    this.group.removeFromParent()
    for (const mesh of [this.body, this.head, this.bag, this.dots]) mesh?.dispose()
    for (const g of [this.bodyGeo, this.headGeo, this.bagGeo, this.dotGeo]) g.dispose()
    for (const mat of [this.bodyMat, this.headMat, this.bagMat, this.dotMat]) mat.dispose()
  }

  private place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number) {
    this.p.set(x, y, z)
    this.m.compose(this.p, this.q, this.s)
    mesh.setMatrixAt(i, this.m)
  }

  /** Colours follow the person, not the slot, so they are re-read when the roster changes. */
  private recolour(nav: HallNav, count: number) {
    this.roster = nav.roster
    const poses = nav.nav?.poses() ?? []
    for (let i = 0; i < count; i++) {
      const h = hash(poses[i]?.id ?? String(i))
      this.body!.setColorAt(i, this.c.set(SHIRTS[h % SHIRTS.length]))
      this.head!.setColorAt(i, this.c.set(SKINS[(h >>> 8) % SKINS.length]))
      this.bobSeed[i] = (h % 628) / 100
      this.hasBag[i] = (h >>> 16) % 3 !== 0 ? 1 : 0
    }
    for (const mesh of [this.body!, this.head!]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  /** Marked queue lines: a dot per metre, rebuilt when the layout changes. */
  private syncLines(nav: HallNav) {
    const pn = nav.nav
    if (!pn || (pn === this.lineNav && pn.revision === this.lineRev)) return
    this.lineNav = pn
    this.lineRev = pn.revision
    this.dots?.removeFromParent()
    this.dots?.dispose()
    const metrics = nav.metrics()
    const total = metrics.reduce((s, f) => s + f.line.length, 0)
    const dots = new THREE.InstancedMesh(this.dotGeo, this.dotMat, Math.max(1, total))
    dots.name = 'hall-nav-queue-lines'
    const o = nav.origin()
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    let i = 0
    for (const f of metrics) {
      this.c.set(LINE_COLOR[f.kind] ?? '#ffffff')
      for (const pt of f.line) {
        this.p.set(pt.x + o.x, 0.02, pt.z + o.z)
        this.m.compose(this.p, flat, this.s)
        dots.setMatrixAt(i, this.m)
        dots.setColorAt(i, this.c)
        i++
      }
    }
    dots.count = i
    dots.frustumCulled = false
    this.dots = dots
    this.group.add(dots)
  }

  private ensure(n: number) {
    if (this.cap >= n && this.body) return
    for (const mesh of [this.body, this.head, this.bag]) {
      mesh?.removeFromParent()
      mesh?.dispose()
    }
    // Grow in steps so a filling hall does not rebuild every frame. Never a cap on people.
    this.cap = Math.max(256, Math.ceil((n * 1.5) / 256) * 256)
    this.poses = new Float32Array(this.cap * 4)
    this.bobSeed = new Float32Array(this.cap)
    this.hasBag = new Uint8Array(this.cap)
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
      const mesh = new THREE.InstancedMesh(geo, mat, this.cap)
      mesh.name = name
      mesh.count = 0
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.group.add(mesh)
      return mesh
    }
    this.body = make(this.bodyGeo, this.bodyMat, 'hall-nav-body')
    this.head = make(this.headGeo, this.headMat, 'hall-nav-head')
    this.bag = make(this.bagGeo, this.bagMat, 'hall-nav-bag')
    this.roster = -1
  }
}
