import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createAircraft, releaseAircraft } from './factory'

describe('releasing an aircraft', () => {
  it('frees the bay doors and doorways merged for that airframe', () => {
    const aircraft = createAircraft('b738', { body: '#2f6f9a', stripe: '#e8eef5' })
    const owned: THREE.BufferGeometry[] = []
    aircraft.traverse((obj) => {
      if (obj.name === 'bay-doors' || obj.name === 'doorways') owned.push((obj as THREE.Mesh).geometry)
    })
    expect(owned.length).toBeGreaterThan(0)
    let freed = 0
    for (const geo of owned) geo.addEventListener('dispose', () => (freed += 1))
    releaseAircraft(aircraft)
    expect(freed).toBe(owned.length)
  })

  it('leaves pooled geometry shared by the next airframe alone', () => {
    const first = createAircraft('b738', { body: '#2f6f9a', stripe: '#e8eef5' })
    const shells: THREE.BufferGeometry[] = []
    first.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.userData.ownGeo && !(obj as THREE.InstancedMesh).isInstancedMesh) {
        shells.push((obj as THREE.Mesh).geometry)
      }
    })
    let freed = 0
    for (const geo of shells) geo.addEventListener('dispose', () => (freed += 1))
    releaseAircraft(first)
    expect(freed).toBe(0)
  })
})
