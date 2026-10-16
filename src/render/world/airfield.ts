/**
 * Airfield furniture: runway / taxi lights (instanced fixtures + additive glow
 * points), apron flood masts with ground light pools, windsocks, jet bridges.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BLOOM_LOOK, PROP_LOOK } from '../look'
import { propTexture } from './propArt'
import type { AirfieldLevels } from './dayNight'
import { aircraftWorldPerMeter, BRIDGE_CAB_M } from '../aircraft/specs'
import {
  DIR_VEC,
  dockedJetBridge,
  dockToAircraft,
  reachJetBridge,
  type JetBridge,
  type LightKind,
  type LightSpot,
  type Mast,
  type Runway,
} from './layout'
import { instanced, trs } from './kit'
import type { WorldTextures } from './textures'
import { landingTexture } from './landingArt'
import { fadeFloodPool } from './nightArt'
import { CELL, cellX, cellZ, type BridgeCraft } from './view'

/** Apron flood wash: centre distance from the mast and size (across, along), world units. */
export const FLOOD_REACH = CELL * 0.42
export const FLOOD_WASH = [CELL * 1.05, CELL * 0.85] as const

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
  private lensMat: THREE.MeshBasicMaterial
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
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.headMat = new THREE.MeshBasicMaterial({ color: 0x8a8a80 })
    const flood = landingTexture('apron_flood_glow')
    this.poolMat = new THREE.MeshBasicMaterial({
      map: flood ?? textures.pool,
      color: flood ? 0xffffff : 0xffd9a0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
    if (flood) fadeFloodPool(this.poolMat)
    this.mats.push(this.glowMat, this.haloMat, this.fixMat, this.lensMat, this.headMat, this.poolMat)
  }

  build(spots: LightSpot[], masts: Mast[], runways: Runway[], withPools: boolean, bloom = false) {
    this.clear()
    this.count = spots.length
    const elevated = spots.filter((s) => s.kind !== 'rwCenter' && s.kind !== 'twCenter')
    const inset = spots.filter((s) => s.kind === 'rwCenter' || s.kind === 'twCenter')
    const bodyGeo = elevatedLightGeo()
    const lensGeo = elevatedLensGeo()
    const insetGeo = insetLightGeo()
    this.geos.push(bodyGeo, lensGeo, insetGeo)
    if (elevated.length) {
      const body = instanced(bodyGeo, this.fixMat, elevated.map((s) => trs(s.x, 0, s.z)))
      const lens = instanced(
        lensGeo,
        this.lensMat,
        elevated.map((s) => trs(s.x, 0, s.z)),
        elevated.map((s) => LIGHT_RGB[s.kind]),
      )
      this.fixtures = lens
      this.root.add(body, lens)
    }
    if (inset.length) {
      const discs = instanced(
        insetGeo,
        this.lensMat,
        inset.map((s) => trs(s.x, 0, s.z)),
        inset.map((s) => LIGHT_RGB[s.kind]),
      )
      if (!this.fixtures) this.fixtures = discs
      this.root.add(discs)
    }
    if (spots.length) {
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
          // Round F: a bright core under the mast plus a wide wash that floods the stand (same draw call).
          masts.flatMap((m) => [
            trs(m.x + Math.sin(m.yaw) * 3.4, 0.05, m.z + Math.cos(m.yaw) * 3.4, m.yaw, 9.5, 1, 9.5),
            trs(m.x + Math.sin(m.yaw) * FLOOD_REACH, 0.045, m.z + Math.cos(m.yaw) * FLOOD_REACH, m.yaw, FLOOD_WASH[0], 1, FLOOD_WASH[1]),
          ]),
        )
        this.pools.renderOrder = 4
        this.root.add(this.pools)
      }
    }
    for (const rw of runways) this.addWindsock(rw)
  }

  private addWindsock(rw: Runway) {
    const g = makeWindsock(this.geos, this.mats)
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
      const poolsOn = parts?.pools !== false && apron > 0.02
      this.pools.visible = poolsOn
      this.poolMat.opacity = poolsOn ? apron * 0.42 : 0
    }
    for (const g of this.socks) {
      const s = g.getObjectByName('sock')
      if (s) {
        s.rotation.y = 0.6 + Math.sin(this.time * 0.7) * 0.25 * (0.3 + wind)
        s.rotation.z = -0.9 * (1 - Math.min(1, wind + 0.15)) + Math.sin(this.time * 3.1) * 0.05 * wind
      }
      const lamp = g.getObjectByName('beacon-lamp')
      if (lamp) lamp.rotation.y = this.time * 2.4
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
    this.mats.splice(6).forEach((m) => m.dispose())
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

export interface BridgePart {
  name: string
  kind: 'box' | 'rotunda'
  x: number
  y: number
  z: number
  yaw: number
  sx: number
  sy: number
  sz: number
  slot: 'body' | 'dark' | 'glass' | 'stripe' | 'rotunda'
}

/** Rotunda centre sits this far out from the facade, world units. Its radius is 0.55. */
const ROTUNDA_OUT = 0.6

/**
 * Telescoping parts. The rotunda stands just off the facade. The bellows face
 * lands on `b.cab`, the cab sits behind it facing `b.cabFace`, and the tunnel
 * runs from the rotunda into the cab.
 */
export function bridgeParts(b: JetBridge): BridgePart[] {
  const n = DIR_VEC[b.side]
  const rot = { x: b.root.x + n.dc * ROTUNDA_OUT, z: b.root.z + n.dr * ROTUNDA_OUT }
  const wu = aircraftWorldPerMeter()
  const bellowsD = BRIDGE_CAB_M.bellowsM * wu
  const cabD = BRIDGE_CAB_M.depthM * wu
  const ax = b.cab.x - b.root.x
  const az = b.cab.z - b.root.z
  const al = Math.hypot(ax, az) || 1
  const face = b.cabFace ?? { x: ax / al, z: az / al }
  const faceYaw = Math.atan2(face.x, face.z)
  const cab = { x: b.cab.x - face.x * (bellowsD + cabD / 2), z: b.cab.z - face.z * (bellowsD + cabD / 2) }
  const bel = { x: b.cab.x - face.x * (bellowsD / 2), z: b.cab.z - face.z * (bellowsD / 2) }
  const dx = cab.x - rot.x
  const dz = cab.z - rot.z
  const len = Math.max(0.2, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)
  const ux = dx / len
  const uz = dz / len
  const at = (t: number) => ({ x: rot.x + ux * t, z: rot.z + uz * t })
  const cabH = b.cabH
  const cabW = b.cabW
  const baseY = Math.max(0.35, b.cabY - cabH / 2)
  const out: BridgePart[] = []
  out.push({ name: 'bridge-rotunda', kind: 'rotunda', x: rot.x, y: 0, z: rot.z, yaw: 0, sx: 1, sy: 1, sz: 1, slot: 'rotunda' })
  if (baseY > 1.5) {
    out.push({ name: 'bridge-riser', kind: 'box', x: rot.x, y: 0, z: rot.z, yaw: 0, sx: 0.4, sy: baseY, sz: 0.4, slot: 'dark' })
  }
  const inner = at(len * 0.3)
  const outer = at(len * 0.725)
  // A long chord beside a widebody runs inside the tunnel's own width.
  if (b.cabFace) {
    const off = 0.45 * wu
    inner.x -= b.cabFace.x * off
    inner.z -= b.cabFace.z * off
    outer.x -= b.cabFace.x * off
    outer.z -= b.cabFace.z * off
  }
  out.push({ name: 'bridge-tunnel-a', kind: 'box', x: inner.x, y: baseY, z: inner.z, yaw, sx: cabW * 0.92, sy: cabH * 0.86, sz: len * 0.6, slot: 'body' })
  out.push({ name: 'bridge-tunnel-b', kind: 'box', x: outer.x, y: baseY - 0.04, z: outer.z, yaw, sx: cabW, sy: cabH * 0.92, sz: len * 0.55, slot: 'body' })
  out.push({ name: 'bridge-stripe-a', kind: 'box', x: inner.x, y: baseY - cabH * 0.42, z: inner.z, yaw, sx: cabW * 0.98, sy: 0.05, sz: len * 0.58, slot: 'stripe' })
  out.push({ name: 'bridge-stripe-b', kind: 'box', x: outer.x, y: baseY - cabH * 0.46, z: outer.z, yaw, sx: cabW * 1.02, sy: 0.05, sz: len * 0.53, slot: 'stripe' })
  for (const s of [-1, 1] as const) {
    const wx = -uz * s * cabW * 0.52
    const wz = ux * s * cabW * 0.52
    out.push({
      name: s > 0 ? 'bridge-glass-p' : 'bridge-glass-s',
      kind: 'box',
      x: inner.x + wx,
      y: baseY + cabH * 0.5,
      z: inner.z + wz,
      yaw,
      sx: 0.02,
      sy: cabH * 0.22,
      sz: len * 0.55,
      slot: 'glass',
    })
  }
  out.push({
    name: 'bridge-cab',
    kind: 'box',
    x: cab.x,
    y: baseY - 0.04,
    z: cab.z,
    yaw: faceYaw,
    sx: cabW * 1.15,
    sy: cabH + 0.04,
    sz: cabD,
    slot: 'body',
  })
  out.push({
    name: 'bridge-bellows',
    kind: 'box',
    x: bel.x,
    y: baseY + cabH * 0.05,
    z: bel.z,
    yaw: faceYaw,
    sx: cabW,
    sy: cabH * 0.9,
    sz: bellowsD,
    slot: 'dark',
  })
  const col = at(len * 0.72)
  out.push({ name: 'bridge-col-a', kind: 'box', x: col.x - uz * 0.25, y: 0, z: col.z + ux * 0.25, yaw, sx: 0.12, sy: baseY, sz: 0.12, slot: 'dark' })
  out.push({ name: 'bridge-col-b', kind: 'box', x: col.x + uz * 0.25, y: 0, z: col.z - ux * 0.25, yaw, sx: 0.12, sy: baseY, sz: 0.12, slot: 'dark' })
  out.push({
    name: 'bridge-bogie',
    kind: 'box',
    x: col.x,
    y: 0,
    z: col.z,
    yaw: yaw + Math.PI / 2,
    sx: Math.max(0.7, cabW),
    sy: 0.22,
    sz: 0.3,
    slot: 'dark',
  })
  return out
}

function applyBridgePart(mesh: THREE.Object3D, part: BridgePart) {
  mesh.position.set(part.x, part.y, part.z)
  mesh.rotation.set(0, part.yaw, 0)
  mesh.scale.set(part.sx, part.sy, part.sz)
}

/**
 * Where the bridge is drawn for this reach. With an aircraft on the stand the
 * cab drives to that airframe's door; a bridge with no door there stays parked.
 */
export function posedApronBridge(full: JetBridge, extend: number, craft?: BridgeCraft | null): JetBridge {
  if (!craft) return dockedJetBridge(full, extend)
  const target = dockToAircraft(full, craft)
  const posed = target ? reachJetBridge(full, target, extend) : dockedJetBridge(full, 0)
  if (!target) return posed
  // The straight chord clips a widebody at mid-reach. Push the cab off the
  // centreline (either heading) and leave the parked and docked ends put.
  const u = Math.min(1, Math.max(0, extend))
  // A reversed widebody leaves the rotunda beside the tail, so the chord runs
  // the length of the tube. The tunnel box is wider than the gap at the skin.
  const s = Math.sin(Math.PI * u)
  const early = Math.sin(Math.PI * Math.pow(u, 0.35))
  const bow = (s * 1.95 + Math.max(0, early - s) * 0.4) * aircraftWorldPerMeter()
  if (bow <= 0) return posed
  const nx = Math.cos(craft.heading)
  const nz = Math.sin(craft.heading)
  const dx = posed.cab.x - cellX(craft.x)
  const dz = posed.cab.z - cellZ(craft.y)
  const side = -dx * nz + dz * nx >= 0 ? 1 : -1
  return {
    ...posed,
    cab: {
      x: posed.cab.x + side * -nz * bow,
      z: posed.cab.z + side * nx * bow,
    },
  }
}

/**
 * Slide the cab from the terminal socket toward the door.
 * The rotunda stays on the socket stored when the bridge was built.
 */
export function poseApronBridge(group: THREE.Object3D, extend: number, craft?: BridgeCraft | null) {
  const full = group.userData.bridge as JetBridge | undefined
  if (!full) return
  const posed = posedApronBridge(full, extend, craft)
  for (const part of bridgeParts(posed)) {
    const mesh = group.getObjectByName(part.name)
    if (mesh) applyBridgePart(mesh, part)
  }
}

/** Telescoping apron-drive bridge: rotunda on the terminal, tunnel, drive bogie, cab, bellows. */
export function buildJetBridges(list: JetBridge[], beam: THREE.BufferGeometry): { group: THREE.Group; mats: THREE.Material[] } {
  const group = new THREE.Group()
  const ribs = propTexture('corrugation')
  if (ribs) ribs.repeat.set(3, 14)
  const bodyM = new THREE.MeshLambertMaterial(ribs ? { color: PROP_LOOK.bridge, map: ribs } : { color: PROP_LOOK.bridge })
  const darkM = new THREE.MeshLambertMaterial({ color: PROP_LOOK.bellows })
  const glassM = new THREE.MeshBasicMaterial({ color: 0x9cc8e6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  const rotM = new THREE.MeshLambertMaterial({ color: 0xaab2bb })
  const stripeM = new THREE.MeshLambertMaterial({ color: PROP_LOOK.bridgeStripe, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  const bodyOuter = bodyM.clone()
  bodyOuter.polygonOffset = true
  bodyOuter.polygonOffsetFactor = -2
  bodyOuter.polygonOffsetUnits = -2
  const bodyCab = bodyM.clone()
  bodyCab.polygonOffset = true
  bodyCab.polygonOffsetFactor = -1
  bodyCab.polygonOffsetUnits = -1
  const mats = { body: bodyM, dark: darkM, glass: glassM, stripe: stripeM, rotunda: rotM }
  const rotGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.6, 12)
  rotGeo.translate(0, 0.8 + 0.22, 0)
  for (const b of list) {
    const bridge = new THREE.Group()
    bridge.name = 'apron-bridge'
    bridge.userData.bridge = b
    bridge.userData.stand = b.stand
    const pivot = new THREE.Object3D()
    pivot.name = 'bridge-pivot'
    pivot.position.set(b.root.x, 0, b.root.z)
    bridge.add(pivot)
    for (const part of bridgeParts(b)) {
      const mat = part.name === 'bridge-tunnel-b' ? bodyOuter : part.name === 'bridge-cab' ? bodyCab : mats[part.slot]
      const mesh = new THREE.Mesh(part.kind === 'rotunda' ? rotGeo : beam, mat)
      mesh.name = part.name
      mesh.castShadow = part.slot === 'body' || part.slot === 'rotunda'
      applyBridgePart(mesh, part)
      bridge.add(mesh)
    }
    group.add(bridge)
  }
  group.userData.geos = [rotGeo]
  return { group, mats: [bodyM, darkM, glassM, rotM, stripeM, bodyOuter, bodyCab] }
}

/** Elevated edge light: base, frangible stem, and can. The lens is a second draw so it can take the lamp colour. */
export function elevatedLightGeo(): THREE.BufferGeometry {
  const base = new THREE.BoxGeometry(0.16, 0.028, 0.16)
  base.translate(0, 0.014, 0)
  const stem = new THREE.CylinderGeometry(0.022, 0.028, 0.1, 6)
  stem.translate(0, 0.078, 0)
  const head = new THREE.CylinderGeometry(0.048, 0.05, 0.06, 8)
  head.translate(0, 0.15, 0)
  const g = mergeGeometries([base, stem, head], false)
  base.dispose()
  stem.dispose()
  head.dispose()
  if (!g) throw new Error('edge light merge failed')
  return g
}

export function elevatedLensGeo(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.032, 8, 6)
  g.translate(0, 0.188, 0)
  return g
}

/** Flush centreline light. */
export function insetLightGeo(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8)
  g.translate(0, 0.012, 0)
  return g
}

function paintVerts(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count
  const c = new THREE.Color(hex)
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

/** Banded windsock plus a rotating aerodrome beacon. The sock group keeps the name `sock`. */
export function makeWindsock(geos: THREE.BufferGeometry[], mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'windsock'
  const pole = new THREE.CylinderGeometry(0.045, 0.055, 3.1, 6)
  pole.translate(0, 1.55, 0)
  const bPole = new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6)
  bPole.translate(1.4, 1.2, 0.4)
  const poles = mergeGeometries([paintVerts(pole, PROP_LOOK.chainlink), paintVerts(bPole, PROP_LOOK.chainlink)], false)
  pole.dispose()
  bPole.dispose()
  if (!poles) throw new Error('windsock pole merge failed')
  const pm = new THREE.MeshLambertMaterial({ vertexColors: true })
  geos.push(poles)
  mats.push(pm)
  const p = new THREE.Mesh(poles, pm)
  p.name = 'windsock-poles'
  p.castShadow = true
  g.add(p)
  const sock = new THREE.Group()
  sock.name = 'sock'
  sock.position.y = 3
  const bands = [PROP_LOOK.sockOrange, PROP_LOOK.sockWhite, PROP_LOOK.sockOrange, PROP_LOOK.sockWhite]
  const clothParts = bands.map((hex, i) => {
    const r0 = 0.2 - i * 0.035
    const geo = new THREE.CylinderGeometry(Math.max(0.04, r0 - 0.03), r0, 0.26, 8, 1, true)
    geo.rotateZ(Math.PI / 2)
    geo.translate(0.16 + i * 0.24, 0, 0)
    return paintVerts(geo, hex)
  })
  const hoop = new THREE.TorusGeometry(0.2, 0.015, 6, 12)
  hoop.rotateY(Math.PI / 2)
  clothParts.push(paintVerts(hoop, PROP_LOOK.benchSteel))
  const cloth = mergeGeometries(clothParts, false)
  for (const part of clothParts) part.dispose()
  if (!cloth) throw new Error('windsock cloth merge failed')
  const cm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  geos.push(cloth)
  mats.push(cm)
  const clothMesh = new THREE.Mesh(cloth, cm)
  clothMesh.name = 'sock-cloth'
  sock.add(clothMesh)
  g.add(sock)
  const glass = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 8)
  glass.translate(0, 2.45, 0)
  const lamp = new THREE.SphereGeometry(0.06, 8, 6)
  lamp.translate(0, 2.45, 0)
  const gm = new THREE.MeshLambertMaterial({ color: PROP_LOOK.beaconGlass, transparent: true, opacity: 0.45 })
  const lm = new THREE.MeshBasicMaterial({ color: PROP_LOOK.beaconRed })
  geos.push(glass, lamp)
  mats.push(gm, lm)
  const beacon = new THREE.Group()
  beacon.position.set(1.4, 0, 0.4)
  const lampMesh = new THREE.Mesh(lamp, lm)
  lampMesh.name = 'beacon-lamp'
  beacon.add(new THREE.Mesh(glass, gm), lampMesh)
  g.add(beacon)
  return g
}

export function setBridgeNight(mats: THREE.Material[], lights: number) {
  const glass = mats[2] as THREE.MeshBasicMaterial | undefined
  if (glass) glass.color.setRGB(0.55 + lights * 0.6, 0.72 + lights * 0.35, 0.85 + lights * 0.1)
}
