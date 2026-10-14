/**
 * Terminal hall shell: terrazzo floor, glass curtain walls with mullions and
 * spandrels, exposed steel roof trusses, linear pendant lights and columns.
 * Plus an exterior: glazed facade, cantilevered canopy over the kerb,
 * roof parapet and a lit name sign. All repeated members are instanced.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { geminiTexture, material } from './materials'
import { floorTile, frit, slats } from './hiq'
import { buildTerminalProps } from './index'

export interface HallSpec {
  width: number
  depth: number
  height: number
  /** Add real point lights (desktop quality). */
  lights?: boolean
  /** 'high' (default, desktop RTX 4070 tier) adds slat ceiling, LED coves, column capitals, 2K floor. */
  quality?: 'low' | 'high'
  /** Carpeted gate lounges, in hall coordinates (centre x/z, size w/d). */
  carpets?: { x: number; z: number; w: number; d: number }[]
  /** Airside jet bridges along the -Z facade (exterior only): x positions. */
  jetBridges?: number[]
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
/** Unit cylinder (axis Y). With an elliptical scale it reads as a rounded extrusion profile. */
const rodGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
/** A horizontal rounded member of length len along the wall direction ry (h tall, d deep). */
function rod(x: number, y: number, z: number, len: number, h: number, d: number, ry = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, Math.PI / 2)),
    new THREE.Vector3(h, len, d),
  )
}
/** Rounded-corner slab as a real mesh (not instanced) so the bevel radius stays true. */
function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  m.castShadow = true
  m.receiveShadow = true
  return m
}
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
    roughness: 0.03,
    metalness: 0.15,
    ior: 1.5,
    reflectivity: 0.6,
    envMapIntensity: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function buildTerminalHall(spec: HallSpec): THREE.Group {
  const { width: W, depth: D, height: Ht } = spec
  const g = new THREE.Group()
  g.name = 'terminalHall'

  // terrazzo floor with brass divider strips every 6 m
  const hiq = spec.quality !== 'low'
  const floorTex = hiq ? floorTile('color', [W / 4.8, D / 4.8]) : geminiTexture('terrazzo', [W / 3, D / 3])
  const floorMat = hiq
    ? new THREE.MeshPhysicalMaterial({ color: '#d9d4cb', map: floorTex, roughnessMap: floorTile('rough', [W / 4.8, D / 4.8]), roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.08 })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', map: floorTex, roughness: 0.22, metalness: 0.05 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  g.add(floor)
  const strips: M[] = []
  for (let x = -W / 2 + 6; x < W / 2; x += 6) strips.push(bx(x, 0.004, 0, 0.04, 0.008, D))
  for (let z = -D / 2 + 6; z < D / 2; z += 6) strips.push(bx(0, 0.004, z, W, 0.008, 0.04))
  g.add(inst(unitBox, new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.3 }), strips))

  // curtain walls on all four sides: glass, mullions, transoms, base spandrel
  const glass: M[] = [], mull: M[] = [], span: M[] = [], trans: M[] = [], nose: M[] = []
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
      // rounded (elliptical) mullion profile instead of a square bar
      mull.push(bx(x, Ht / 2, z, ry ? 0.18 : 0.09, Ht, ry ? 0.09 : 0.18, 0))
    }
    for (const y of [2.8, Ht * 0.7]) trans.push(rod(cx, y, cz, len, 0.07, 0.14, ry))
    // bullnose cap on the granite spandrel
    nose.push(rod(cx, 0.6, cz, len, 0.1, 0.24, ry))
  }
  g.add(inst(unitBox, glassMat(), glass))
  g.add(inst(rodGeo, material('darkSteel'), mull, true))
  g.add(inst(rodGeo, material('darkSteel'), trans, true))
  g.add(inst(unitBox, material('granite'), span))
  g.add(inst(rodGeo, material('granite'), nose))
  // recessed landside entrances: deep reveals, head, sliding leaves set back, mat
  if (spec.quality !== 'low') g.add(recessedDoors(W, D))

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

  if (hiq) {
    // timber slat baffle ceiling hung below the truss bottom chords
    const slatMat = new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.6 })
    const sl: M[] = []
    for (let z = -D / 2 + 0.6; z < D / 2 - 0.4; z += 0.6) sl.push(bx(0, Ht - 0.05, z, W - 0.4, 0.28, 0.06))
    const slatMesh = inst(unitBox, slatMat, sl)
    slatMesh.name = 'slatCeiling'
    g.add(slatMesh)
    // perimeter LED cove + column capitals + plinths
    const cove: M[] = []
    for (const [cx, cz, len, ry] of sides) cove.push(bx(cx * 0.995, Ht - 0.32, cz * 0.995, len - 0.6, 0.05, 0.08, ry))
    g.add(inst(unitBox, material('ledWarm'), cove))
    const caps: M[] = [], plinth: M[] = []
    for (let x = -W / 2 + 4.5; x < W / 2 - 1; x += 9)
      for (const z of [-D / 2 + 0.6, D / 2 - 0.6]) {
        caps.push(new THREE.Matrix4().compose(new THREE.Vector3(x, Ht - 0.6, z), new THREE.Quaternion(), new THREE.Vector3(1.4, 1.2, 1.4)))
        plinth.push(bx(x, 0.15, z, 0.9, 0.3, 0.9))
      }
    g.add(inst(new THREE.CylinderGeometry(0.5, 0.18, 1, 24), steel, caps, true))
    g.add(inst(new THREE.CylinderGeometry(0.5, 0.56, 1, 24), material('stainless'), plinth))
    // carpet lounges with stainless edge trims
    if (spec.carpets?.length) {
      const cg = new THREE.Group()
      cg.name = 'carpets'
      for (const c of spec.carpets) {
        const cm = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.d), material('carpet'))
        cm.rotation.x = -Math.PI / 2
        cm.position.set(c.x, 0.006, c.z)
        cm.receiveShadow = true
        cg.add(cm)
        cg.add(inst(unitBox, material('stainless'), [
          bx(c.x, 0.008, c.z - c.d / 2, c.w, 0.012, 0.05), bx(c.x, 0.008, c.z + c.d / 2, c.w, 0.012, 0.05),
          bx(c.x - c.w / 2, 0.008, c.z, 0.05, 0.012, c.d), bx(c.x + c.w / 2, 0.008, c.z, 0.05, 0.012, c.d),
        ]))
      }
      g.add(cg)
    }
  }

  g.add(new THREE.HemisphereLight('#f3f6ff', '#b8a990', hiq ? 0.6 : 0.9))
  if (spec.lights) {
    const stepX = hiq ? 18 : 27
    for (let x = -W / 2 + 9; x < W / 2 - 1; x += stepX)
      for (let z = -D / 4; z < D / 2; z += D / 2) {
        const l = new THREE.PointLight('#fff1d6', hiq ? 55 : 40, 24, 1.6)
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
  const vglass: M[] = [], jamb: M[] = [], leaf: M[] = []
  for (const x of [-W / 4, 0, W / 4]) {
    g.add(rbox(5.4, 0.36, 3.0, 0.16, material('darkSteel'), x, 3.18, D / 2 + 1.5))
    // door set back 0.5 m inside a deep stainless reveal
    vglass.push(bx(x, 1.5, D / 2 + 2.3, 4.2, 3, 0.05))
    jamb.push(bx(x - 2.3, 1.5, D / 2 + 2.55, 0.4, 3.0, 0.6), bx(x + 2.3, 1.5, D / 2 + 2.55, 0.4, 3.0, 0.6), bx(x, 2.85, D / 2 + 2.55, 5.0, 0.3, 0.6))
    for (const dx of [-1.05, 1.05]) leaf.push(bx(x + dx, 1.25, D / 2 + 2.33, 1.0, 2.5, 0.04))
  }
  g.add(inst(unitBox, glassMat(), vglass))
  g.add(inst(unitBox, material('stainless'), jamb, true))
  g.add(inst(unitBox, material('darkSteel'), leaf))
  if (spec.quality !== 'low') exteriorHigh(g, spec, cz)
  return g
}

/** Desktop-tier exterior: roof overhang soffit, fins, louvres, kerb furniture, sign letters, jet bridges. */
function exteriorHigh(g: THREE.Group, spec: HallSpec, cz: number) {
  const { width: W, depth: D, height: Ht } = spec
  const roofTop = Ht + 2
  // deep roof overhang with timber soffit and downlights on all sides
  const ov = 4
  const soffitMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: slats('color', [W / 6, 1]), roughness: 0.75 })
  const soff: M[] = [
    bx(0, roofTop - 0.02, D / 2 + 1.5 + ov / 2, W + 3 + 2 * ov, 0.04, ov), bx(0, roofTop - 0.02, -D / 2 - 1.5 - ov / 2, W + 3 + 2 * ov, 0.04, ov),
    bx(-W / 2 - 1.5 - ov / 2, roofTop - 0.02, 0, ov, 0.04, D + 3), bx(W / 2 + 1.5 + ov / 2, roofTop - 0.02, 0, ov, 0.04, D + 3),
  ]
  g.add(inst(unitBox, soffitMat, soff))
  const edge: M[] = [
    bx(0, roofTop + 0.25, D / 2 + 1.5 + ov, W + 3.4 + 2 * ov, 0.9, 0.35), bx(0, roofTop + 0.25, -D / 2 - 1.5 - ov, W + 3.4 + 2 * ov, 0.9, 0.35),
    bx(-W / 2 - 1.5 - ov, roofTop + 0.25, 0, 0.35, 0.9, D + 3.4 + 2 * ov), bx(W / 2 + 1.5 + ov, roofTop + 0.25, 0, 0.35, 0.9, D + 3.4 + 2 * ov),
  ]
  const top: M[] = [
    bx(0, roofTop + 0.5, D / 2 + 1.5 + ov / 2, W + 3 + 2 * ov, 0.3, ov), bx(0, roofTop + 0.5, -D / 2 - 1.5 - ov / 2, W + 3 + 2 * ov, 0.3, ov),
    bx(-W / 2 - 1.5 - ov / 2, roofTop + 0.5, 0, ov, 0.3, D + 3), bx(W / 2 + 1.5 + ov / 2, roofTop + 0.5, 0, ov, 0.3, D + 3),
  ]
  g.add(inst(unitBox, material('lacquerWhite'), top, true))
  // bullnose roof edge instead of a square fascia board
  g.add(inst(rodGeo, material('lacquerWhite'), [
    rod(0, roofTop + 0.25, D / 2 + 1.5 + ov, W + 3.4 + 2 * ov, 0.9, 0.5), rod(0, roofTop + 0.25, -D / 2 - 1.5 - ov, W + 3.4 + 2 * ov, 0.9, 0.5),
    rod(-W / 2 - 1.5 - ov, roofTop + 0.25, 0, D + 3.4 + 2 * ov, 0.9, 0.5, Math.PI / 2), rod(W / 2 + 1.5 + ov, roofTop + 0.25, 0, D + 3.4 + 2 * ov, 0.9, 0.5, Math.PI / 2),
  ], true))
  void edge
  g.add(inst(rodGeo, material('white'), [rod(0, 6.2, cz + 5, W * 0.9, 0.44, 0.6)], true))
  const dl: M[] = []
  for (let x = -W / 2; x <= W / 2; x += 4) for (const z of [D / 2 + 1.5 + ov / 2, -D / 2 - 1.5 - ov / 2]) dl.push(bx(x, roofTop - 0.05, z, 0.3, 0.02, 0.3))
  g.add(inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 16), material('ledWarm'), dl))
  // vertical aluminium fins + fritted sunshade louvres on the long facades
  const fins: M[] = [], louv: M[] = []
  for (const zs of [1, -1]) {
    for (let x = -W / 2; x <= W / 2; x += 3) fins.push(bx(x, Ht / 2, zs * (D / 2 + 0.35), 0.1, Ht, 0.6))
    for (const y of [Ht * 0.72, Ht * 0.82, Ht * 0.92]) louv.push(bx(0, y, zs * (D / 2 + 0.7), W, 0.03, 0.5, 0, 0))
  }
  g.add(inst(unitBox, material('brushed'), fins, true))
  const louvMat = new THREE.MeshStandardMaterial({ color: '#dfe5ea', alphaMap: frit(), transparent: true, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })
  g.add(inst(unitBox, louvMat, louv))
  // rooftop skylight ridges
  const sky: M[] = []
  for (let x = -W / 2 + 9; x < W / 2; x += 9) sky.push(bx(x, roofTop + 0.75, 0, 2.4, 0.5, D - 4))
  g.add(inst(unitBox, glassMat(), sky))
  // landside: 3D sign letters with halo backing on the canopy fascia
  g.add(inst(unitBox, material('sgnHatchBig'), [bx(0, 7.15, cz + 5.12, Math.min(28, W * 0.55), 1.3, 0.12)]))
  g.add(inst(unitBox, material('ledBlue'), [bx(0, 7.15, cz + 5.04, Math.min(28.6, W * 0.56), 1.42, 0.04)]))
  g.add(inst(unitBox, material('sgnDepartures'), [bx(-W / 4, 5.6, cz + 5.0, 8, 1.2, 0.1)]))
  g.add(inst(unitBox, material('sgnArrivals'), [bx(W / 4, 5.6, cz + 5.0, 8, 1.2, 0.1)]))
  // lamp posts, bollards, kerb planters
  const posts: M[] = [], heads: M[] = [], boll: M[] = [], tops: M[] = []
  for (let x = -W / 2; x <= W / 2; x += 12) {
    posts.push(bx(x, 4, cz + 11, 0.18, 8, 0.18))
    heads.push(bx(x, 8, cz + 10.5, 0.4, 0.15, 1.2))
  }
  for (let x = -W * 0.44; x <= W * 0.44; x += 1.8) {
    boll.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.55, D / 2 + 5.8), new THREE.Quaternion(), new THREE.Vector3(0.2, 0.8, 0.2)))
    tops.push(bx(x, 0.92, D / 2 + 5.8, 0.18, 0.04, 0.18))
  }
  const cg = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
  g.add(inst(unitBox, material('darkSteel'), posts, true), inst(unitBox, material('ledWarm'), heads))
  g.add(inst(cg, material('stainless'), boll, true), inst(cg, material('led'), tops))
  // airside apron strip + jet bridges docked on the -Z facade
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, 50), material('apronConcrete'))
  apron.rotation.x = -Math.PI / 2
  apron.position.set(0, 0.01, -D / 2 - 25)
  apron.receiveShadow = true
  g.add(apron)
  const xs = spec.jetBridges ?? [-W / 3, 0, W / 3]
  if (xs.length) {
    const jb = buildTerminalProps(xs.map((x) => ({ type: 'jet_bridge' as const, x, z: -D / 2 - 3.2, yaw: Math.PI })), { shadows: true })
    jb.name = 'jetBridges'
    g.add(jb)
  }
}

