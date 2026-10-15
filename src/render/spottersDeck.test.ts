import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { addSpottersDeck } from './spottersDeck.ts'

describe('Spotters deck presentation', () => {
  it('draws the raised deck and the configured visible crowd', () => {
    const root = new THREE.Group()
    addSpottersDeck(root, 18)

    expect(root.name).toBe('spotters-deck')
    const body = root.getObjectByName('spotter-crowd-body')
    const head = root.getObjectByName('spotter-crowd-head')
    const camera = root.getObjectByName('spotter-crowd-camera')
    expect(body).toBeInstanceOf(THREE.InstancedMesh)
    expect((body as THREE.InstancedMesh).count).toBe(18)
    expect((head as THREE.InstancedMesh).count).toBe(18)
    expect((camera as THREE.InstancedMesh).count).toBe(18)
  })
})
