import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createCrewMesh, createPassengerMesh } from './api.ts'
import { PEOPLE_LOD } from './config.ts'
import { crewAgent, crewKindFor } from './crewAdapter.ts'
import { assignPeopleLod, lodForDistance } from './lod.ts'
import { InstancePool } from './pool.ts'
import { advancePhase, samplePose, strideRate } from './pose.ts'
import { PeopleRenderer, type PeopleAgent } from './renderer.ts'
import { CREW_KINDS, PERSON_POSES } from './types.ts'
import { crewLook, followSlot, groupLooks, passengerLook } from './variants.ts'

describe('variants', () => {
  it('is deterministic per seed and varied across seeds', () => {
    expect(passengerLook('a')).toEqual(passengerLook('a'))
    const keys = new Set<string>()
    for (let i = 0; i < 300; i++) keys.add(passengerLook(i).key)
    expect(keys.size).toBeGreaterThan(200)
  })

  it('covers skin tones, hair, hats, backpacks and luggage', () => {
    const looks = Array.from({ length: 600 }, (_, i) => passengerLook(`p${i}`))
    expect(new Set(looks.map((l) => l.skin)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(looks.map((l) => l.hair))).toEqual(new Set(['none', 'short', 'long', 'bun']))
    expect(new Set(looks.map((l) => l.hat)).size).toBeGreaterThanOrEqual(4)
    expect(looks.some((l) => l.backpack)).toBe(true)
    expect(new Set(looks.map((l) => l.carry))).toEqual(new Set(['none', 'roller', 'duffel', 'cart']))
  })

  it('gives every crew kind a distinct uniform', () => {
    const outfits = CREW_KINDS.map((k) => {
      const look = crewLook(k, 1)
      return `${look.top}.${look.bottom}.${look.hat}.${look.vest}`
    })
    expect(new Set(outfits).size).toBe(CREW_KINDS.length)
    expect(crewLook('marshaller', 1).wands).toBe(true)
    expect(crewLook('ground', 1).vest).not.toBe(0)
    expect(crewLook('pilot', 1).vest).toBe(0)
  })

  it('paints cabin crew in the airline colours', () => {
    const look = crewLook('cabin', 3, { airline: { primary: 0xaa0000, secondary: 0xffffff } })
    expect(look.top).toBe(0xaa0000)
    expect(look.bottom).toBe(0xffffff)
  })

  it('makes kids smaller than adults and keeps them near the lead', () => {
    const family = groupLooks('fam', 4, 2)
    expect(family.filter((m) => m.look.age !== 'adult')).toHaveLength(2)
    const adult = family[0].look.height
    for (const kid of family.filter((m) => m.look.age === 'kid')) expect(kid.look.height).toBeLessThan(adult)
    const lead = { x: 10, z: 5, heading: 0.7 }
    const pos = { x: 40, z: -30 }
    let cur = pos
    for (let i = 0; i < 200; i++) cur = followSlot(lead, family[3].slot, cur, 1.6, 0.1, 1.5)
    expect(Math.hypot(cur.x - lead.x, cur.z - lead.z)).toBeLessThanOrEqual(1.6 + 1e-6)
    const first = followSlot(lead, family[3].slot, pos, 1.6, 0.1, 1.5)
    expect(Math.hypot(first.x - lead.x, first.z - lead.z)).toBeLessThanOrEqual(1.6 + 1e-6)
  })
})

describe('lod', () => {
  it('picks levels by distance', () => {
    expect(lodForDistance(5)).toBe(0)
    expect(lodForDistance(PEOPLE_LOD.nearDistance + 1)).toBe(1)
    expect(lodForDistance(PEOPLE_LOD.midDistance + 1)).toBe(2)
    expect(lodForDistance(PEOPLE_LOD.farDistance + 1)).toBe(-1)
  })

  it('gives the closest people the better level when a level is over budget', () => {
    const limits = { ...PEOPLE_LOD, nearCap: 2, midCap: 1 }
    const d = [10, 3, 20, 5, 90]
    const out = assignPeopleLod(d, false, limits)
    expect(out[1]).toBe(0)
    expect(out[3]).toBe(0)
    expect(out[0]).toBe(1)
    expect(out[2]).toBe(2)
    expect(out[4]).toBe(2)
  })

  it('never spends a full body in lite mode', () => {
    expect(assignPeopleLod([1, 2, 3], true)).toEqual([1, 1, 1])
  })
})

describe('instance pool', () => {
  it('hands out sequential slots per batch and reports overflow', () => {
    const pool = new InstancePool(2)
    expect([pool.take('a'), pool.take('a'), pool.take('a'), pool.take('b')]).toEqual([0, 1, -1, 0])
    expect(pool.count('a')).toBe(2)
    expect(pool.overflow('a')).toBe(1)
    expect(pool.overflow()).toBe(1)
    pool.reset()
    expect(pool.count('a')).toBe(0)
    expect(pool.take('a')).toBe(0)
    expect(pool.overflow()).toBe(0)
  })
})

describe('poses', () => {
  it('ties stride rate to speed', () => {
    expect(strideRate(0)).toBe(0)
    expect(strideRate(2)).toBeGreaterThan(strideRate(1))
    expect(strideRate(100)).toBeLessThanOrEqual(3.2)
    const phase = advancePhase(0.9, 1.3, 1)
    expect(phase).toBeCloseTo(0.9, 5)
    expect(advancePhase(0, 0, 1)).toBe(0)
  })

  it('walks with opposite legs and arms, and swings more when faster', () => {
    const slow = samplePose('walk', 0.25, 0.3)
    const fast = samplePose('walk', 0.25, 1.4)
    expect(fast.legL).toBeCloseTo(-fast.legR)
    expect(fast.armL).toBeCloseTo(-fast.legL * (0.5 / 0.6))
    expect(Math.abs(fast.legL)).toBeGreaterThan(Math.abs(slow.legL))
  })

  it('has a distinct shape for every pose', () => {
    const shapes = new Set(PERSON_POSES.map((p) => JSON.stringify(samplePose(p, 0.3, 1))))
    expect(shapes.size).toBe(PERSON_POSES.length)
    expect(samplePose('bagPull', 0.3, 1).armR).toBeLessThan(0)
    expect(samplePose('seated', 0, 0).drop).toBeGreaterThan(0)
  })
})

function agent(id: string, x: number, pose: PeopleAgent['pose'] = 'walk'): PeopleAgent {
  return { id, look: passengerLook(id), x, y: 0, z: -5, yaw: 0, pose, speed: 1.2 }
}

function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
  cam.position.set(0, 3, 10)
  cam.lookAt(0, 1, -5)
  return cam
}

