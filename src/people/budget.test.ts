import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { budgetByPart, measureBudget } from './budget.ts'
import { PeopleRenderer, type PeopleAgent } from './renderer.ts'
import { CREW_KINDS } from './types.ts'
import { crewLook, passengerLook } from './variants.ts'

/** 1,300 walkers on a grid, a crew member every twelfth. */
function walkers(n: number): PeopleAgent[] {
  const out: PeopleAgent[] = []
  for (let i = 0; i < n; i++) {
    const look = i % 12 === 0 ? crewLook(CREW_KINDS[((i / 12) | 0) % CREW_KINDS.length], i) : passengerLook(i, { age: i % 9 === 0 ? 'kid' : 'adult' })
    out.push({ id: `a${i}`, look, x: (i % 40) * 3, y: 0, z: Math.floor(i / 40) * 3, yaw: 0, pose: 'walk', speed: 1.2 })
  }
  return out
}

describe('people budget', () => {
  it('1,300 walkers stay within the draw-call and triangle budget', () => {
    const scene = new THREE.Scene()
    const r = new PeopleRenderer(scene, { capacity: 2000 })
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000)
    cam.position.set(60, 6, -12)
    cam.lookAt(60, 0, 40)
    r.update(walkers(1300), cam, 0.016)
    const b = measureBudget(r)
    console.log('BUDGET', JSON.stringify({ ...r.stats, ...b }), JSON.stringify(budgetByPart(r)))
    expect(r.stats.overflow).toBe(0)
    expect(b.draws).toBeLessThanOrEqual(BUDGET.draws)
    expect(b.triangles).toBeLessThanOrEqual(BUDGET.triangles)
  })
})

// Same camera on current main, before this pass: 29 draws, 57,199 triangles, ~2.13 ms.
// Sheet props add the briefcase mesh (30 draws) and 59,051 triangles (~2.00 ms).
// Triangles stay inside 5% of 57,199.
const BUDGET = { draws: 30, triangles: 60059 }
