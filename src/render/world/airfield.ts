/**
 * Airfield furniture: runway / taxi lights (instanced fixtures + additive glow
 * points), apron flood masts with ground light pools, windsocks, jet bridges.
 */
import * as THREE from 'three'
import { BLOOM_LOOK } from '../look'
import type { AirfieldLevels } from './dayNight'
import type { JetBridge, LightKind, LightSpot, Mast, Runway } from './layout'
import { instanced, trs } from './kit'
import type { WorldTextures } from './textures'

export const LIGHT_RGB: Record<LightKind, number> = {
  rwEdge: 0xfff2d0,
  rwCenter: 0xffffff,
  threshold: 0x3cff6a,
  rwEnd: 0xff3a2a,
  twCenter: 0x3cff8a,
  twEdge: 0x3a7aff,
  apron: 0xffd9a0,
}

export class AirfieldLights {
  readonly root = new THREE.Group()
  private fixtures: THREE.InstancedMesh | null = null
  private glow: THREE.Points | null = null
  private halo: THREE.Points | null = null
  private glowMat: THREE.PointsMaterial
  private haloMat: THREE.PointsMaterial
  /** Base RGB and 0 = runway family / 1 = taxi family, so a hook can split them. */
  private glowRGB: Float32Array | null = null
  private glowGroup: Uint8Array | null = null
  private glowSplit = false
  private fixMat: THREE.MeshBasicMaterial
  private mastHeads: THREE.InstancedMesh | null = null
  private headMat: THREE.MeshBasicMaterial
  private pools: THREE.InstancedMesh | null = null
  private poolMat: THREE.MeshBasicMaterial
  private socks: THREE.Group[] = []
  private geos: THREE.BufferGeometry[] = []
  private mats: THREE.Material[] = []
  private time = 0
  count = 0

