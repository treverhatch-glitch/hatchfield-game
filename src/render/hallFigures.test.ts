import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FIGURE_DRAW_CALLS, FIGURE_MESHES_PER_GUEST, HallFigureBatch, separateFigureDraws, type FigureDraw } from './hallFigures'

function anchor(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Object3D {
  const node = new THREE.Object3D()
  node.position.set(x, y, z)
  parent.add(node)
  return node
}

function guest(id: string, x: number, carry: boolean): { root: THREE.Group; draw: FigureDraw } {
  const root = new THREE.Group()
  root.position.set(x, 0, 0)
  const left = new THREE.Group()
  left.position.y = 0.86
  const right = new THREE.Group()
  right.position.y = 0.86
  root.add(left, right)
  const draw: FigureDraw = {
    id,
    legL: anchor(left, 0, -0.43, 0),
    legR: anchor(right, 0, -0.43, 0),
    armL: anchor(root, -0.27, 1.14, 0),
    armR: anchor(root, 0.27, 1.14, 0),
    torso: anchor(root, 0, 1.13, 0),
    head: anchor(root, 0, 1.58, 0),
    carry: anchor(root, 0.36, 0.98, 0.06),
    showCarry: carry,
    shirt: new THREE.Color('#2458b5'),
    trousers: new THREE.Color('#1d2430'),
    skin: new THREE.Color('#e0ac69'),
  }
  return { root, draw }
}

describe('hall figure instancing', () => {
  it('collapses the five repeated body meshes to a fixed draw-call count', () => {
    const guests = 48
    const before = separateFigureDraws(guests)
    expect(before).toBe(guests * FIGURE_MESHES_PER_GUEST)
    const batch = new HallFigureBatch(guests)
    const draws: FigureDraw[] = []
    for (let i = 0; i < guests; i++) draws.push(guest(`g${i}`, i, true).draw)
    batch.write(draws)
    const after = batch.drawCalls()
    expect(after).toBe(FIGURE_DRAW_CALLS)
    expect(after).toBeLessThan(before)
    // Passenger budget from docs/PERF_BUDGET.md. Instancing does not add draws as the hall fills.
    expect(separateFigureDraws(1500)).toBe(10_500)
    expect(FIGURE_DRAW_CALLS).toBe(5)
    batch.dispose()
  })

  it('follows a swung leg and hides a guest without a carry-on', () => {
    const batch = new HallFigureBatch(2)
    const a = guest('ada', 4, true)
    a.root.rotation.y = 0.4
    const swing = a.draw.legL.parent as THREE.Object3D
    swing.rotation.x = 0.5
    const b = guest('ben', -2, false)
    batch.write([a.draw, b.draw])
    const posed = new THREE.Matrix4()
    batch.leg.getMatrixAt(0, posed)
    a.draw.legL.updateWorldMatrix(true, false)
    expect(posed.elements[12]).toBeCloseTo(a.draw.legL.matrixWorld.elements[12])
    expect(posed.elements[13]).toBeCloseTo(a.draw.legL.matrixWorld.elements[13])
    const hidden = new THREE.Matrix4()
    batch.carry.getMatrixAt(1, hidden)
    expect(hidden.elements[0]).toBe(0)
    expect(batch.guestId(0)).toBe('ada')
    expect(batch.guestId(1)).toBe('ben')
    batch.dispose()
  })
})
