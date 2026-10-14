/**
 * Terminal hall shell: terrazzo floor, glass curtain walls with mullions and
 * spandrels, exposed steel roof trusses, linear pendant lights and columns.
 * Plus an exterior: glazed facade, cantilevered canopy over the kerb,
 * roof parapet and a lit name sign. All repeated members are instanced.
 */
import * as THREE from 'three'
import { geminiTexture, material } from './materials'

export interface HallSpec {
  width: number
  depth: number
  height: number
  /** Add real point lights (desktop quality). */
  lights?: boolean
}

type M = THREE.Matrix4
function inst(geo: THREE.BufferGeometry, mat: THREE.Material, ms: M[], shadow = false): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, ms.length)
  ms.forEach((x, i) => m.setMatrixAt(i, x))
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}
const unitBox = new THREE.BoxGeometry(1, 1, 1)
function bx(x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, rz = 0): M {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)),
    new THREE.Vector3(w, h, d),
  )
}

function glassMat(): THREE.Material {
  const tex = geminiTexture('glass', [1, 1])
  return new THREE.MeshPhysicalMaterial({
    color: '#a9d3e0',
    map: tex,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function buildTerminalHall(spec: HallSpec): THREE.Group {
  const { width: W, depth: D, height: Ht } = spec
  const g = new THREE.Group()
  g.name = 'terminalHall'

  // terrazzo floor with brass divider strips every 6 m
  const floorTex = geminiTexture('terrazzo', [W / 3, D / 3])
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: floorTex, roughness: 0.22, metalness: 0.05 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  g.add(floor)
  const strips: M[] = []
  for (let x = -W / 2 + 6; x < W / 2; x += 6) strips.push(bx(x, 0.004, 0, 0.04, 0.008, D))
  for (let z = -D / 2 + 6; z < D / 2; z += 6) strips.push(bx(0, 0.004, z, W, 0.008, 0.04))
  g.add(inst(unitBox, new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.3 }), strips))

  // curtain walls on all four sides: glass, mullions, transoms, base spandrel
  const glass: M[] = [], mull: M[] = [], span: M[] = []
  const bay = 1.5
  const sides: [number, number, number, number][] = [
    [0, -D / 2, W, 0], [0, D / 2, W, 0], [-W / 2, 0, D, Math.PI / 2], [W / 2, 0, D, Math.PI / 2],
  ]
  for (const [cx, cz, len, ry] of sides) {
    glass.push(bx(cx, Ht / 2 + 0.3, cz, len, Ht - 0.6, 0.03, ry))
    span.push(bx(cx, 0.3, cz, len, 0.6, 0.2, ry))
    const n = Math.round(len / bay)
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (i * len) / n
      const x = cx + (ry ? 0 : t), z = cz + (ry ? t : 0)
      mull.push(bx(x, Ht / 2, z, 0.08, Ht, 0.18, ry))
    }
    for (const y of [2.8, Ht * 0.7]) mull.push(bx(cx, y, cz, len, 0.06, 0.14, ry))
  }
  g.add(inst(unitBox, glassMat(), glass))
  g.add(inst(unitBox, material('darkSteel'), mull, true))
  g.add(inst(unitBox, material('granite'), span))

  // columns + steel Warren trusses spanning the depth every 9 m
  const steel = new THREE.MeshStandardMaterial({ color: '#e8eaec', metalness: 0.6, roughness: 0.35 })
  const chords: M[] = [], webs: M[] = [], cols: M[] = [], purlins: M[] = []
  const tH = 1.6
  for (let x = -W / 2 + 4.5; x < W / 2 - 1; x += 9) {
    for (const z of [-D / 2 + 0.6, D / 2 - 0.6]) cols.push(bx(x, Ht / 2, z, 0.5, Ht, 0.5))
    chords.push(bx(x, Ht + tH, 0, 0.25, 0.3, D), bx(x, Ht, 0, 0.2, 0.22, D))
    const n = Math.round(D / 2.4)
    for (let i = 0; i < n; i++) {
      const z = -D / 2 + (i + 0.5) * (D / n)
      const ang = Math.atan2(D / n, tH) * (i % 2 ? 1 : -1)
      webs.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x, Ht + tH / 2, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, 0, 0)),
        new THREE.Vector3(0.12, Math.hypot(tH, D / n), 0.12),
      ))
    }
  }
  for (let z = -D / 2 + 1.5; z < D / 2; z += 3) purlins.push(bx(0, Ht + tH + 0.25, z, W, 0.2, 0.12))
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
  g.add(inst(cylGeo, steel, cols, true))
  g.add(inst(unitBox, steel, chords, true))
  g.add(inst(unitBox, steel, webs))
  g.add(inst(unitBox, steel, purlins))

  // roof deck (timber-look soffit) seen from inside, with skylight strips
  const roofMat = new THREE.MeshStandardMaterial({ color: '#c9a77c', roughness: 0.7, side: THREE.DoubleSide })
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, D + 1), roofMat)
  roof.rotation.x = Math.PI / 2
  roof.position.y = Ht + tH + 0.36
  g.add(roof)
  const sky: M[] = []
  for (let x = -W / 2 + 9; x < W / 2; x += 9) sky.push(bx(x, Ht + tH + 0.34, 0, 2.2, 0.02, D - 4))
  g.add(inst(unitBox, material('lampCool'), sky))

  // linear pendant lights between trusses
  const lamps: M[] = [], rods: M[] = []
  for (let x = -W / 2 + 9; x < W / 2 - 1; x += 9)
    for (let z = -D / 2 + 3; z < D / 2 - 2; z += 4) {
      lamps.push(bx(x, Ht - 0.4, z, 0.2, 0.08, 2.6))
      rods.push(bx(x, Ht - 0.2 + (tH * 0.5) / 2, z, 0.01, 0.4 + tH * 0.5, 0.01))
    }
  g.add(inst(unitBox, material('lamp'), lamps))
  g.add(inst(unitBox, material('black'), rods))

  g.add(new THREE.HemisphereLight('#f3f6ff', '#b8a990', 0.9))
  if (spec.lights) {
    for (let x = -W / 2 + 9; x < W / 2 - 1; x += 27)
      for (let z = -D / 4; z < D / 2; z += D / 2) {
        const l = new THREE.PointLight('#fff1d6', 40, 22, 1.6)
        l.position.set(x, Ht - 0.8, z)
        g.add(l)
      }
  }
  return g
}

