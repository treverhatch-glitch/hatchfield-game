/**
 * Airside support massing, pass 2. Each building keeps a real footprint and
 * puts a named bay on the apron where a truck or an aircraft nose stops.
 * The fuel-farm fill socket stays on the primary tank.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { FUEL_TILE_SOCKETS } from '../socketLayout'
import { mountSockets } from '../socketMount'
import { MODEL_SIZE } from '../vehicleModels'
import { metreUv, skinBox, skinMaterial, tankUv, tint, yardMaterial } from './buildingSkin'
import { exteriorTexture } from './exteriorArt'
import { artTexture, type ArtTextureId } from './textureRegistry'
import { mountServiceBay, mountSign } from './buildingSign'
import { addParapet, addVault, softenBuilding } from './roundMass'

const wu = (meters: number) => meters * WORLD_PER_METER

function wall(target: Parameters<typeof skinMaterial>[0], part: Parameters<typeof skinMaterial>[1]) {
  return skinMaterial(target, part)
}

function plated(color: string, id: ArtTextureId, roughness: number, metalness = 0.25): THREE.MeshStandardMaterial {
  const map = artTexture(id, 16)
  return new THREE.MeshStandardMaterial({
    color: map ? tint(color, 0.4) : color,
    map: map ?? undefined,
    roughness,
    metalness,
  })
}

function based(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function pipe(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const len = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(len, 0.05), 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  g.add(mesh)
}

let yardDecalTex: THREE.Texture | null | undefined
let laneTex: THREE.Texture | null | undefined

/** Tire tracks and oil stains. Tests run without a canvas, so the mesh stays invisible there. */
function yardDecalTexture(): THREE.Texture | null {
  if (yardDecalTex !== undefined) return yardDecalTex
  if (typeof document === 'undefined') {
    yardDecalTex = null
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    yardDecalTex = null
    return null
  }
  ctx.clearRect(0, 0, 512, 512)
  ctx.fillStyle = 'rgba(42, 32, 22, 0.45)'
  for (const [x, y, rx, ry] of [
    [180, 140, 70, 36],
    [340, 220, 48, 28],
    [250, 360, 90, 40],
    [120, 300, 36, 22],
    [400, 400, 54, 24],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(28, 26, 24, 0.72)'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  for (const x of [228, 284]) {
    ctx.beginPath()
    ctx.moveTo(x, 20)
    ctx.bezierCurveTo(x + 8, 160, x - 14, 300, x + 4, 492)
    ctx.stroke()
  }
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(28, 26, 24, 0.5)'
  ctx.beginPath()
  ctx.moveTo(40, 180)
  ctx.bezierCurveTo(120, 200, 180, 80, 256, 70)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(470, 240)
  ctx.bezierCurveTo(400, 260, 340, 200, 300, 210)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  yardDecalTex = tex
  return tex
}

/** White edge lines, a dashed centre, and stop bars. No filled disc. */
function lanePaintTexture(): THREE.Texture | null {
  if (laneTex !== undefined) return laneTex
  if (typeof document === 'undefined') {
    laneTex = null
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    laneTex = null
    return null
  }
  ctx.clearRect(0, 0, 256, 512)
  ctx.fillStyle = 'rgba(48, 50, 54, 0.55)'
  ctx.fillRect(8, 8, 240, 496)
  ctx.strokeStyle = 'rgba(244, 244, 240, 0.95)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(18, 16)
  ctx.lineTo(18, 496)
  ctx.moveTo(238, 16)
  ctx.lineTo(238, 496)
  ctx.stroke()
  ctx.lineWidth = 6
  ctx.setLineDash([28, 22])
  ctx.beginPath()
  ctx.moveTo(128, 24)
  ctx.lineTo(128, 488)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(28, 36)
  ctx.lineTo(228, 36)
  ctx.moveTo(28, 476)
  ctx.lineTo(228, 476)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  laneTex = tex
  return tex
}

function decalMaterial(map: THREE.Texture | null): THREE.Material {
  if (!map) return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
}

/** Earth ring around one tank. The first segment carries the name. */
function earthBerm(g: THREE.Group, x: number, z: number, radius: number, mat: THREE.Material, name?: string) {
  const n = 8
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const wall = based(0.62, 0.55, radius * 0.72, mat, x + Math.cos(a) * radius, 0.04, z + Math.sin(a) * radius)
    wall.rotation.y = -a
    if (i === 0 && name) wall.name = name
    g.add(wall)
  }
}

