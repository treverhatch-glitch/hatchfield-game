import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { WORLD_PER_METER } from '../aircraft/specs.ts'
import { CrewFigures } from './figures.ts'
import type { CrewScene } from '../../ramp/present.ts'

function scene(people: CrewScene['people']): CrewScene {
  return { people, props: [], jobs: [] }
}

function person(id: string, c: number): CrewScene['people'][number] {
  return { id, role: 'driver', service: 'fuel', c, r: 0, alt: 0, heading: 0, pose: 'walk' }
}

describe('crew figures', () => {
  it('draws a close walker and skips a far one', () => {
    const parent = new THREE.Group()
    const figures = new CrewFigures(parent)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 2, 0)
    const toWorld = (c: number, _r: number, y: number) => new THREE.Vector3(c, y, 0)
    const stats = figures.update(scene([person('close', 2), person('far', 500)]), camera, 0.016, false, toWorld)
    expect(stats.full).toBe(1)
    expect(stats.hidden).toBe(1)
    expect(parent.children).toHaveLength(1)
    const lite = figures.update(scene([person('close', 2)]), camera, 0.016, true, toWorld)
    expect(lite.full).toBe(0)
    expect(lite.dots).toBe(1)
    figures.dispose()
    expect(parent.children).toHaveLength(0)
  })

  it('keeps a close figure at adult height', () => {
    const parent = new THREE.Group()
    const figures = new CrewFigures(parent)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 2, 5)
    const toWorld = (c: number, _r: number, y: number) => new THREE.Vector3(c, y, 0)
    figures.update(scene([person('close', 0)]), camera, 0.016, false, toWorld)
    parent.updateMatrixWorld(true)
    const box = new THREE.Box3()
    const tmp = new THREE.Box3()
    const m = new THREE.Matrix4()
    figures.group.traverse((obj) => {
      const mesh = obj as THREE.InstancedMesh
      if (!mesh.isInstancedMesh || mesh.count < 1 || !mesh.name.startsWith('people-')) return
      mesh.geometry.computeBoundingBox()
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m)
        m.premultiply(mesh.matrixWorld)
        tmp.copy(mesh.geometry.boundingBox!).applyMatrix4(m)
        box.union(tmp)
      }
    })
    const metres = (box.max.y - box.min.y) / WORLD_PER_METER
    expect(metres).toBeGreaterThan(1.55)
    expect(metres).toBeLessThan(2.05)
    figures.dispose()
  })
})