  constructor(textures: WorldTextures) {
    this.glowMat = new THREE.PointsMaterial({
      size: 1.5,
      map: textures.glow,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    })
    this.haloMat = new THREE.PointsMaterial({
      size: 1.5 * BLOOM_LOOK.haloSize,
      map: textures.glowHalo,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
      opacity: BLOOM_LOOK.haloOpacity,
    })
    this.glowMat.userData.noGrade = true
    this.haloMat.userData.noGrade = true
    this.fixMat = new THREE.MeshBasicMaterial({ color: 0x777777 })
    this.headMat = new THREE.MeshBasicMaterial({ color: 0x8a8a80 })
    this.poolMat = new THREE.MeshBasicMaterial({
      map: textures.pool,
      color: 0xffd9a0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
    this.mats.push(this.glowMat, this.haloMat, this.fixMat, this.headMat, this.poolMat)
  }

  build(spots: LightSpot[], masts: Mast[], runways: Runway[], withPools: boolean, bloom = false) {
    this.clear()
    this.count = spots.length
    const fixGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.14, 6)
    fixGeo.translate(0, 0.07, 0)
    this.geos.push(fixGeo)
    if (spots.length) {
      this.fixtures = instanced(
        fixGeo,
        this.fixMat,
        spots.map((s) => trs(s.x, 0, s.z)),
        spots.map((s) => LIGHT_RGB[s.kind]),
      )
      this.root.add(this.fixtures)
      const pos = new Float32Array(spots.length * 3)
      const col = new Float32Array(spots.length * 3)
      const c = new THREE.Color()
      spots.forEach((s, i) => {
        pos[i * 3] = s.x
        pos[i * 3 + 1] = 0.25
        pos[i * 3 + 2] = s.z
        c.setHex(LIGHT_RGB[s.kind])
        col[i * 3] = c.r
        col[i * 3 + 1] = c.g
        col[i * 3 + 2] = c.b
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      g.computeBoundingSphere()
      this.geos.push(g)
      this.glowRGB = col.slice()
      this.glowGroup = new Uint8Array(spots.length)
      spots.forEach((s, i) => {
        this.glowGroup![i] = s.kind === 'twCenter' || s.kind === 'twEdge' ? 1 : 0
      })
      this.glow = new THREE.Points(g, this.glowMat)
      this.glow.name = 'airfield-glow'
      this.glow.renderOrder = 5
      this.root.add(this.glow)
      if (bloom) {
        this.halo = new THREE.Points(g, this.haloMat)
        this.halo.name = 'airfield-bloom'
        this.halo.renderOrder = 4
        this.root.add(this.halo)
      }
    }
    if (masts.length) {
      const pole = new THREE.CylinderGeometry(0.09, 0.14, 1, 6)
      pole.translate(0, 0.5, 0)
      const head = new THREE.BoxGeometry(0.9, 0.22, 0.5)
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa2aa })
      this.geos.push(pole, head)
      this.mats.push(poleMat)
      const poles = instanced(pole, poleMat, masts.map((m) => trs(m.x, 0, m.z, m.yaw, 1, 7.5, 1)))
      poles.castShadow = true
      this.mastHeads = instanced(head, this.headMat, masts.map((m) => trs(m.x, 7.5, m.z, m.yaw)))
      this.root.add(poles, this.mastHeads)
      if (withPools) {
        const plane = new THREE.PlaneGeometry(1, 1)
        plane.rotateX(-Math.PI / 2)
        this.geos.push(plane)
        this.pools = instanced(
          plane,
          this.poolMat,
          masts.map((m) => trs(m.x + Math.sin(m.yaw) * 3.4, 0.05, m.z + Math.cos(m.yaw) * 3.4, m.yaw, 9.5, 1, 9.5)),
        )
        this.pools.renderOrder = 4
        this.root.add(this.pools)
      }
    }
    for (const rw of runways) this.addWindsock(rw)
  }

  private addWindsock(rw: Runway) {
    const g = new THREE.Group()
    const pole = new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6)
    pole.translate(0, 1.3, 0)
    const sock = new THREE.ConeGeometry(0.22, 1.1, 8, 1, true)
    sock.rotateZ(Math.PI / 2)
    sock.translate(0.55, 0, 0)
    const pm = new THREE.MeshLambertMaterial({ color: 0xd8dde2 })
    const sm = new THREE.MeshLambertMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })
    this.geos.push(pole, sock)
    this.mats.push(pm, sm)
    const p = new THREE.Mesh(pole, pm)
    p.castShadow = true
    const s = new THREE.Mesh(sock, sm)
    s.position.y = 2.5
    s.name = 'sock'
    g.add(p, s)
    if (rw.axis === 'h') g.position.set(rw.x0 + 6, 0, rw.z0 - 3.5)
    else g.position.set(rw.x0 - 3.5, 0, rw.z0 + 6)
    this.socks.push(g)
    this.root.add(g)
  }

  /**
   * `lights` is the shared night factor. `parts` lets the day/night sample
   * drive runway edge, taxi edge, and apron floods apart. `cheap` (Low) keeps
   * one opacity write and skips the per-lamp colour rewrite.
   */
  update(dt: number, lights: number, wind: number, camDist: number, parts?: AirfieldLevels, cheap = false) {
    this.time += dt
    const runway = parts?.runway ?? lights
    const taxi = parts?.taxi ?? lights
    const apron = parts?.apron ?? lights
    const edge = Math.max(runway, taxi)
    const split = !cheap && Math.abs(runway - taxi) > 0.02
    if (this.glow) {
      this.glow.visible = edge > 0.02
      this.glowMat.size = THREE.MathUtils.clamp(camDist * 0.016, 0.9, 2.6)
      if (split) {
        this.glowMat.opacity = 1
        this.writeGlow(runway, taxi)
        this.glowSplit = true
      } else {
        if (this.glowSplit) {
          this.writeGlow(1, 1)
          this.glowSplit = false
        }
        this.glowMat.opacity = Math.min(1, edge * 1.1)
      }
    }
    if (this.halo) {
      this.halo.visible = edge > 0.02
      this.haloMat.opacity = Math.min(BLOOM_LOOK.haloOpacity, edge * BLOOM_LOOK.haloOpacity)
      this.haloMat.size = (this.glowMat.size || 1.5) * BLOOM_LOOK.haloSize
    }
    const k = 0.45 + edge * 1.6
    this.fixMat.color.setScalar(Math.min(1.6, k))
    this.headMat.color.setRGB(0.54 + apron * 1.2, 0.54 + apron * 1.0, 0.5 + apron * 0.6)
    if (this.pools) {
      this.pools.visible = apron > 0.02
      this.poolMat.opacity = apron * 0.5
    }
    for (const g of this.socks) {
      const s = g.getObjectByName('sock')
      if (!s) continue
      s.rotation.y = 0.6 + Math.sin(this.time * 0.7) * 0.25 * (0.3 + wind)
      s.rotation.z = -0.9 * (1 - Math.min(1, wind + 0.15)) + Math.sin(this.time * 3.1) * 0.05 * wind
    }
  }

  /** Scale each glow by its family. Restores the baked colour when both factors are 1. */
  private writeGlow(runway: number, taxi: number) {
    if (!this.glow || !this.glowRGB || !this.glowGroup) return
    const attr = this.glow.geometry.getAttribute('color') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const base = this.glowRGB
    const group = this.glowGroup
    for (let i = 0; i < group.length; i++) {
      const f = group[i] === 1 ? taxi : runway
      arr[i * 3] = base[i * 3] * f
      arr[i * 3 + 1] = base[i * 3 + 1] * f
      arr[i * 3 + 2] = base[i * 3 + 2] * f
    }
    attr.needsUpdate = true
  }

  clear() {
    for (const o of [...this.root.children]) {
      if (o instanceof THREE.InstancedMesh) o.dispose()
      o.removeFromParent()
    }
    for (const g of this.geos) g.dispose()
    this.geos = []
    // Mast pole / windsock materials are rebuilt each layout.
    this.mats.splice(5).forEach((m) => m.dispose())
    this.fixtures = null
    this.glow = null
    this.halo = null
    this.glowRGB = null
    this.glowGroup = null
    this.glowSplit = false
    this.mastHeads = null
    this.pools = null
    this.socks = []
  }

  dispose() {
    this.clear()
    for (const m of this.mats) m.dispose()
  }
}

