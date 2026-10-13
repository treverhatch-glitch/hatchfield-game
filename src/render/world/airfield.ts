/**
 * Airfield furniture: runway / taxi lights (instanced fixtures + additive glow
 * points), apron flood masts with ground light pools, windsocks, jet bridges.
 */
import * as THREE from 'three'
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
  private glowMat: THREE.PointsMaterial
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
    this.mats.push(this.glowMat, this.fixMat, this.headMat, this.poolMat)
  }

  build(spots: LightSpot[], masts: Mast[], runways: Runway[], withPools: boolean) {
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
      this.glow = new THREE.Points(g, this.glowMat)
      this.glow.renderOrder = 5
      this.root.add(this.glow)
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

  /** `lights` 0..1 = night factor; `wind` 0..1 drives the windsock. */
  update(dt: number, lights: number, wind: number, camDist: number) {
    this.time += dt
    const on = lights > 0.02
    if (this.glow) {
      this.glow.visible = on
      this.glowMat.opacity = Math.min(1, lights * 1.1)
      // Keep glows readable when zoomed far out without blowing up close-ups.
      this.glowMat.size = THREE.MathUtils.clamp(camDist * 0.016, 0.9, 2.6)
    }
    const k = 0.45 + lights * 1.6
    this.fixMat.color.setScalar(Math.min(1.6, k))
    this.headMat.color.setRGB(0.54 + lights * 1.2, 0.54 + lights * 1.0, 0.5 + lights * 0.6)
    if (this.pools) {
      this.pools.visible = on
      this.poolMat.opacity = lights * 0.5
    }
    for (const g of this.socks) {
      const s = g.getObjectByName('sock')
      if (!s) continue
      s.rotation.y = 0.6 + Math.sin(this.time * 0.7) * 0.25 * (0.3 + wind)
      s.rotation.z = -0.9 * (1 - Math.min(1, wind + 0.15)) + Math.sin(this.time * 3.1) * 0.05 * wind
    }
  }

  clear() {
    for (const o of [...this.root.children]) {
      if (o instanceof THREE.InstancedMesh) o.dispose()
      o.removeFromParent()
    }
    for (const g of this.geos) g.dispose()
    this.geos = []
    // Mast pole / windsock materials are rebuilt each layout.
    this.mats.splice(4).forEach((m) => m.dispose())
    this.fixtures = null
    this.glow = null
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
    const y = 1.0
    rotunda.push(trs(b.root.x + ux * 0.35, 0, b.root.z + uz * 0.35, 0, 1, 1, 1))
    const inner = at(0.7 + (len - 1.6) * 0.3)
    const outer = at(0.7 + (len - 1.6) * 0.72)
    body.push(trs(inner.x, y, inner.z, yaw, 0.74, 0.78, (len - 1.6) * 0.6))
    body.push(trs(outer.x, y - 0.04, outer.z, yaw, 0.84, 0.86, (len - 1.6) * 0.5))
    // Window strips both sides.
    for (const s of [-1, 1]) {
      const wx = -uz * s * 0.43
      const wz = ux * s * 0.43
      glass.push(trs(inner.x + wx, y + 0.42, inner.z + wz, yaw, 0.02, 0.18, (len - 1.6) * 0.55))
    }
    const cab = at(len - 0.45)
    body.push(trs(cab.x, y - 0.08, cab.z, yaw, 1.1, 0.95, 0.9))
    dark.push(trs(cab.x + ux * 0.5, y - 0.04, cab.z + uz * 0.5, yaw, 0.95, 0.85, 0.18))
    // Drive column + bogie under the outer section.
    const col = at(len * 0.72)
    dark.push(trs(col.x - uz * 0.25, 0, col.z + ux * 0.25, yaw, 0.12, y, 0.12))
    dark.push(trs(col.x + uz * 0.25, 0, col.z - ux * 0.25, yaw, 0.12, y, 0.12))
    dark.push(trs(col.x, 0, col.z, yaw + Math.PI / 2, 0.85, 0.22, 0.3))
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
