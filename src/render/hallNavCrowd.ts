/**
 * Terminal-view walkers from the hall's PaxNav (src/game/hallNav.ts):
 * departures, arrivals and crew (in uniform, no bag). One instanced body, head
 * and bag for everyone, plus floor dots along every marked queue line, red
 * while that line is a bottleneck. Real metres: a 1.7 m person
 * on the hall floor (y = 0).
 *
 * Drawing is cheap however many people the sim walks:
 * - walkers outside the camera frustum or past `drawDistM` are not drawn;
 * - past `lodDistM` they draw as a body only (no head, no bag);
 * - at most `maxVisible` are drawn, nearest first.
 * None of this touches the sim: everyone still walks, queues and counts.
 * The per-frame path writes instance matrices and colours straight into
 * preallocated buffers and allocates nothing.
 */
import * as THREE from 'three'
import type { HallNav } from '../game/hallNav'
import type { CrewRole } from '../paxnav/crew.ts'
import { HALL_CROWD_TUNING } from '../game/hallNavData.ts'
import { WALKER_LOST, WALKER_REBOOK } from '../paxnav/paxnav.ts'

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
/** A queue line that cannot keep up paints its dots this colour. */
const BOTTLENECK_COLOR = '#e23b2f'
/** Crew uniforms by role, after the passenger shirts in the palette. */
const CREW_ROLES: readonly CrewRole[] = ['agent', 'screener', 'gate', 'retail', 'cleaner']
const CREW_SHIRTS: Record<CrewRole, string> = {
  agent: '#1f3a68',
  screener: '#22262c',
  gate: '#1f3a68',
  retail: '#7a4a1e',
  cleaner: '#c9d43a',
}
/** Body centre height, for the frustum test. */
const MID_Y = 0.85

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

function palette(list: readonly string[]): Float32Array {
  const out = new Float32Array(list.length * 3)
  const c = new THREE.Color()
  list.forEach((hex, i) => c.set(hex).toArray(out, i * 3))
  return out
}

/** What the last `sync` drew. Reused object; read it, do not keep it. */
export interface CrowdDrawStats {
  /** Walkers the sim has in the hall. */
  walkers: number
  /** In view and in range, before the cap. */
  visible: number
  /** Bodies drawn (after the cap). */
  bodies: number
  heads: number
  bags: number
  /** Instances drawn across body, head and bag. */
  instances: number
  /** Thought markers drawn (lost, rebooking, unhappy guests). */
  marks: number
}