/**
 * Stage-III depot: tanks sit in grass earth berms under a drive-through canopy,
 * and the yard carries tire tracks. No decorative tanker is parked in the yard:
 * the bowser that loads here is the live truck on the taxi cell beside the farm.
 * The fill socket stays on the +X outlet the fuel hose already uses. The loading
 * lane is painted lines, not a filled yellow pad.
 */
export function addFuelFarm(g: THREE.Group) {
  const shell = skinMaterial('fuel_farm', 'wall', { metalness: 0.35 })
  const roof = skinMaterial('fuel_farm', 'roof')
  const trim = skinMaterial('fuel_farm', 'trim')
  const bandMat = new THREE.MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.4, metalness: 0.2 })
  const steel = plated('#8b949e', 'tank_steel', 0.4, 0.55)
  const dark = plated('#3a4048', 'tank_steel', 0.45, 0.5)
  const concrete = plated('#c9c6bf', 'apron_concrete', 0.82, 0.05)
  const earth = plated('#5d7a3a', 'gravel_yard', 0.95, 0.02)
  const canopyMat = plated('#c5ccd3', 'hangar_cladding', 0.55, 0.35)

  const yard = new THREE.Mesh(metreUv(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), 4, WORLD_PER_METER), yardMaterial('gravel'))
  yard.rotation.x = -Math.PI / 2
  yard.position.y = 0.04
  yard.receiveShadow = true
  g.add(yard)

  const decal = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9), decalMaterial(yardDecalTexture()))
  decal.name = 'fuel-yard-decal'
  decal.rotation.x = -Math.PI / 2
  decal.position.y = 0.055
  decal.receiveShadow = true
  g.add(decal)

  const tanks: [number, number, number, number, string?][] = [
    [-3.05, -2.9, 1.2, 2.7],
    [0, -2.9, 1.35, 3.0, 'fuel-tank'],
    [3.05, -2.9, 1.2, 2.7],
    [-3.55, -1.05, 0.55, 1.35],
    [3.55, -1.05, 0.55, 1.35],
  ]
  for (const [x, z, r, h, name] of tanks) {
    earthBerm(g, x, z, r + 0.42, earth, name ? 'fuel-berm' : undefined)
    const body = new THREE.Mesh(tankUv(new THREE.CylinderGeometry(r, r, h, 18), SKIN_TILE_M.tank, WORLD_PER_METER), shell)
    body.position.set(x, 0.3 + h / 2, z)
    body.castShadow = true
    if (name) body.name = name
    const phi = Math.PI * 0.16
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 5, 0, Math.PI * 2, 0, phi), shell)
    dome.position.set(x, 0.3 + h - r * Math.cos(phi), z)
    dome.castShadow = true
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.12, 18), bandMat)
    band.position.set(x, 0.3 + h * 0.8, z)
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.03, 4, 18), dark)
    rail.rotation.x = Math.PI / 2
    rail.position.set(x, 0.3 + h + 0.18, z)
    g.add(body, dome, band, rail)
    if (name) {
      for (let i = 0; i < 6; i++) {
        const a = 0.4 + i * 0.45
        const step = based(0.32, 0.05, 0.2, dark, x + Math.cos(a) * (r + 0.12), 0.3 + (h / 6) * i, z + Math.sin(a) * (r + 0.12))
        step.rotation.y = -a
        g.add(step)
      }
    }
  }

  const yel = new THREE.MeshStandardMaterial({ color: '#d4a017', roughness: 0.4, metalness: 0.45 })
  for (const x of [-3.2, -1.6, 0, 1.6]) {
    g.add(based(0.08, 0.85, 0.08, dark, x, 0.12, -0.15))
    g.add(based(0.08, 0.85, 0.08, dark, x, 0.12, 0.15))
    g.add(based(0.08, 0.06, 0.38, dark, x, 0.95, 0))
  }
  pipe(g, new THREE.Vector3(-3.4, 1.0, -0.08), new THREE.Vector3(2.4, 1.0, -0.08), 0.06, yel)
  pipe(g, new THREE.Vector3(-3.4, 1.0, 0.1), new THREE.Vector3(2.4, 1.0, 0.1), 0.05, steel)
  for (const [x, z, r] of tanks) {
    pipe(g, new THREE.Vector3(x, 0.5, z + (r as number)), new THREE.Vector3(x, 1.0, -0.08), 0.04, steel)
  }

  g.add(based(1.7, 1.45, 1.35, concrete, -3.55, 0.12, 2.15))
  g.add(based(1.85, 0.08, 1.5, roof, -3.55, 1.57, 2.15))
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.36, 0.06),
    new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.2 }),
  )
  window.position.set(-3.55, 1.15, 2.84)
  g.add(window)

  const laneZ = 2.55
  const gantryY = 2.15
  g.add(based(3.6, 0.08, 3.5, canopyMat, 0, gantryY, laneZ))
  for (const x of [-1.7, 1.7]) {
    for (const z of [laneZ - 1.55, laneZ + 1.55]) {
      g.add(based(0.1, gantryY, 0.1, steel, x, 0.12, z))
    }
  }
  // Outlet the locked farm_fill socket hoses into. The socket itself does not move.
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10), trim)
  reel.rotation.z = Math.PI / 2
  reel.position.set(1.25, 0.55, 0)
  g.add(reel)

  g.add(based(0.55, 0.4, 0.04, new THREE.MeshStandardMaterial({ color: '#c8231e' }), -3.4, 0.35, -1.15))
  mountSign(g, 'FUEL', { w: 1.5, h: 0.34, x: 0, y: gantryY + 0.28, z: laneZ + 1.85 }, '#2d6a4f', '#ffffff')
  // Drive-through lane. Wide enough for a fuel tanker, long enough to enter and leave.
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.3), decalMaterial(lanePaintTexture()))
  lane.name = 'service-bay:fill'
  lane.rotation.x = -Math.PI / 2
  lane.position.set(0, 0.07, laneZ)
  lane.receiveShadow = true
  g.add(lane)
  mountSockets(g, FUEL_TILE_SOCKETS)
}

