/**
 * Check-in and security interiors in the Terminal view, driven by the hall's
 * PaxNav (src/game/hallNav.ts). Reads the live facilities, never writes them:
 *
 * - check-in desks: an airline sign from the roster over each desk, a bag on
 *   the bag-drop scale while a passenger is being served, and the weighed bag
 *   sliding off onto the collector belt when service completes;
 * - security lanes: X-ray trays rolling through on the lane belt while the
 *   lane is screening, stopping when it is idle;
 * - queue barriers: stanchion posts and belt tape either side of every marked
 *   check-in and security line, rebuilt when the layout changes;
 * - staff: desk agents and security officers drawn as full uniformed figures
 *   (shared people renderer, its LOD) at the posts the sim staffs. An
 *   unstaffed desk stays empty.
 *
 * Everything is instanced; one draw per part type however many desks.
 */
import * as THREE from 'three'
import type { HallNav } from '../game/hallNav'
import type { FacilityMetrics } from '../paxnav/paxnav.ts'
import type { CrewRole } from '../paxnav/crew.ts'
import { PeopleRenderer, type PeopleAgent } from '../people/renderer.ts'
import { crewLook } from '../people/variants.ts'
import type { CrewKind, PersonLook } from '../people/types.ts'
import { HALL_SERVICE_LOOK as L, TAPE_COLOR } from './hallServiceConfig'

/** What a desk sign shows. */
export interface DeskBrand {
  id: string
  name: string
  code: string
  primary: string
  secondary: string
}

interface Desk {
  id: string
  /** Service point and the unit direction toward the desk (hall metres). */
  px: number
  pz: number
  dx: number
  dz: number
  brand: DeskBrand | null
  served: number
  serving: boolean
  slideAt: number
}

interface Lane {
  id: string
  px: number
  pz: number
  dx: number
  dz: number
  phase: number
  busy: boolean
}

const STAFF_KIND: Partial<Record<CrewRole, CrewKind>> = { agent: 'checkin', screener: 'security', gate: 'cabin' }

export interface HallServiceStats {
  desks: number
  lanes: number
  posts: number
  trays: number
  bags: number
  staff: number
}

/** Service point and facing for a marked line: from the second point toward the first. */
export function servicePoint(f: Pick<FacilityMetrics, 'line'>, ox = 0, oz = 0): { px: number; pz: number; dx: number; dz: number } | null {
  const a = f.line[0]
  if (!a) return null
  const b = f.line[1]
  let dx = b ? a.x - b.x : 0
  let dz = b ? a.z - b.z : -1
  const n = Math.hypot(dx, dz)
  if (n < 1e-6) {
    dx = 0
    dz = -1
  } else {
    dx /= n
    dz /= n
  }
  return { px: a.x + ox, pz: a.z + oz, dx, dz }
}

/** Posts either side of a queue line, every `step` metres, skipping the service point. */
export function barrierPosts(line: readonly { x: number; z: number }[], step = L.postStepM, side = L.postSideM): { x: number; z: number; s: -1 | 1 }[] {
  const out: { x: number; z: number; s: -1 | 1 }[] = []
  let carry = step
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 1e-6) continue
    const ux = (b.x - a.x) / len
    const uz = (b.z - a.z) / len
    let t = carry
    while (t <= len) {
      const x = a.x + ux * t
      const z = a.z + uz * t
      out.push({ x: x - uz * side, z: z + ux * side, s: -1 })
      out.push({ x: x + uz * side, z: z - ux * side, s: 1 })
      t += step
    }
    carry = t - len
  }
  return out
}