/** Telescoping apron-drive bridge: rotunda, two tunnel sections, drive bogie, cab, bellows. */
export function buildJetBridges(list: JetBridge[], beam: THREE.BufferGeometry): { group: THREE.Group; mats: THREE.Material[] } {
  const group = new THREE.Group()
  const body: THREE.Matrix4[] = []
  const dark: THREE.Matrix4[] = []
  const glass: THREE.Matrix4[] = []
  const rotunda: THREE.Matrix4[] = []
  for (const b of list) {
    const dx = b.cab.x - b.root.x
    const dz = b.cab.z - b.root.z
    const len = Math.hypot(dx, dz)
    const yaw = Math.atan2(dx, dz)
    const ux = dx / (len || 1)
    const uz = dz / (len || 1)
    const at = (t: number) => ({ x: b.root.x + ux * t, z: b.root.z + uz * t })
    const cabH = b.cabH
    const cabW = b.cabW
    const baseY = Math.max(0.35, b.cabY - cabH / 2)
    const span = Math.max(1.4, len - 1.2)
    rotunda.push(trs(b.root.x + ux * 0.35, 0, b.root.z + uz * 0.35, 0, 1, 1, 1))
    // Riser when the door sits above the rotunda.
    if (baseY > 1.5) dark.push(trs(b.root.x + ux * 0.35, 0, b.root.z + uz * 0.35, 0, 0.4, baseY, 0.4))
    const inner = at(0.7 + span * 0.3)
    const outer = at(0.7 + span * 0.72)
    body.push(trs(inner.x, baseY, inner.z, yaw, cabW * 0.92, cabH * 0.86, span * 0.6))
    body.push(trs(outer.x, baseY - 0.04, outer.z, yaw, cabW, cabH * 0.92, span * 0.5))
    // Window strips both sides.
    for (const s of [-1, 1]) {
      const wx = -uz * s * cabW * 0.52
      const wz = ux * s * cabW * 0.52
      glass.push(trs(inner.x + wx, baseY + cabH * 0.5, inner.z + wz, yaw, 0.02, cabH * 0.22, span * 0.55))
    }
    const cab = at(len - 0.45)
    body.push(trs(cab.x, baseY - 0.04, cab.z, yaw, cabW * 1.15, cabH, Math.min(1.1, span * 0.35)))
    dark.push(trs(cab.x + ux * 0.45, baseY, cab.z + uz * 0.45, yaw, cabW, cabH * 0.9, 0.18))
    // Drive column + bogie under the outer section.
    const col = at(Math.max(1.2, len * 0.72))
    dark.push(trs(col.x - uz * 0.25, 0, col.z + ux * 0.25, yaw, 0.12, baseY, 0.12))
    dark.push(trs(col.x + uz * 0.25, 0, col.z - ux * 0.25, yaw, 0.12, baseY, 0.12))
    dark.push(trs(col.x, 0, col.z, yaw + Math.PI / 2, Math.max(0.7, cabW), 0.22, 0.3))
  }
  const bodyM = new THREE.MeshLambertMaterial({ color: 0xc9cfd6 })
  const darkM = new THREE.MeshLambertMaterial({ color: 0x2c3138 })
  const glassM = new THREE.MeshBasicMaterial({ color: 0x9cc8e6 })
  const rotM = new THREE.MeshLambertMaterial({ color: 0xaab2bb })
  const rotGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.6, 12)
  rotGeo.translate(0, 0.8 + 0.22, 0)
  if (list.length) {
    const meshes = [
      instanced(beam, bodyM, body),
      instanced(beam, darkM, dark),
      instanced(beam, glassM, glass),
      instanced(rotGeo, rotM, rotunda),
    ]
    meshes[0].castShadow = true
    meshes[3].castShadow = true
    group.add(...meshes)
  }
  group.userData.geos = [rotGeo]
  return { group, mats: [bodyM, darkM, glassM, rotM] }
}

export function setBridgeNight(mats: THREE.Material[], lights: number) {
  const glass = mats[2] as THREE.MeshBasicMaterial | undefined
  if (glass) glass.color.setRGB(0.55 + lights * 0.6, 0.72 + lights * 0.35, 0.85 + lights * 0.1)
}
