import { describe, expect, it } from 'vitest'
import { Crowd } from './crowd'
import { AgentState } from './types'

const DT = 0.1

function run(c: Crowd, sec: number, each?: () => void) {
  for (let t = 0; t < sec; t += DT) {
    c.step(DT)
    each?.()
  }
}

function minPairDist(c: Crowd): number {
  let m = Infinity
  for (let i = 0; i < c.n; i++)
    for (let j = i + 1; j < c.n; j++) {
      if (!c.alive[i] || !c.alive[j]) continue
      if (c.state[i] === AgentState.Arrived || c.state[j] === AgentState.Arrived) continue
      m = Math.min(m, Math.hypot(c.x[i] - c.x[j], c.z[i] - c.z[j]))
    }
  return m
}

describe('local avoidance', () => {
  it('head-on counter-flow in a corridor passes without overlap and everyone arrives', () => {
    const c = new Crowd()
    c.addWalls([
      { ax: -20, az: -2, bx: 20, bz: -2 },
      { ax: -20, az: 2, bx: 20, bz: 2 },
    ])
    for (let k = 0; k < 8; k++) {
      const z = -1.2 + (k % 4) * 0.8
      c.addAgent({ pos: { x: -12 - Math.floor(k / 4) * 1.2, z }, route: [{ x: 12, z: 0 }] })
      c.addAgent({ pos: { x: 12 + Math.floor(k / 4) * 1.2, z }, route: [{ x: -12, z: 0 }] })
    }
    let worst = Infinity
    run(c, 40, () => (worst = Math.min(worst, minPairDist(c))))
    for (let i = 0; i < c.n; i++) expect(c.state[i]).toBe(AgentState.Arrived)
    // Two 0.25 m radii; allow a little squeeze in the crossing.
    expect(worst).toBeGreaterThan(0.3)
    for (let i = 0; i < c.n; i++) expect(Math.abs(c.z[i])).toBeLessThan(2)
  })

  it('two walkers on a collision course sidestep early instead of stopping', () => {
    const c = new Crowd()
    const a = c.addAgent({ pos: { x: -6, z: 0 }, route: [{ x: 6, z: 0 }] })
    const b = c.addAgent({ pos: { x: 6, z: 0.05 }, route: [{ x: -6, z: 0.05 }] })
    let lateral = 0
    let worst = Infinity
    run(c, 12, () => {
      lateral = Math.max(lateral, Math.abs(c.z[a]), Math.abs(c.z[b]))
      if (c.state[a] !== AgentState.Arrived && c.state[b] !== AgentState.Arrived)
        worst = Math.min(worst, Math.hypot(c.x[a] - c.x[b], c.z[a] - c.z[b]))
    })
    expect(c.state[a]).toBe(AgentState.Arrived)
    expect(c.state[b]).toBe(AgentState.Arrived)
    expect(lateral).toBeGreaterThan(0.2)
    expect(worst).toBeGreaterThan(0.4)
  })

  it('walls are never crossed', () => {
    const c = new Crowd()
    c.addWalls([{ ax: 0, az: -5, bx: 0, bz: 5 }])
    for (let k = 0; k < 10; k++) c.addAgent({ pos: { x: -2, z: -2 + k * 0.4 }, route: [{ x: 4, z: 0 }] })
    run(c, 10)
    for (let i = 0; i < c.n; i++) expect(c.x[i]).toBeLessThan(0)
  })
})

