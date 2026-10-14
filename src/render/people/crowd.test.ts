import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createCrowd, poseFor, type CrowdAgent, type Role } from './index'
import { lookFor, personPose } from './roles'

const ROLES: Role[] = ['passenger', 'checkin', 'security', 'gate', 'shop', 'cleaner', 'researcher']
function agents(n: number): CrowdAgent[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, role: i % 10 ? 'passenger' : ROLES[(i / 10) % 7 | 0], pos: { x: (i % 70) * 1.2, z: ((i / 70) | 0) * 1.2 }, heading: i, state: 'walking', bagIds: i % 3 ? [`b${i}`] : [] }))
}
function instances(scene: THREE.Object3D): number {
  let n = 0
  scene.traverse((o) => { if (o instanceof THREE.InstancedMesh) n += o.count })
  return n
}

describe('people crowd', () => {
  it('renders 2500 agents through instancing with few draw calls', () => {
    const scene = new THREE.Scene(); const crowd = createCrowd(scene, { capacity: 4096 })
    const s = crowd.update(agents(2500))
    expect(s.visible).toBe(2500)
    expect(s.drawCalls).toBeLessThanOrEqual(40)
    expect(instances(scene)).toBeGreaterThan(2500)
    expect(scene.getObjectByName('people-torso')).toBeInstanceOf(THREE.InstancedMesh)
    crowd.dispose(); expect(scene.getObjectByName('people')).toBeUndefined()
  })
  it('picks LOD tiers by camera distance and culls off-screen', () => {
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    cam.position.set(0, 2, -5); cam.lookAt(0, 0, 100); cam.updateMatrixWorld()
    const crowd = createCrowd(scene, { camera: cam })
    const s = crowd.update([
      { id: 'near', role: 'passenger', pos: [0, 0, 10], heading: 0 },
      { id: 'mid', role: 'passenger', pos: [0, 0, 60], heading: 0 },
      { id: 'far', role: 'passenger', pos: [0, 0, 200], heading: 0 },
      { id: 'behind', role: 'passenger', pos: [0, 0, -50], heading: 0 },
    ])
    expect(s.lod).toEqual([1, 1, 1]); expect(s.culled).toBe(1)
  })
  it('scales distances and bodies by unitsPerMeter', () => {
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    cam.position.set(0, 1, -2); cam.lookAt(0, 0, 100); cam.updateMatrixWorld()
    const crowd = createCrowd(scene, { camera: cam, unitsPerMeter: 0.5 })
    // 40 world units is 80 m: simple body, not full.
    expect(crowd.update([{ id: 'a', role: 'passenger', pos: [0, 0, 40], heading: 0 }]).lod).toEqual([0, 1, 0])
  })
  it('gives a passenger with a checked bag a bag to wheel', () => {
    expect(lookFor('x', 'passenger', true).carry).toMatch(/roller|duffel/)
    expect(lookFor('x', 'passenger', false).carry).toBe(lookFor('x', 'passenger').carry)
  })
  it('dresses staff in crew uniforms and keeps looks stable per id', () => {
    expect(lookFor('s', 'security').crew).toBe('security')
    expect(lookFor('c', 'checkin').crew).toBe('cabin')
    expect(lookFor('c', 'cleaner').crew).toBe('maintenance')
    expect(lookFor('r', 'researcher').top).toBe(0xf1f5f9)
    expect(lookFor('r', 'shop').carry).toBe('none')
    expect(lookFor('p1', 'passenger').key).toBe(lookFor('p1', 'passenger').key)
  })
  it('maps sim states to poses', () => {
    expect(poseFor('passenger', 'seated_gate', false)).toBe('seated')
    expect(poseFor('passenger', 'queue_security', false)).toBe('queue')
    expect(poseFor('passenger', 'walking', true)).toBe('walk')
    expect(poseFor('researcher', undefined, false)).toBe('working')
    expect(poseFor('checkin', 'serving', false)).toBe('idle')
    expect(personPose('working', lookFor('r', 'researcher'))).toBe('seated')
    expect(personPose('walk', lookFor('p', 'passenger', true))).toBe('bagPull')
  })
  it('drops people who leave the agent list', () => {
    const scene = new THREE.Scene(); const crowd = createCrowd(scene)
    expect(crowd.update(agents(5)).visible).toBe(5)
    expect(crowd.update(agents(2)).visible).toBe(2)
    expect(crowd.update([]).visible).toBe(0)
    expect(instances(scene)).toBe(0)
  })
  it('thought bubbles follow their agent and expire', () => {
    const scene = new THREE.Scene(); const crowd = createCrowd(scene)
    const a: CrowdAgent = { id: 7, role: 'passenger', pos: [3, 0, 4], heading: 0 }
    const sp = crowd.showThought(7, { icon: '🍔', text: 'wish they had burgers', duration: 1 })
    crowd.update([a], 0.1)
    expect(sp.position.toArray()).toEqual([3, 2.3, 4]); expect(crowd.stats.thoughts).toBe(1)
    crowd.update([a], 2); expect(crowd.stats.thoughts).toBe(0)
  })
})