/** Two apparatus bays, a watch window, and a hose tower. A bought bell sits on the tower. */
export function addFireStation(g: THREE.Group, opts?: { bell?: boolean }) {
  const span = CELL * 0.86
  const depth = CELL * 0.58
  const wallH = 2.45
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), wall('fire_station', 'wall'))
  body.position.set(0, wallH / 2, -CELL * 0.06)
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.35, 0.12, depth + 0.4, SKIN_TILE_M.roof, WORLD_PER_METER), wall('fire_station', 'roof'))
  roof.position.set(0, wallH + 0.08, -CELL * 0.02)
  const frontZ = -CELL * 0.06 + depth / 2
  const doorMat = wall('fire_station', 'door')
  const trim = wall('fire_station', 'trim')
  const bayW = Math.max(span * 0.34, wu(MODEL_SIZE.arff[2]) + 0.35)
  const doorH = wu(MODEL_SIZE.arff[1]) + 0.28
  const apron = wu(MODEL_SIZE.arff[0])
  for (const [i, x] of [[1, -span * 0.22], [2, span * 0.22]] as const) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(bayW, doorH, 0.08), doorMat)
    door.position.set(x, doorH / 2, frontZ + 0.02)
    door.name = `apparatus:${i}`
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.14, 0.1, 0.1), trim)
    lintel.position.set(x, doorH + 0.08, frontZ + 0.04)
    g.add(door, lintel)
    mountServiceBay(g, String(i), bayW * 0.92, apron, x, frontZ + apron * 0.45, '#e23b32')
  }
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.22, 0.55, 0.06),
    new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.2 }),
  )
  glass.position.set(0, 2.05, frontZ + 0.03)
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.35, 8), wall('fire_station', 'wall'))
  tower.position.set(span * 0.42, wallH + 0.7, -depth * 0.2)
  tower.castShadow = true
  const towerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.12, 8), wall('fire_station', 'roof'))
  towerCap.position.set(span * 0.42, wallH + 1.4, -depth * 0.2)
  mountSign(g, 'FIRE', { w: span * 0.28, h: 0.28, x: 0, y: wallH - 0.15, z: frontZ + 0.08 }, '#3a1818', '#f6f1e4')
  if (opts?.bell) {
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.55, roughness: 0.35 }),
    )
    bell.name = 'alarm-bell'
    bell.position.set(span * 0.42, wallH + 1.72, -depth * 0.2)
    bell.castShadow = true
    g.add(bell)
  }
  addParapet(g, span + 0.2, depth + 0.2, wallH + 0.16, -CELL * 0.04, trim)
  addVault(g, span * 0.92, depth * 0.88, wallH + 0.16, -CELL * 0.04, wall('fire_station', 'roof'), 0.38)
  g.add(body, roof, glass, tower, towerCap)
  softenBuilding(g)
}

