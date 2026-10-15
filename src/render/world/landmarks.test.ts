import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PRESTIGE_LANDMARKS } from '../../content/buildings_tier3.ts'
import { addLandmark, animateLandmarkPart } from './landmarks.ts'

describe('landmark meshes', () => {
  it('draws every landmark with something that moves', () => {
    for (const row of PRESTIGE_LANDMARKS) {
      const g = new THREE.Group()
      addLandmark(g, row.id)
      expect(g.children.length, row.id).toBeGreaterThan(4)
      const moving: THREE.Object3D[] = []
      g.traverse((obj) => {
        if (obj.name.startsWith('landmark-')) moving.push(obj)
      })
      expect(moving.length, row.id).toBeGreaterThan(0)
      for (const obj of moving) animateLandmarkPart(obj, 3.3)
    }
  })

  it('moves the tower lift between its stops', () => {
    const g = new THREE.Group()
    addLandmark(g, 'observation_tower')
    const lift = g.getObjectByName('landmark-lift')!
    animateLandmarkPart(lift, 0)
    const low = lift.position.y
    animateLandmarkPart(lift, Math.PI / 0.9)
    expect(lift.position.y).toBeGreaterThan(low)
  })

  it('draws nothing for an unknown id', () => {
    const g = new THREE.Group()
    addLandmark(g, 'nope')
    expect(g.children).toHaveLength(0)
  })
})
