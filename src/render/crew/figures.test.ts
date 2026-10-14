import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
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
})