/** Three truck docks under a canopy. */
export function addCargoShed(g: THREE.Group) {
  const span = CELL * 0.9
  const depth = CELL * 0.7
  const wallH = 2.6
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), wall('cargo_terminal', 'wall'))
  body.position.set(0, wallH / 2, -CELL * 0.04)
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.3, 0.14, depth + 0.55, SKIN_TILE_M.roof, WORLD_PER_METER), wall('cargo_terminal', 'roof'))
  roof.position.set(0, wallH + 0.08, 0.1)
  const frontZ = -CELL * 0.04 + depth / 2
  const doorMat = wall('cargo_terminal', 'door')
  const trim = wall('cargo_terminal', 'trim')
  const doorW = Math.max(CELL * 0.18, wu(MODEL_SIZE.box_truck[2]) + 0.3)
  const doorH = wu(MODEL_SIZE.box_truck[1]) + 0.22
  const apron = wu(MODEL_SIZE.box_truck[0])
  for (const [i, x] of [[1, -0.28], [2, 0], [3, 0.28]] as const) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), doorMat)
    door.position.set(CELL * x, doorH / 2, frontZ + 0.02)
    door.name = `dock-door:${i}`
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.12, 0.1, 0.1), trim)
    lintel.position.set(CELL * x, doorH + 0.08, frontZ + 0.05)
    g.add(door, lintel)
    mountServiceBay(g, String(i), doorW * 0.92, apron, CELL * x, frontZ + apron * 0.42, '#d7a21a')
  }
  const canopy = new THREE.Mesh(skinBox(span + 0.2, 0.08, 1.2, SKIN_TILE_M.roof, WORLD_PER_METER), wall('cargo_terminal', 'roof'))
  canopy.position.set(0, doorH + 0.2, frontZ + 0.55)
  canopy.castShadow = true
  mountSign(g, 'CARGO', { w: span * 0.32, h: 0.28, x: 0, y: wallH - 0.2, z: frontZ + 0.1 }, '#2a2824', '#f4f0e4')
  addParapet(g, span + 0.15, depth + 0.3, wallH + 0.16, 0.05, trim)
  addVault(g, span * 0.9, depth * 0.85, wallH + 0.18, -CELL * 0.02, wall('cargo_terminal', 'roof'), 0.48)
  g.add(body, roof, canopy)
  softenBuilding(g)
}