/** Exterior: facade, canopy, kerb, roof with parapet and lit name sign. */
export function buildTerminalExterior(spec: HallSpec): THREE.Group {
  const { width: W, depth: D, height: Ht } = spec
  const g = new THREE.Group()
  g.name = 'terminalExterior'
  const roofTop = Ht + 2
  const roofTex = geminiTexture('roof', [W / 8, D / 8])
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 3, 0.5, D + 3), new THREE.MeshStandardMaterial({ color: '#d9dadc', map: roofTex, roughness: 0.8 }))
  roof.position.y = roofTop + 0.25
  roof.castShadow = true
  g.add(roof)
  const fascia: M[] = [
    bx(0, roofTop + 0.6, D / 2 + 1.5, W + 3.2, 1.2, 0.3),
    bx(0, roofTop + 0.6, -D / 2 - 1.5, W + 3.2, 1.2, 0.3),
    bx(-W / 2 - 1.5, roofTop + 0.6, 0, 0.3, 1.2, D + 3.2),
    bx(W / 2 + 1.5, roofTop + 0.6, 0, 0.3, 1.2, D + 3.2),
  ]
  // clerestory band closing the gap between curtain wall head and roof
  fascia.push(
    bx(0, Ht + 1, D / 2, W, 2, 0.3), bx(0, Ht + 1, -D / 2, W, 2, 0.3),
    bx(-W / 2, Ht + 1, 0, 0.3, 2, D), bx(W / 2, Ht + 1, 0, 0.3, 2, D),
  )
  g.add(inst(unitBox, material('white'), fascia, true))
  // rooftop plant
  const ac: M[] = []
  for (let i = 0; i < 6; i++) ac.push(bx(-W / 3 + i * (W / 8), roofTop + 1.0, -D / 4, 2.2, 1.0, 1.6))
  g.add(inst(unitBox, material('greyPanel'), ac, true))
  // landside canopy: deck, tapered columns, lit underside
  const cz = D / 2 + 7
  const canopy: M[] = [bx(0, 6.2, cz, W * 0.9, 0.4, 10)]
  g.add(inst(unitBox, material('white'), canopy, true))
  const cols: M[] = []
  for (let x = -W * 0.4; x <= W * 0.4; x += 9) cols.push(bx(x, 3.1, cz + 3.5, 0.45, 6.2, 0.45))
  g.add(inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 16), material('brushed'), cols, true))
  const under: M[] = []
  for (let x = -W * 0.42; x <= W * 0.42; x += 3) under.push(bx(x, 5.98, cz, 0.15, 0.04, 9))
  g.add(inst(unitBox, material('lampCool'), under))
  // kerb, road, crossing stripes
  const road = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, 16), new THREE.MeshStandardMaterial({ color: '#3b3d40', roughness: 0.9 }))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, 0.01, cz + 3)
  road.receiveShadow = true
  g.add(road)
  const kerb: M[] = [bx(0, 0.08, D / 2 + 3, W + 6, 0.16, 6)]
  g.add(inst(unitBox, material('cream'), kerb))
  const stripes: M[] = []
  for (const x of [-W / 4, W / 4]) for (let i = 0; i < 6; i++) stripes.push(bx(x - 2.5 + i, 0.02, cz + 3, 0.5, 0.01, 9))
  g.add(inst(unitBox, material('white'), stripes))
  // name sign on the canopy edge
  g.add(inst(unitBox, material('sgnHatch'), [bx(0, 6.9, cz + 5.05, Math.min(30, W * 0.6), 1.0, 0.1)]))
  // entry doors + vestibules
  const vest: M[] = [], vglass: M[] = []
  for (const x of [-W / 4, 0, W / 4]) {
    vest.push(bx(x, 3.15, D / 2 + 1.4, 5, 0.3, 2.8))
    vglass.push(bx(x, 1.5, D / 2 + 2.8, 4.8, 3, 0.05))
  }
  g.add(inst(unitBox, material('darkSteel'), vest, true))
  g.add(inst(unitBox, glassMat(), vglass))
  return g
}
