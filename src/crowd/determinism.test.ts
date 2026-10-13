import { describe, expect, it } from 'vitest'
import { createRng } from '../features/shared/rng'
import { Crowd } from './crowd'
import { type Door, type Wall, type Waypoint } from './types'

function setupCrowdWithSeed(seed: number, agentCount = 20) {
  const rng = createRng(seed)
  const crowd = new Crowd({}, 64)

  // Add walls
  const walls: Wall[] = [
    { ax: 0, az: 0, bx: 20, bz: 0 },
    { ax: 20, az: 0, bx: 20, bz: 20 },
    { ax: 20, az: 20, bx: 0, bz: 20 },
    { ax: 0, az: 20, bx: 0, bz: 0 },
  ]
  crowd.addWalls(walls)

  // Add a door
  const door: Door = { id: 'door1', ax: 10, az: 0, bx: 12, bz: 0, flowPerMeter: 1.3 }
  crowd.addDoor(door)

  // Add a queue
  const queuePath = [
    { x: 10, z: 10 },
    { x: 10, z: 15 },
    { x: 5, z: 15 },
  ]
  crowd.addQueue('q1', queuePath, 0.65)

  // Add agents generated with rng
  for (let i = 0; i < agentCount; i++) {
    const pos = {
      x: rng.int(2, 18),
      z: rng.int(2, 18),
    }
    const route: Waypoint[] = [
      { x: rng.int(2, 18), z: rng.int(2, 18) },
      { x: 11, z: 0, doorId: 'door1' },
      { x: rng.int(2, 18), z: rng.int(2, 18) },
    ]
    const radius = 0.2 + rng.next() * 0.1
    const speed = 1.0 + rng.next() * 0.6

    const id = crowd.addAgent({ pos, route, radius, speed })

    // Optionally join queue for some agents
    if (i % 4 === 0) {
      crowd.joinQueue(id, 'q1')
    }
  }

  return crowd
}

function captureState(crowd: Crowd) {
  const positions: Array<{ x: number; z: number; vx: number; vz: number; state: number; alive: number }> = []
  for (let i = 0; i < crowd.n; i++) {
    positions.push({
      x: crowd.x[i],
      z: crowd.z[i],
      vx: crowd.vx[i],
      vz: crowd.vz[i],
      state: crowd.state[i],
      alive: crowd.alive[i],
    })
  }
  return positions
}

describe('crowd determinism tests', () => {
  it('produces identical agent positions and velocities for the same seed after N ticks', () => {
    const seed = 12345
    const dt = 0.1
    const ticks = 100

    const crowdA = setupCrowdWithSeed(seed, 25)
    const crowdB = setupCrowdWithSeed(seed, 25)

    for (let t = 0; t < ticks; t++) {
      crowdA.step(dt)
      crowdB.step(dt)
    }

    const stateA = captureState(crowdA)
    const stateB = captureState(crowdB)

    expect(stateA).toHaveLength(stateB.length)

    for (let i = 0; i < stateA.length; i++) {
      expect(stateA[i].x).toBe(stateB[i].x)
      expect(stateA[i].z).toBe(stateB[i].z)
      expect(stateA[i].vx).toBe(stateB[i].vx)
      expect(stateA[i].vz).toBe(stateB[i].vz)
      expect(stateA[i].state).toBe(stateB[i].state)
      expect(stateA[i].alive).toBe(stateB[i].alive)
    }
  })

  it('produces different agent positions for different seeds after N ticks', () => {
    const seedA = 10001
    const seedB = 99999
    const dt = 0.1
    const ticks = 50

    const crowdA = setupCrowdWithSeed(seedA, 25)
    const crowdB = setupCrowdWithSeed(seedB, 25)

    for (let t = 0; t < ticks; t++) {
      crowdA.step(dt)
      crowdB.step(dt)
    }

    const stateA = captureState(crowdA)
    const stateB = captureState(crowdB)

    expect(stateA).toHaveLength(stateB.length)

    let differences = 0
    for (let i = 0; i < stateA.length; i++) {
      if (
        Math.abs(stateA[i].x - stateB[i].x) > 1e-4 ||
        Math.abs(stateA[i].z - stateB[i].z) > 1e-4
      ) {
        differences++
      }
    }

    expect(differences).toBeGreaterThan(0)
  })

  it('maintains determinism across queue servicing and agent arrival state changes', () => {
    const seed = 424242
    const dt = 0.05
    const ticks = 200

    const crowdA = setupCrowdWithSeed(seed, 15)
    const crowdB = setupCrowdWithSeed(seed, 15)

    for (let t = 0; t < ticks; t++) {
      crowdA.step(dt)
      crowdB.step(dt)

      // Periodically serve head of queue on both crowds
      if (t % 30 === 0) {
        const route = [{ x: 18, z: 18 }]
        const servedA = crowdA.serveHead('q1', route)
        const servedB = crowdB.serveHead('q1', route)
        expect(servedA).toBe(servedB)
      }
    }

    const stateA = captureState(crowdA)
    const stateB = captureState(crowdB)

    for (let i = 0; i < stateA.length; i++) {
      expect(stateA[i].x).toBe(stateB[i].x)
      expect(stateA[i].z).toBe(stateB[i].z)
      expect(stateA[i].state).toBe(stateB[i].state)
    }
  })
})