/** Capture pad, fluid tank, and a truck bay beside the boom. */
export function addDeicePad(g: THREE.Group) {
  const padMap = artTexture('apron_concrete', 16)
  const pad = new THREE.Mesh(
    metreUv(new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95), 4, WORLD_PER_METER),
    new THREE.MeshLambertMaterial({ color: padMap ? '#d5d8dc' : '#3a4a58', map: padMap ?? undefined }),
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.04
  pad.receiveShadow = true
  const berm = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.7, 0.16, 0.1), wall('deice_pad', 'trim'))
  berm.position.set(0.2, 0.12, -CELL * 0.28)
  const tank = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(0.55, 0.65, 1.6, 10), SKIN_TILE_M.tank, WORLD_PER_METER),
    skinMaterial('deice_pad', 'wall', { metalness: 0.35 }),
  )
  tank.position.set(-CELL * 0.28, 0.85, -CELL * 0.22)
  tank.castShadow = true
  const boom = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.42, 0.1, 0.16), wall('deice_pad', 'trim'))
  boom.position.set(-CELL * 0.05, 1.55, -CELL * 0.22)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.45, 0.16),
    new THREE.MeshStandardMaterial({ color: '#7ec8e0', emissive: '#2a6070', emissiveIntensity: 0.25 }),
  )
  head.position.set(CELL * 0.12, 1.25, -CELL * 0.22)
  mountServiceBay(g, 'pad', CELL * 0.55, CELL * 0.42, CELL * 0.08, CELL * 0.08, '#e8d56a')
  mountServiceBay(g, 'truck', Math.max(1.5, wu(MODEL_SIZE.deice[2]) + 0.25), wu(MODEL_SIZE.deice[0]), -CELL * 0.28, CELL * 0.22, '#3fa8d6')
  mountSign(g, 'DEICE', { w: 1.15, h: 0.26, x: -CELL * 0.28, y: 1.85, z: -CELL * 0.22 + 0.7 }, '#1c2830', '#f4f7fa')
  g.add(pad, berm, tank, boom, head)
  softenBuilding(g)
}

/** Cab stays inside the cell. A ramp bay sits at the foot for the service van. */
export function addControlTower(g: THREE.Group) {
  const cabR = CELL * 0.42
  const shaft = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(cabR * 0.45, cabR * 0.72, CELL * 0.55, 10), SKIN_TILE_M.wall, WORLD_PER_METER),
    wall('control_tower', 'wall'),
  )
  shaft.position.y = CELL * 0.28
  shaft.castShadow = true
  const cabMat = new THREE.MeshStandardMaterial({
    color: '#c5d8e6',
    roughness: 0.15,
    metalness: 0.2,
    emissive: '#1a3348',
    emissiveIntensity: 0.25,
  })
  const curtain = exteriorTexture('curtain')
  if (curtain) cabMat.map = curtain
  const cab = new THREE.Mesh(tankUv(new THREE.CylinderGeometry(cabR, cabR * 0.86, CELL * 0.12, 12), 2.4, WORLD_PER_METER), cabMat)
  cab.position.y = CELL * 0.58
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(cabR * 0.7, cabR * 1.04, CELL * 0.04, 12), wall('control_tower', 'roof'))
  cap.position.y = CELL * 0.66
  const band = new THREE.Mesh(new THREE.CylinderGeometry(cabR * 0.88, cabR * 0.88, CELL * 0.025, 12, 1, true), wall('control_tower', 'trim'))
  band.position.y = CELL * 0.51
  const base = new THREE.Mesh(skinBox(CELL * 0.55, 1.15, CELL * 0.42, SKIN_TILE_M.wall, WORLD_PER_METER), wall('control_tower', 'wall'))
  base.position.set(0, 0.58, CELL * 0.22)
  base.castShadow = true
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.06), wall('control_tower', 'door'))
  door.position.set(0, 0.5, CELL * 0.22 + CELL * 0.21)
  mountServiceBay(g, 'ramp', 1.6, 1.2, 0, CELL * 0.42 + 0.75, '#d7a21a')
  mountSign(g, 'TOWER', { w: 1.2, h: 0.26, x: 0, y: 1.25, z: CELL * 0.44 }, '#1c2830', '#f4f7fa')
  g.add(shaft, cab, cap, band, base, door)
  softenBuilding(g)
}