describe('renderer', () => {
  it('batches by part and levels, and refills each frame without growth', () => {
    const parent = new THREE.Group()
    const r = new PeopleRenderer(parent, { capacity: 64 })
    const cam = camera()
    const people = [agent('a', 0), agent('b', 1), agent('c', -1)]
    // Far one lands in the block mesh.
    people.push({ ...agent('far', 0), z: -150 })
    const stats = r.update(people, cam, 0.016)
    expect(stats.near).toBe(3)
    expect(stats.far).toBe(1)
    expect(r.mesh('torso')!.count).toBe(3)
    expect(r.mesh('block')!.count).toBe(1)
    const again = r.update(people.slice(0, 1), cam, 0.016)
    expect(again.near).toBe(1)
    expect(r.mesh('torso')!.count).toBe(1)
    expect(r.mesh('block')!.count).toBe(0)
    r.dispose()
    expect(parent.children).toHaveLength(0)
  })

  it('draws the same number of meshes however many people there are', () => {
    const parent = new THREE.Group()
    const r = new PeopleRenderer(parent, { capacity: 3000 })
    const many = Array.from({ length: 2500 }, (_, i) => agent(`p${i}`, (i % 50) - 25, i % 3 ? 'walk' : 'queue'))
    const before = r.group.children.length
    r.update(many, camera(), 0.016)
    expect(r.group.children.length).toBe(before)
    expect(r.stats.overflow).toBe(0)
    r.dispose()
  })

  it('reports overflow instead of writing past capacity', () => {
    const r = new PeopleRenderer(new THREE.Group(), { capacity: 2 })
    r.update([agent('a', 0), agent('b', 1), agent('c', 2)], camera(), 0.016)
    expect(r.mesh('torso')!.count).toBe(2)
    expect(r.stats.overflow).toBeGreaterThan(0)
  })

  it('advances walk phase with speed and not while stationary', () => {
    const r = new PeopleRenderer(new THREE.Group(), { capacity: 8 })
    const cam = camera()
    const m = new THREE.Matrix4()
    const leg = () => {
      r.mesh('legL')!.getMatrixAt(0, m)
      return m.elements[6]
    }
    const still = { ...agent('s', 0, 'reach'), speed: 0 }
    r.update([still], cam, 0.1)
    const a = leg()
    r.update([still], cam, 0.1)
    expect(leg()).toBeCloseTo(a)
    const walker = agent('w', 0)
    r.update([walker], cam, 0.1)
    const w1 = leg()
    r.update([walker], cam, 0.1)
    expect(leg()).not.toBeCloseTo(w1)
  })
})

describe('static meshes', () => {
  it('builds passenger and crew groups with their accessories', () => {
    const pax = createPassengerMesh('x', { carry: 'roller' })
    expect(pax.getObjectByName('roller')).toBeDefined()
    expect(pax.getObjectByName('torso')).toBeDefined()
    const marshaller = createCrewMesh('marshaller', 1, { pose: 'wave' })
    expect(marshaller.getObjectByName('wandR')).toBeDefined()
    expect(marshaller.getObjectByName('hatHelmet')).toBeDefined()
    const block = createCrewMesh('pilot', 1, { lod: 2 })
    expect(block.children).toHaveLength(1)
  })
})

describe('ramp crew adapter', () => {
  it('maps services and roles to uniforms and poses', () => {
    expect(crewKindFor('fuel', 'driver')).toBe('fuel')
    expect(crewKindFor('gpu', 'helper')).toBe('maintenance')
    expect(crewKindFor('pushback', 'walker')).toBe('marshaller')
    expect(crewKindFor('bags', 'driver')).toBe('ground')
    const base = { id: 'm1', role: 'walker' as const, service: 'pushback' as const, heading: 0 }
    const at = { x: 0, y: 0, z: 0 }
    expect(crewAgent({ ...base, pose: 'idle' }, at).pose).toBe('wave')
    expect(crewAgent({ ...base, pose: 'walk' }, at).speed).toBeGreaterThan(0)
    expect(crewAgent({ ...base, pose: 'idle' }, at).speed).toBe(0)
  })
})