export class HallNavCrowd {
  readonly group = new THREE.Group()
  /** Tunables; tests and the debug console may change them. */
  readonly tuning = { ...HALL_CROWD_TUNING }
  readonly stats: CrowdDrawStats = { walkers: 0, visible: 0, bodies: 0, heads: 0, bags: 0, instances: 0, marks: 0 }
  /** Crew roles another layer draws as full figures (desk agents, officers); skipped here. */
  skipRole: ((role: CrewRole | null) => boolean) | null = null
  private readonly bodyGeo = new THREE.CapsuleGeometry(0.2, 0.9, 2, 6)
  private readonly headGeo = new THREE.SphereGeometry(0.12, 7, 5)
  private readonly bagGeo = new THREE.BoxGeometry(0.34, 0.5, 0.22)
  private readonly dotGeo = new THREE.CircleGeometry(0.16, 10)
  private readonly bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  private readonly headMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  private readonly bagMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 })
  private readonly dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })
  /** Thought marker over a guest's head: lost (yellow), rebooking (orange), unhappy (red). */
  private readonly markGeo = new THREE.SphereGeometry(0.17, 8, 6)
  private readonly markMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  private readonly markLost = palette(['#ffd23f'])
  private readonly markRebook = palette(['#ff8c1a'])
  private readonly markSad = palette(['#e0413a'])
  private readonly shirts = palette([...SHIRTS, ...CREW_ROLES.map((r) => CREW_SHIRTS[r])])
  private readonly skins = palette(SKINS)
  private body: THREE.InstancedMesh | null = null
  private head: THREE.InstancedMesh | null = null
  private bag: THREE.InstancedMesh | null = null
  private mark: THREE.InstancedMesh | null = null
  private flags = new Uint8Array(0)
  private dots: THREE.InstancedMesh | null = null
  /** Instance slots in the meshes. */
  private cap = 0
  /** Walker slots in the per-walker buffers. */
  private walkCap = 0
  private poses = new Float32Array(0)
  private bobSeed = new Float32Array(0)
  private hasBag = new Uint8Array(0)
  private skip = new Uint8Array(0)
  private shirtOf = new Uint8Array(0)
  private skinOf = new Uint8Array(0)
  private visIdx = new Int32Array(0)
  private visD = new Float32Array(0)
  private roster = -1
  private lastTotal = 0
  private lineRev = -1
  private lineNav: unknown = null
  /** Per queue line, in metrics order: kit kind, dot count, painted as a bottleneck. */
  private lineKinds: string[] = []
  private lineDots: number[] = []
  private lineHot = new Uint8Array(0)
  private readonly frustum = new THREE.Frustum()
  private readonly pm = new THREE.Matrix4()
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1)
  private readonly m = new THREE.Matrix4()
  private readonly p = new THREE.Vector3()
  private readonly s = new THREE.Vector3(1, 1, 1)
  private readonly c = new THREE.Color()

  constructor() {
    this.group.name = 'hall-nav-crowd'
  }

  /**
   * Draw the walkers. With a camera, off-screen and far walkers are skipped
   * and far ones drop to a body. Returns how many were drawn.
   */
  sync(nav: HallNav, time: number, camera?: THREE.Camera): number {
    const st = this.stats
    const live = nav.live
    this.group.visible = live
    if (!live) {
      st.walkers = st.visible = st.bodies = st.heads = st.bags = st.instances = st.marks = 0
      return 0
    }
    this.syncLines(nav)
    this.paintLines(nav)
    this.ensureWalkers(nav.count)
    const total = nav.writePoses(this.poses)
    if (nav.roster !== this.roster) this.recolour(nav, total)
    const ox = nav.originX
    const oz = nav.originZ
    const T = this.tuning
    const poses = this.poses
    const visIdx = this.visIdx
    const visD = this.visD

    // Cull: in front of the camera and in range. The sim still walks everyone.
    let vis = 0
    if (camera) {
      this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      this.frustum.setFromProjectionMatrix(this.pm)
      const e = camera.matrixWorld.elements
      const cx = e[12]
      const cy = e[13]
      const cz = e[14]
      const far2 = T.drawDistM > 0 ? T.drawDistM * T.drawDistM : Infinity
      const sphere = this.sphere
      sphere.radius = T.cullRadiusM
      for (let i = 0; i < total; i++) {
        if (this.skip[i]) continue
        const x = poses[i * 4] + ox
        const z = poses[i * 4 + 2] + oz
        const dx = x - cx
        const dy = MID_Y - cy
        const dz = z - cz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 > far2) continue
        sphere.center.set(x, MID_Y, z)
        if (!this.frustum.intersectsSphere(sphere)) continue
        visIdx[vis] = i
        visD[vis] = d2
        vis++
      }
    } else {
      for (let i = 0; i < total; i++) {
        if (this.skip[i]) continue
        visIdx[vis] = i
        visD[vis] = 0
        vis++
      }
    }
    st.walkers = total
    st.visible = vis
    // Cap: nearest first.
    const capN = T.maxVisible > 0 ? Math.min(vis, T.maxVisible) : vis
    if (capN < vis) this.selectNearest(vis, capN)
    this.ensureMeshes(capN)

    const body = this.body!
    const head = this.head!
    const bag = this.bag!
    const bm = body.instanceMatrix.array as Float32Array
    const hm = head.instanceMatrix.array as Float32Array
    const gm = bag.instanceMatrix.array as Float32Array
    const bc = body.instanceColor!.array as Float32Array
    const hc = head.instanceColor!.array as Float32Array
    const mark = this.mark!
    const mm = mark.instanceMatrix.array as Float32Array
    const mc = mark.instanceColor!.array as Float32Array
    nav.writeFlags(this.flags)
    const lod2 = camera ? T.lodDistM * T.lodDistM : Infinity
    let nh = 0
    let ng = 0
    let nm = 0
    for (let k = 0; k < capN; k++) {
      const i = visIdx[k]
      const x = poses[i * 4] + ox
      const z = poses[i * 4 + 2] + oz
      const yaw = poses[i * 4 + 3]
      const bob = Math.abs(Math.sin(time * 7 + this.bobSeed[i])) * 0.03
      const sn = Math.sin(yaw)
      const cs = Math.cos(yaw)
      writeYaw(bm, k, x, 0.65 + bob, z, sn, cs)
      const sh = this.shirtOf[i] * 3
      bc[k * 3] = this.shirts[sh]
      bc[k * 3 + 1] = this.shirts[sh + 1]
      bc[k * 3 + 2] = this.shirts[sh + 2]
      if (visD[k] > lod2) continue
      writeYaw(hm, nh, x, 1.57 + bob, z, sn, cs)
      const sk = this.skinOf[i] * 3
      hc[nh * 3] = this.skins[sk]
      hc[nh * 3 + 1] = this.skins[sk + 1]
      hc[nh * 3 + 2] = this.skins[sk + 2]
      nh++
      // Roller bag trails behind and to the side.
      if (this.hasBag[i]) {
        writeYaw(gm, ng, x - sn * 0.38 + cs * 0.2, 0.25, z - cs * 0.38 - sn * 0.2, sn, cs)
        ng++
      }
      // Thought bubble over lost, rebooking and unhappy guests.
      const fl = this.flags[i]
      if (fl) {
        const col = fl & WALKER_LOST ? this.markLost : fl & WALKER_REBOOK ? this.markRebook : this.markSad
        writeYaw(mm, nm, x, 2.15 + bob, z, 0, 1)
        mc[nm * 3] = col[0]
        mc[nm * 3 + 1] = col[1]
        mc[nm * 3 + 2] = col[2]
        nm++
      }
    }
    this.flush(body, capN, true)
    this.flush(head, nh, true)
    this.flush(bag, ng, false)
    this.flush(mark, nm, true)
    st.marks = nm
    this.lastTotal = total
    st.bodies = capN
    st.heads = nh
    st.bags = ng
    st.instances = capN + nh + ng
    return capN
  }

  /** The pose buffer (stride 4, terminal metres) and walker count of the last sync, for layers drawn on top. */
  lastPoses(): { poses: Float32Array; total: number } {
    return { poses: this.poses, total: this.lastTotal }
  }

  dispose() {
    this.group.removeFromParent()
    this.body?.dispose()
    this.head?.dispose()
    this.bag?.dispose()
    this.mark?.dispose()
    this.dots?.dispose()
    this.bodyGeo.dispose()
    this.headGeo.dispose()
    this.bagGeo.dispose()
    this.markGeo.dispose()
    this.dotGeo.dispose()
    this.bodyMat.dispose()
    this.headMat.dispose()
    this.bagMat.dispose()
    this.markMat.dispose()
    this.dotMat.dispose()
  }

  private flush(mesh: THREE.InstancedMesh, count: number, colour: boolean) {
    mesh.count = count
    const im = mesh.instanceMatrix
    im.clearUpdateRanges()
    im.addUpdateRange(0, count * 16)
    im.needsUpdate = true
    if (colour && mesh.instanceColor) {
      const ic = mesh.instanceColor
      ic.clearUpdateRanges()
      ic.addUpdateRange(0, count * 3)
      ic.needsUpdate = true
    }
  }

  /** Partial quickselect: the `k` nearest of the first `n` visible walkers end up in front. */
  private selectNearest(n: number, k: number) {
    const idx = this.visIdx
    const d = this.visD
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const pivot = d[mid]
      let i = lo
      let j = hi
      while (i <= j) {
        while (d[i] < pivot) i++
        while (d[j] > pivot) j--
        if (i <= j) {
          const td = d[i]
          d[i] = d[j]
          d[j] = td
          const ti = idx[i]
          idx[i] = idx[j]
          idx[j] = ti
          i++
          j--
        }
      }
      if (k - 1 <= j) hi = j
      else if (k - 1 >= i) lo = i
      else break
    }
  }

  /** Colours follow the person, not the slot, so they are re-read when the roster changes. */
  private recolour(nav: HallNav, count: number) {
    this.roster = nav.roster
    for (let i = 0; i < count; i++) {
      const h = hash(nav.idAt(i) || String(i))
      const role = nav.crewRole(i)
      this.shirtOf[i] = role ? SHIRTS.length + CREW_ROLES.indexOf(role) : h % SHIRTS.length
      this.skinOf[i] = (h >>> 8) % SKINS.length
      this.bobSeed[i] = (h % 628) / 100
      this.hasBag[i] = !role && (h >>> 16) % 3 !== 0 ? 1 : 0
      this.skip[i] = this.skipRole?.(role) ? 1 : 0
    }
  }

  /** Repaint queue line dots when a line starts or stops being a bottleneck. */
  private paintLines(nav: HallNav) {
    const dots = this.dots
    if (!dots) return
    const loads = nav.loads()
    if (loads.length !== this.lineKinds.length) return
    let changed = false
    for (let k = 0; k < loads.length; k++) {
      const b = loads[k].bottleneck ? 1 : 0
      if (this.lineHot[k] !== b) {
        this.lineHot[k] = b
        changed = true
      }
    }
    if (!changed) return
    let i = 0
    for (let k = 0; k < this.lineKinds.length; k++) {
      this.c.set(this.lineHot[k] ? BOTTLENECK_COLOR : (LINE_COLOR[this.lineKinds[k]] ?? '#ffffff'))
      for (let j = 0; j < this.lineDots[k]; j++) dots.setColorAt(i++, this.c)
    }
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true
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
    this.lineKinds = metrics.map((f) => f.kind)
    this.lineDots = metrics.map((f) => f.line.length)
    this.lineHot = new Uint8Array(metrics.length)
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

  /** Per-walker buffers: one slot per person in the sim. Grows in steps, never shrinks. */
  private ensureWalkers(n: number) {
    if (this.walkCap >= n && this.walkCap > 0) return
    const cap = Math.max(256, Math.ceil((n * 1.5) / 256) * 256)
    this.walkCap = cap
    this.poses = new Float32Array(cap * 4)
    this.bobSeed = new Float32Array(cap)
    this.hasBag = new Uint8Array(cap)
    this.skip = new Uint8Array(cap)
    this.shirtOf = new Uint8Array(cap)
    this.skinOf = new Uint8Array(cap)
    this.visIdx = new Int32Array(cap)
    this.visD = new Float32Array(cap)
    this.flags = new Uint8Array(cap)
    this.roster = -1
  }

  /** Instance slots: as many as get drawn (the cap bounds this, not the sim). */
  private ensureMeshes(n: number) {
    if (this.cap >= n && this.body) return
    for (const mesh of [this.body, this.head, this.bag, this.mark]) {
      mesh?.removeFromParent()
      mesh?.dispose()
    }
    this.cap = Math.max(256, Math.ceil((n * 1.5) / 256) * 256)
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, colour: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, mat, this.cap)
      mesh.name = name
      mesh.count = 0
      // Culled per walker above; the mesh-level test would only see the whole crowd.
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (colour) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3).fill(1), 3)
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
      }
      this.group.add(mesh)
      return mesh
    }
    this.body = make(this.bodyGeo, this.bodyMat, 'hall-nav-body', true)
    this.head = make(this.headGeo, this.headMat, 'hall-nav-head', true)
    this.bag = make(this.bagGeo, this.bagMat, 'hall-nav-bag', false)
    this.mark = make(this.markGeo, this.markMat, 'hall-nav-thought', true)
  }
}

/** Column-major translation + rotation about +Y into instance slot `k`, as `makeRotationY` then `setPosition`. */
function writeYaw(arr: Float32Array, k: number, x: number, y: number, z: number, sn: number, cs: number) {
  const o = k * 16
  arr[o] = cs
  arr[o + 1] = 0
  arr[o + 2] = -sn
  arr[o + 3] = 0
  arr[o + 4] = 0
  arr[o + 5] = 1
  arr[o + 6] = 0
  arr[o + 7] = 0
  arr[o + 8] = sn
  arr[o + 9] = 0
  arr[o + 10] = cs
  arr[o + 11] = 0
  arr[o + 12] = x
  arr[o + 13] = y
  arr[o + 14] = z
  arr[o + 15] = 1
}