/** Interior side of the landside entrances: reveal jambs, head with EXIT sign, sliding leaves, entrance mat. */
function recessedDoors(W: number, D: number): THREE.Group {
  const g = new THREE.Group()
  g.name = 'recessedDoors'
  const jamb: M[] = [], leafF: M[] = [], leafG: M[] = [], mats: M[] = [], sign: M[] = [], sensor: M[] = []
  for (const x of [-W / 4, 0, W / 4]) {
    const z = D / 2 - 0.35
    jamb.push(bx(x - 2.3, 1.6, z, 0.4, 3.2, 0.7), bx(x + 2.3, 1.6, z, 0.4, 3.2, 0.7), bx(x, 3.35, z, 5.0, 0.3, 0.7))
    for (const dx of [-1.6, -0.55, 0.55, 1.6]) {
      leafG.push(bx(x + dx, 1.4, D / 2 - 0.62, 0.98, 2.7, 0.03))
      const lz = D / 2 - 0.62
      leafF.push(bx(x + dx - 0.5, 1.4, lz, 0.05, 2.78, 0.06), bx(x + dx + 0.5, 1.4, lz, 0.05, 2.78, 0.06))
      leafF.push(bx(x + dx, 0.06, lz, 1.04, 0.12, 0.06), bx(x + dx, 2.76, lz, 1.04, 0.06, 0.06), bx(x + dx, 1.05, lz + 0.03, 0.9, 0.04, 0.04))
    }
    mats.push(bx(x, 0.006, D / 2 - 2.0, 4.6, 0.012, 2.6))
    sign.push(bx(x, 3.1, z - 0.36, 1.4, 0.3, 0.04))
    sensor.push(bx(x, 3.0, z - 0.36, 0.3, 0.06, 0.08))
  }
  // frames first (opaque), glass inset on top
  g.add(inst(unitBox, material('stainless'), jamb, true))
  g.add(inst(unitBox, material('darkSteel'), leafF))
  g.add(inst(unitBox, glassMat(), leafG))
  g.add(inst(unitBox, material('rubber'), mats))
  g.add(inst(unitBox, material('sgnExit'), sign))
  g.add(inst(unitBox, material('black'), sensor))
  return g
}
