/** Cargo family: cargo shed with roll-up doors and loading docks. */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, emblem, HALF, M, mat, pad, sign, tmat } from './kit'

export function cargo(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('dock_floor', '#9a9894', 3, 3, { rough: 0.9 }))
  const wall = tmat('warehouse_panels', '#b7aa98', 4, 1, { rough: 0.7 })
  box(g, 8.2, 3.2, 5.6, wall, 0, 0.12, -1.4)
  // Ribbed cladding.
  for (let i = 0; i < 20; i++) box(g, 0.05, 3.2, 0.06, mat('#6a6258'), -4 + i * 0.42, 0.12, 1.4)
  box(g, 8.4, 0.2, 5.8, tmat('roof_membrane', '#9aa0a6', 3, 2), 0, 3.32, -1.4)
  // Raised dock with bumpers, 4 roll-up doors with dock levellers.
  box(g, 8.2, 0.9, 1.2, M.concrete(), 0, 0.12, 2.0)
  for (let i = 0; i < 4; i++) {
    const x = -3.0 + i * 2.0
    const door = box(g, 1.5, 1.8, 0.06, mat('#d7a43b', { metal: 0.4, rough: 0.45 }), x, 1.02, 1.45)
    animate(door, { kind: 'roll', signal: 'dockActive', amount: 1.8, point: i })
    box(g, 1.6, 0.25, 0.3, M.darkSteel(), x, 2.82, 1.5) // shutter head box
    const lev = new THREE.Group()
    lev.position.set(x, 1.02, 2.6)
    box(lev, 1.3, 0.05, 0.6, M.steel(), 0, 0, 0.3)
    animate(lev, { kind: 'rot', signal: 'dockActive', axis: 'x', amount: 0.35, point: i })
    g.add(lev)
    box(g, 0.2, 0.4, 0.2, M.black(), x - 0.85, 0.5, 2.62)
    box(g, 0.2, 0.4, 0.2, M.black(), x + 0.85, 0.5, 2.62)
    box(g, 1.7, 0.18, 0.06, M.glow('#ffd27a'), x, 2.95, 1.46)
  }
  // ULD containers + a trailer backed onto a dock.
  for (let i = 0; i < 3; i++) box(g, 1.1, 1.1, 1.1, mat('#b8c0c8', { metal: 0.5, rough: 0.4 }), -3.4 + i * 1.2, 0.12, 3.6)
  const trailer = box(g, 1.6, 1.9, 3.4, M.white(), 2.0, 0.6, 3.6)
  trailer.name = 'trailer'
  box(g, 1.7, 0.4, 3.4, M.darkSteel(), 2.0, 0.2, 3.6)
  sign(g, 'CARGO', '#d7a43b', '#1d2126', 2.6, 0.55, 0, 3.75, 1.35)
  emblem(g, 'box', '#8a5a1f', 2.6, 0, 3.53, -1.4, true)
  emblem(g, 'box', '#8a5a1f', 0.9, 3.6, 2.4, 1.45)
}
