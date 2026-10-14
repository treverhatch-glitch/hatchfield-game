import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { bubbleAnchorY, ThoughtBubbleLayer } from './bubbles.ts'

describe('instanced thought bubbles', () => {
  it('sits a closed-roof icon just above the roof', () => {
    const floor = 0.2
    const roof = 1.8
    expect(bubbleAnchorY(floor, roof, false, 2.2, 0.45)).toBe(floor)
    const anchor = bubbleAnchorY(floor, roof, true, 2.2, 0.45)
    expect(anchor + 2.2 * 0.45).toBeCloseTo(roof + 0.55 * 0.45)
  })

  it('draws one pooled mesh per icon and drops overflow', () => {
    const scene = new THREE.Scene()
    const layer = new ThoughtBubbleLayer(scene, { capacity: 2, unit: 1, head: 2 })
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(0, 2, 5)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()

    const stats = layer.sync(
      [
        { id: 'a', icon: 'queue', x: 1, y: 0, z: 0 },
        { id: 'b', icon: 'queue', x: 3, y: 0, z: 1 },
        { id: 'c', icon: 'queue', x: 5, y: 0, z: 2 },
        { id: 'd', icon: 'delight', x: 0, y: 0, z: 4 },
      ],
      cam,
    )
    expect(stats.drawn).toBe(3)
    expect(stats.overflow).toBe(1)
    expect(stats.drawCalls).toBe(2)
    expect(scene.getObjectByName('feedback-bubble-queue')).toBeInstanceOf(THREE.InstancedMesh)
    expect(layer.mesh('queue')?.count).toBe(2)
    expect(layer.mesh('delight')?.count).toBe(1)
    expect(layer.mesh('prices')?.count).toBe(0)

    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    layer.mesh('queue')!.getMatrixAt(0, matrix)
    pos.setFromMatrixPosition(matrix)
    expect(pos.y).toBeCloseTo(2)
    expect(pos.x).toBeCloseTo(1)

    const buffer = layer.bufferLength('queue')
    for (let i = 0; i < 30; i++) {
      layer.sync(
        i % 2 === 0
          ? [{ id: 'a', icon: 'queue', x: i, y: 0, z: 0 }]
          : [
              { id: 'a', icon: 'prices', x: 1, y: 0, z: 0 },
              { id: 'b', icon: 'delight', x: 2, y: 0, z: 0 },
            ],
        cam,
      )
    }
    expect(layer.bufferLength('queue')).toBe(buffer)
    expect(layer.capacity).toBe(2)
    layer.clear()
    expect(layer.mesh('queue')?.count).toBe(0)
    layer.dispose()
    expect(scene.getObjectByName('feedback-thoughts')).toBeUndefined()
  })
})