describe('queues', () => {
  it('queuers form an evenly spaced line along the queue path, not a blob', () => {
    const c = new Crowd()
    c.addQueue('sec', [{ x: 0, z: 0 }, { x: -12, z: 0 }], 0.65)
    const ids: number[] = []
    for (let k = 0; k < 12; k++) {
      const i = c.addAgent({ pos: { x: -4 + (k % 4) * 0.5, z: 3 + Math.floor(k / 4) * 0.6 }, route: [] })
      c.joinQueue(i, 'sec')
      ids.push(i)
    }
    run(c, 30)
    ids.forEach((i, k) => {
      const s = c.slotPos('sec', k)
      expect(Math.hypot(c.x[i] - s.x, c.z[i] - s.z)).toBeLessThan(0.3)
      expect(Math.abs(c.z[i])).toBeLessThan(0.3)
    })
  })

  it('the line shuffles forward when the head is served', () => {
    const c = new Crowd()
    c.addQueue('desk', [{ x: 0, z: 0 }, { x: -10, z: 0 }], 0.65)
    const ids = Array.from({ length: 5 }, (_, k) => {
      const i = c.addAgent({ pos: { x: -0.65 * k, z: 0 }, route: [] })
      c.joinQueue(i, 'desk')
      return i
    })
    run(c, 3)
    const served = c.serveHead('desk', [{ x: 5, z: 5 }])
    expect(served).toBe(ids[0])
    expect(c.queueLength('desk')).toBe(4)
    run(c, 6)
    expect(Math.abs(c.x[ids[1]] - 0)).toBeLessThan(0.3)
    expect(Math.abs(c.x[ids[4]] - -0.65 * 3)).toBeLessThan(0.3)
  })

  it('walkers go around a queue line and barely disturb it', () => {
    const c = new Crowd()
    c.addQueue('sec', [{ x: 0, z: 0 }, { x: -10, z: 0 }], 0.65)
    const q: number[] = []
    for (let k = 0; k < 10; k++) {
      const i = c.addAgent({ pos: { x: -0.65 * k, z: 0 }, route: [] })
      c.joinQueue(i, 'sec')
      q.push(i)
    }
    run(c, 2)
    const before = q.map((i) => ({ x: c.x[i], z: c.z[i] }))
    // Walker's straight route grazes the line at 0.4 m.
    const w = c.addAgent({ pos: { x: -12, z: 0.4 }, route: [{ x: 4, z: 0.4 }] })
    let closest = Infinity
    run(c, 16, () => {
      for (const i of q) closest = Math.min(closest, Math.hypot(c.x[w] - c.x[i], c.z[w] - c.z[i]))
    })
    expect(c.state[w]).toBe(AgentState.Arrived)
    expect(closest).toBeGreaterThan(0.6)
    q.forEach((i, k) => {
      expect(Math.hypot(c.x[i] - before[k].x, c.z[i] - before[k].z)).toBeLessThan(0.15)
    })
  })
})

describe('doorway throughput', () => {
  function drain(width: number, people: number) {
    const c = new Crowd()
    // Wall with a gap of `width` at z∈[-w/2, w/2].
    c.addWalls([
      { ax: 0, az: -15, bx: 0, bz: -width / 2 },
      { ax: 0, az: width / 2, bx: 0, bz: 15 },
    ])
    c.addDoor({ id: 'd', ax: 0, az: -width / 2, bx: 0, bz: width / 2 })
    for (let k = 0; k < people; k++) {
      c.addAgent({
        pos: { x: -2 - Math.floor(k / 6) * 0.7, z: -2 + (k % 6) * 0.75 },
        route: [{ x: -0.6, z: 0 }, { x: 0.6, z: 0, doorId: 'd' }, { x: 8, z: 0 }],
      })
    }
    let t = 0
    let maxWait = 0
    while (t < 200) {
      c.step(DT)
      t += DT
      let waiting = 0
      for (let i = 0; i < c.n; i++) if (c.state[i] === AgentState.DoorWait) waiting++
      maxWait = Math.max(maxWait, waiting)
      if (c.doorPassed('d') >= people) break
    }
    return { t, passed: c.doorPassed('d'), maxWait, c }
  }

  it('caps flow at ~1.3 people per metre per second', () => {
    const r = drain(1.0, 30)
    expect(r.passed).toBe(30)
    const rate = r.passed / r.t
    expect(rate).toBeLessThan(1.3 * 1.0 + 0.15)
    expect(rate).toBeGreaterThan(0.6)
  })

  it('a wider door drains the same crowd faster (layout matters)', () => {
    const narrow = drain(0.9, 36)
    const wide = drain(2.4, 36)
    expect(narrow.passed).toBe(36)
    expect(wide.passed).toBe(36)
    expect(wide.t).toBeLessThan(narrow.t * 0.75)
  })

  it('a narrow door under heavy inflow backs up (emergent gridlock)', () => {
    const r = drain(0.8, 48)
    expect(r.maxWait).toBeGreaterThan(2)
    // Nobody tunnels through the wall beside the door.
    for (let i = 0; i < r.c.n; i++) {
      if (r.c.x[i] > 0) expect(Math.abs(r.c.z[i])).toBeLessThan(8)
    }
  })
})

describe('performance', () => {
  it('steps 3,000 agents well inside a frame budget', () => {
    const c = new Crowd({}, 4096)
    const side = 55
    for (let k = 0; k < 3000; k++) {
      const x = (k % side) * 1.1
      const z = Math.floor(k / side) * 1.1
      c.addAgent({ pos: { x, z }, route: [{ x: side * 1.1 - x, z: 60 - z }] })
    }
    c.step(DT) // warm
    const t0 = performance.now()
    const N = 10
    for (let s = 0; s < N; s++) c.step(DT)
    const ms = (performance.now() - t0) / N
    // Sim ticks at 10 Hz; budget is generous for slow CI boxes.
    expect(ms).toBeLessThan(60)
  })
})
