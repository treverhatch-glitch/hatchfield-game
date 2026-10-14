/** Hotel family: inn (low gabled), business (glass slab), resort (terraced + pool). */
import * as THREE from 'three'
import type { HotelClass } from '../../game/types'
import { box, cyl, emblem, HALF, M, mat, pad, sign } from './kit'

function windowGrid(g: THREE.Object3D, w: number, y0: number, floors: number, fh: number, z: number, n: number, glow = '#ffe0a0') {
  for (let f = 0; f < floors; f++)
    for (let i = 0; i < n; i++) box(g, (w / n) * 0.6, fh * 0.5, 0.05, (f + i) % 3 ? M.glass() : M.glow(glow), -w / 2 + (w / n) * (i + 0.5), y0 + f * fh + fh * 0.25, z)
}

export function hotel(g: THREE.Group, cls: HotelClass = 'business'): void {
  pad(g, HALF * 2, HALF * 2, mat('#c9c2b2', { rough: 0.9 }))
  if (cls === 'inn') {
    box(g, 7.0, 2.6, 3.6, mat('#e9dcc4', { rough: 0.8 }), 0, 0.12, -1.0)
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.6, 7.2, 3, 1), mat('#8a3b2a', { rough: 0.7 }))
    roof.rotation.z = Math.PI / 2
    roof.rotation.x = Math.PI / 6
    roof.scale.set(1, 1, 0.55)
    roof.position.set(0, 3.3, -1.0)
    roof.castShadow = true
    g.add(roof)
    windowGrid(g, 6.4, 0.12, 2, 1.3, 0.82, 6)
    box(g, 1.4, 1.6, 1.0, mat('#e9dcc4'), 0, 0.12, 1.3)
    box(g, 2.0, 0.14, 1.4, mat('#8a3b2a'), 0, 1.72, 1.4)
    for (const x of [-3, 3]) cyl(g, 0.7, 0.2, 1.4, mat('#3f7a3a'), x, 0.12, 2.8, 10)
    sign(g, 'AIRPORT INN', '#8a3b2a', '#fff4dc', 2.2, 0.4, 0, 2.15, 1.82)
    emblem(g, 'cup', '#8a3b2a', 0.8, 2.6, 2.2, 0.83)
  } else if (cls === 'resort') {
    const terr = mat('#f3efe6', { rough: 0.6 })
    for (let f = 0; f < 4; f++) {
      box(g, 8.0 - f * 1.4, 1.4, 4.2 - f * 0.7, terr, -0.0, 0.12 + f * 1.4, -1.6 - f * 0.1)
      box(g, 8.0 - f * 1.4, 0.4, 0.06, mat('#3f7a3a'), 0, 0.12 + f * 1.4 + 1.4, 0.5 - f * 0.45)
      windowGrid(g, 7.4 - f * 1.4, 0.12 + f * 1.4, 1, 1.4, 0.52 - f * 0.45, 7 - f)
    }
    box(g, 4.2, 0.08, 1.8, mat('#3fb0d8', { rough: 0.05, emissive: '#1a6080', ei: 0.4 }), -1.6, 0.12, 2.9)
    for (const x of [2.2, 3.4]) {
      cyl(g, 0.08, 0.12, 2.8, mat('#7a5a3a'), x, 0.12, 3.0, 6)
      cyl(g, 0.02, 1.0, 0.5, mat('#3f7a3a'), x, 2.8, 3.0, 7)
    }
    sign(g, 'RESORT', '#c9a227', '#ffffff', 1.8, 0.4, 0, 5.85, -0.86)
    emblem(g, 'eye', '#c9a227', 1.6, 0, 6.32, -1.9, true)
  } else {
    box(g, 4.4, 9.0, 3.4, mat('#cfd8e3', { metal: 0.4, rough: 0.3 }), 0, 0.12, -1.2)
    box(g, 4.3, 8.6, 0.06, mat('#5d8fb5', { rough: 0.05, metal: 0.6, emissive: '#1a3a55', ei: 0.35 }), 0, 0.4, 0.52)
    windowGrid(g, 4.0, 0.4, 8, 1.07, 0.56, 6, '#fff1c8')
    box(g, 7.6, 1.6, 2.4, mat('#e8edf2'), 0, 0.12, 1.4)
    box(g, 8.0, 0.14, 2.6, M.darkSteel(), 0, 1.72, 1.6)
    box(g, 1.6, 0.6, 1.4, M.steel(), 0, 9.12, -1.2)
    sign(g, 'BUSINESS HOTEL', '#1d2126', '#c9a227', 3.4, 0.42, 0, 1.25, 2.62)
    emblem(g, 'eye', '#1d2126', 1.2, 0, 8.4, 0.58)
  }
}
