import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createCrowd, poseFor, type CrowdAgent, type Role } from './index'

const ROLES: Role[] = ['passenger', 'checkin', 'security', 'gate', 'shop', 'cleaner', 'researcher']
function agents(n: number): CrowdAgent[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, role: i % 10 ? 'passenger' : ROLES[(i / 10) % 7 | 0], pos: { x: (i % 70) * 1.2, z: ((i / 70) | 0) * 1.2 }, heading: i, state: 'walking', bagIds: i % 3 ? [`b${i}`] : [] }))
}

describe('people crowd', () => {
  it('renders 5000 agents through instancing with few draw calls', () => {
    const scene = new THREE.Scene(); const crowd = createCrowd(scene)
    const s = crowd.update(agents(5000))
    expect(s.visible).toBe(5000)
    expect(s.drawCalls).toBeLessThanOrEqual(8)
    expect(scene.getObjectByName('people-lod0')).toBeInstanceOf(THREE.InstancedMesh)
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
  it('hides checked bags after drop and shows staff props', () => {
    const scene = new THREE.Scene(); const crowd = createCrowd(scene)
    const a: CrowdAgent = { id: 'x', role: 'passenger', pos: [0, 0, 0], heading: 0, state: 'queue_checkin', bagIds: ['b1'] }
    expect(crowd.update([a]).props.checked).toBe(1)
    expect(crowd.update([{ ...a, bagsDropped: true }]).props.checked).toBe(0)
    expect(crowd.update([{ ...a, state: 'to_security' }]).props.checked).toBe(0)
    const s = crowd.update([{ id: 'r', role: 'researcher', pos: [0, 0, 0], heading: 0, state: 'research' }, { id: 's', role: 'security', pos: [1, 0, 0], heading: 0 }])
    expect(s.props.desk).toBe(1); expect(s.props.cap).toBe(1)
  })
  it('maps sim states to poses', () => {
    expect(poseFor('passenger', 'seated_gate', false)).toBe('seated')
    expect(poseFor('passenger', 'queue_security', false)).toBe('queue')
    expect(poseFor('passenger', 'walking', true)).toBe('walk')
    expect(poseFor('researcher', undefined, false)).toBe('working')
    expect(poseFor('checkin', 'serving', false)).toBe('idle')
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