/** A desk sign as a canvas texture: airline colour, name and code. Null without a DOM canvas. */
function signTexture(brand: DeskBrand): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 144
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = brand.primary
  ctx.fillRect(0, 0, 512, 144)
  ctx.fillStyle = brand.secondary
  ctx.fillRect(0, 118, 512, 26)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 56px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(brand.name.length > 16 ? brand.name.slice(0, 15) + '…' : brand.name, 24, 58)
  ctx.font = 'bold 30px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(brand.code, 488, 58)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export class HallServiceFx {
  readonly group = new THREE.Group()
  readonly stats: HallServiceStats = { desks: 0, lanes: 0, posts: 0, trays: 0, bags: 0, staff: 0 }
  private desks: Desk[] = []
  private lanes: Lane[] = []
  private nav: unknown = null
  private rev = -1
  private brandKey = ''
  private readAt = -Infinity
  private lastTime = 0
  private readonly posts: THREE.InstancedMesh
  private readonly tape: THREE.InstancedMesh
  private readonly trays: THREE.InstancedMesh
  private readonly bags: THREE.InstancedMesh
  private readonly scales: THREE.InstancedMesh
  private readonly signGroup = new THREE.Group()
  private readonly signTex = new Map<string, THREE.Texture | null>()
  private readonly signGeo = new THREE.PlaneGeometry(L.signW, L.signH)
  private readonly signBack = new THREE.MeshLambertMaterial({ color: '#2a2e33' })
  private readonly staff: PeopleRenderer
  private readonly agents: PeopleAgent[] = []
  private readonly looks = new Map<string, PersonLook>()
  private readonly lastPos = new Map<string, { x: number; z: number }>()
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly p = new THREE.Vector3()
  private readonly s = new THREE.Vector3()
  private readonly c = new THREE.Color()
  private readonly up = new THREE.Vector3(0, 1, 0)

  constructor() {
    this.group.name = 'hall-service'
    const lit = new THREE.MeshLambertMaterial({ color: 0xffffff })
    const make = (geo: THREE.BufferGeometry, cap: number, name: string, mat: THREE.Material = lit) => {
      const mesh = new THREE.InstancedMesh(geo, mat, cap)
      mesh.name = name
      mesh.count = 0
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.group.add(mesh)
      return mesh
    }
    const post = new THREE.CylinderGeometry(0.03, 0.03, L.postH, 8).translate(0, L.postH / 2, 0)
    const base = new THREE.CylinderGeometry(0.16, 0.18, 0.04, 12).translate(0, 0.02, 0)
    const postGeo = mergeTwo(post, base)
    this.posts = make(postGeo, L.maxPosts, 'hall-queue-posts', new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 0.7, roughness: 0.3 }))
    this.tape = make(new THREE.BoxGeometry(1, 0.05, 0.012), L.maxPosts, 'hall-queue-tape')
    this.trays = make(new THREE.BoxGeometry(0.6, 0.09, 0.42), 256, 'hall-xray-trays', new THREE.MeshLambertMaterial({ color: '#5b6672' }))
    this.bags = make(new THREE.BoxGeometry(0.42, 0.55, 0.26), 128, 'hall-scale-bags')
    this.scales = make(new THREE.BoxGeometry(0.62, 0.06, 0.5), 128, 'hall-bag-scales', new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.6, roughness: 0.35 }))
    this.signBack.name = 'shared'
    this.signGroup.name = 'hall-desk-signs'
    this.group.add(this.signGroup)
    this.staff = new PeopleRenderer(this.group, { capacity: L.maxStaff })
  }

  /**
   * Draw the interiors for this frame. `crewPoses` / `crewTotal` are the
   * crowd's pose buffer (stride 4, terminal metres); `brands` are the desk
   * airlines in order.
   */
  sync(nav: HallNav, time: number, camera: THREE.Camera | null, brands: readonly DeskBrand[], crewPoses?: Float32Array, crewTotal = 0): HallServiceStats {
    const dt = Math.min(0.25, Math.max(0, time - this.lastTime))
    this.lastTime = time
    this.group.visible = nav.live
    if (!nav.live) return this.stats
    const pn = nav.nav
    const key = brands.map((b) => b.id).join(',')
    if (pn !== this.nav || (pn && pn.revision !== this.rev) || key !== this.brandKey) {
      this.nav = pn
      this.rev = pn?.revision ?? -1
      this.brandKey = key
      this.rebuild(nav, brands)
    }
    if (time - this.readAt >= L.readEverySec || time < this.readAt) {
      this.readAt = time
      this.read(nav, time)
    }
    this.drawTrays(dt)
    this.drawBags(time)
    this.drawStaff(nav, camera, dt, crewPoses, crewTotal)
    return this.stats
  }

  private rebuild(nav: HallNav, brands: readonly DeskBrand[]) {
    const metrics = nav.metrics()
    const ox = nav.originX
    const oz = nav.originZ
    this.desks = []
    this.lanes = []
    for (const s of this.signGroup.children) (s as THREE.Mesh).material && disposeMat((s as THREE.Mesh).material as THREE.Material)
    this.signGroup.clear()
    let posts = 0
    let tape = 0
    for (const f of metrics) {
      if (f.kind !== 'checkin_desk' && f.kind !== 'security_lane') continue
      const sp = servicePoint(f, ox, oz)
      if (!sp) continue
      if (f.kind === 'checkin_desk') {
        const brand = brands.length ? brands[this.desks.length % brands.length] : null
        this.desks.push({ id: f.id, ...sp, brand, served: f.served, serving: f.serving, slideAt: -Infinity })
        if (brand) this.addSign(sp, brand)
      } else this.lanes.push({ id: f.id, ...sp, phase: hashPhase(f.id), busy: f.serving })
      // Barriers either side of the marked line, tape between neighbouring posts on the same side.
      const line = f.line.map((pt) => ({ x: pt.x + ox, z: pt.z + oz }))
      const pts = barrierPosts(line)
      this.c.set(TAPE_COLOR[f.kind] ?? '#1f4e9c')
      const prev: Record<string, { x: number; z: number } | undefined> = {}
      for (const pt of pts) {
        if (posts >= L.maxPosts) break
        this.p.set(pt.x, 0, pt.z)
        this.m.compose(this.p, this.q.identity(), this.s.set(1, 1, 1))
        this.posts.setMatrixAt(posts++, this.m)
        const last = prev[pt.s]
        prev[pt.s] = pt
        if (!last || tape >= L.maxPosts) continue
        const len = Math.hypot(pt.x - last.x, pt.z - last.z)
        if (len > L.postStepM * 1.6) continue
        this.p.set((pt.x + last.x) / 2, L.tapeY, (pt.z + last.z) / 2)
        this.q.setFromAxisAngle(this.up, -Math.atan2(pt.z - last.z, pt.x - last.x))
        this.m.compose(this.p, this.q, this.s.set(len, 1, 1))
        this.tape.setMatrixAt(tape, this.m)
        this.tape.setColorAt(tape, this.c)
        tape++
      }
    }
    this.posts.count = posts
    this.tape.count = tape
    this.posts.instanceMatrix.needsUpdate = true
    this.tape.instanceMatrix.needsUpdate = true
    if (this.tape.instanceColor) this.tape.instanceColor.needsUpdate = true
    // Scales: one per desk, fixed.
    this.desks.forEach((d, i) => {
      const sx = -d.dz
      const sz = d.dx
      this.p.set(d.px + d.dx * L.scaleAhead + sx * L.scaleSide, L.scaleY, d.pz + d.dz * L.scaleAhead + sz * L.scaleSide)
      this.q.setFromAxisAngle(this.up, Math.atan2(d.dx, d.dz))
      this.m.compose(this.p, this.q, this.s.set(1, 1, 1))
      if (i < 128) this.scales.setMatrixAt(i, this.m)
    })
    this.scales.count = Math.min(128, this.desks.length)
    this.scales.instanceMatrix.needsUpdate = true
    this.stats.desks = this.desks.length
    this.stats.lanes = this.lanes.length
    this.stats.posts = posts
  }

  private addSign(sp: { px: number; pz: number; dx: number; dz: number }, brand: DeskBrand) {
    let tex = this.signTex.get(brand.id)
    if (tex === undefined) {
      tex = signTexture(brand)
      this.signTex.set(brand.id, tex)
    }
    const face = new THREE.Mesh(this.signGeo, new THREE.MeshBasicMaterial({ map: tex, color: tex ? '#ffffff' : brand.primary, toneMapped: false }))
    face.name = `desk-sign:${brand.id}`
    face.position.set(sp.px + sp.dx * L.deskAhead, L.signY, sp.pz + sp.dz * L.deskAhead)
    // The sign faces the queue (back along the line).
    face.rotation.y = Math.atan2(-sp.dx, -sp.dz)
    const back = new THREE.Mesh(this.signGeo, this.signBack)
    back.position.copy(face.position)
    back.rotation.y = face.rotation.y + Math.PI
    face.userData.brand = brand.id
    this.signGroup.add(face, back)
  }

  /** Serving flags and served counts. A count that went up starts that desk's bag slide. */
  private read(nav: HallNav, time: number) {
    const byId = new Map(nav.metrics().map((f) => [f.id, f]))
    for (const d of this.desks) {
      const f = byId.get(d.id)
      if (!f) continue
      if (f.served > d.served) d.slideAt = time
      d.served = f.served
      d.serving = f.serving
    }
    for (const l of this.lanes) {
      const f = byId.get(l.id)
      if (f) l.busy = f.serving || f.queueLength > 0
    }
  }

  private drawTrays(dt: number) {
    let n = 0
    const span = L.trayBackM + L.trayAheadM
    for (const l of this.lanes) {
      if (l.busy) l.phase = (l.phase + dt * L.trayRate) % 1
      const sx = -l.dz
      const sz = l.dx
      this.q.setFromAxisAngle(this.up, Math.atan2(l.dx, l.dz))
      for (let i = 0; i < L.traysPerLane && n < 256; i++) {
        const u = (l.phase + i / L.traysPerLane) % 1
        // The last stretch is the tray return under the belt: not drawn.
        if (u > 0.9) continue
        const along = -L.trayBackM + (u / 0.9) * span
        this.p.set(l.px + l.dx * along + sx * L.traySideM, L.trayY, l.pz + l.dz * along + sz * L.traySideM)
        this.m.compose(this.p, this.q, this.s.set(1, 1, 1))
        this.trays.setMatrixAt(n++, this.m)
      }
    }
    this.trays.count = n
    this.trays.instanceMatrix.needsUpdate = true
    this.stats.trays = n
  }

  private drawBags(time: number) {
    let n = 0
    for (const d of this.desks) {
      if (n >= 128) break
      const sx = -d.dz
      const sz = d.dx
      const k = (time - d.slideAt) / L.bagSlideSec
      let along = 0
      if (k >= 0 && k < 1) along = k * L.bagSlideM
      else if (!d.serving) continue
      const bx = d.px + d.dx * L.scaleAhead + sx * (L.scaleSide + along)
      const bz = d.pz + d.dz * L.scaleAhead + sz * (L.scaleSide + along)
      this.p.set(bx, L.scaleY + 0.31, bz)
      this.q.setFromAxisAngle(this.up, Math.atan2(d.dx, d.dz))
      this.m.compose(this.p, this.q, this.s.set(1, 1, 1))
      this.bags.setMatrixAt(n, this.m)
      this.bags.setColorAt(n, this.c.set(d.brand?.secondary && d.brand.secondary !== '#ffffff' ? '#2f4a6a' : '#6a4328'))
      n++
    }
    this.bags.count = n
    this.bags.instanceMatrix.needsUpdate = true
    if (this.bags.instanceColor) this.bags.instanceColor.needsUpdate = true
    this.stats.bags = n
  }

  /** Desk agents and officers at their posts as uniformed figures, working while their station serves. */
  private drawStaff(nav: HallNav, camera: THREE.Camera | null, dt: number, poses: Float32Array | undefined, total: number) {
    const out = this.agents
    out.length = 0
    if (poses) {
      const ox = nav.originX
      const oz = nav.originZ
      for (let i = 0; i < total && out.length < L.maxStaff; i++) {
        const role = nav.crewRole(i)
        const kind = role ? STAFF_KIND[role] : undefined
        if (!kind) continue
        const id = nav.idAt(i) || `crew${i}`
        const x = poses[i * 4] + ox
        const z = poses[i * 4 + 2] + oz
        const was = this.lastPos.get(id)
        const speed = was && dt > 0 ? Math.hypot(x - was.x, z - was.z) / dt : 0
        if (was) {
          was.x = x
          was.z = z
        } else this.lastPos.set(id, { x, z })
        let look = this.looks.get(id)
        if (!look) this.looks.set(id, (look = crewLook(kind, id)))
        const working = speed < 0.2 && this.nearBusy(role!, x, z)
        out.push({
          id,
          look,
          x,
          y: 0,
          z,
          yaw: poses[i * 4 + 3],
          pose: speed > 0.2 ? 'walk' : working ? 'reach' : 'idle',
          speed: speed > 0.2 ? Math.min(1.6, speed) : 0,
        })
      }
    }
    this.staff.update(out, camera, dt)
    this.stats.staff = out.length
  }

  /** Is a desk (agents) or lane (officers) within reach of this post busy right now? */
  private nearBusy(role: CrewRole, x: number, z: number): boolean {
    const r2 = 3.2 * 3.2
    if (role === 'screener') return this.lanes.some((l) => l.busy && (l.px - x) ** 2 + (l.pz - z) ** 2 < r2 * 1.6)
    return this.desks.some((d) => d.serving && (d.px - x) ** 2 + (d.pz - z) ** 2 < r2)
  }

  /** Crew roles this layer draws as figures; the capsule crowd skips them. */
  static drawsRole(role: CrewRole | null): boolean {
    return !!role && role in STAFF_KIND
  }

  dispose() {
    this.group.removeFromParent()
    for (const mesh of [this.posts, this.tape, this.trays, this.bags, this.scales]) {
      mesh.geometry.dispose()
      disposeMat(mesh.material as THREE.Material)
      mesh.dispose()
    }
    for (const s of this.signGroup.children) disposeMat((s as THREE.Mesh).material as THREE.Material)
    for (const t of this.signTex.values()) t?.dispose()
    this.signGeo.dispose()
    this.signBack.dispose()
    this.staff.dispose()
  }
}

function disposeMat(m: THREE.Material) {
  if (m.name === 'shared') return
  m.dispose()
}

function hashPhase(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 1000) / 1000
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const ai = a.toNonIndexed()
  const bi = b.toNonIndexed()
  const out = new THREE.BufferGeometry()
  for (const name of ['position', 'normal'] as const) {
    const x = ai.getAttribute(name).array as Float32Array
    const y = bi.getAttribute(name).array as Float32Array
    const arr = new Float32Array(x.length + y.length)
    arr.set(x)
    arr.set(y, x.length)
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3))
  }
  a.dispose()
  b.dispose()
  ai.dispose()
  bi.dispose()
  return out
}
