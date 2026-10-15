import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AIR, LANE, PRE, apronCells, buildNavGrid, moveOpen, PaxNav } from '../paxnav/index.ts'
import { sampleTerminal } from '../terminalbuild/sample.ts'
import type { BuildLayout } from '../terminalbuild/types.ts'
import { HallNavCrowd } from '../render/hallNavCrowd.ts'
import { spawnHallGuest } from './guests.ts'
import { HallArrivals, type ClaimHall } from './hallArrivals.ts'
import { HallNav, prefabClaimHall, prefabNavLayout } from './hallNav.ts'
import { schemeItems, schemeZones } from './terminal.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

/** Walk every arrival out, one small step at a time, and check each move. */
function walkOut(layout: BuildLayout, claim: ClaimHall | null, n: number, opts: { bags?: boolean; needs?: ('toilet' | 'shop')[] } = {}) {
  const dep = new PaxNav(layout, { seed: 3 })
  const arr = new HallArrivals(5)
  arr.setLayout(layout, claim)
  const g = arr.nav!
  const base = buildNavGrid(layout, g.tileM)
  const gates = layout.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  const layer = new Map<string, number>()
  const seen = new Set<string>()
  const crossed = new Set<string>()
  const phases = new Set<string>()
  for (let i = 0; i < n; i++) {
    const id = `a-${i}`
    expect(arr.spawn({ id, gate: gates[i % gates.length], ...opts })).toBe(true)
    first.set(id, arr.cellOf(id))
  }
  let now = 0
  for (let step = 0; step < 40000 && arr.count; step++) {
    // 0.4 s at <= 1.5 m/s: under one 1 m cell per tick, so every move is one hop.
    now += 0.4
    dep.tick(0.4, now)
    arr.tick(0.4, now, dep)
    for (const e of arr.drainEvents()) {
      if (e.kind !== 'left') continue
      const prev = last.get(e.id)
      if (prev != null && prev !== e.cell) expect(moveOpen(g, prev, e.cell, PRE), `${e.id} last step`).toBe(true)
      last.set(e.id, e.cell)
    }
    for (const p of arr.poses()) {
      seen.add(p.id)
      phases.add(p.phase)
      const c = p.cell
      // On the floor of the arrivals' grid, on the layer they walk, never on a lane.
      expect(g.mask[c] & p.layer, `${p.id} off its layer at ${c}`).toBeTruthy()
      expect(base.mask[c] & LANE).toBe(0)
      const prev = last.get(p.id)
      const was = layer.get(p.id)
      if (prev != null && prev !== c) {
        expect(moveOpen(g, prev, c, p.layer), `${p.id} ${prev}->${c}`).toBe(true)
      }
      // One way: once on the curb side, never back airside.
      if (was === PRE) expect(p.layer).toBe(PRE)
      if (was === AIR && p.layer === PRE) crossed.add(p.id)
      last.set(p.id, c)
      layer.set(p.id, p.layer)
    }
  }
  return { arr, g, base, first, last, seen, crossed, dep, phases }
}

describe('arrivals on the hall nav grid', () => {
  it('spawn at a jet bridge door and leave from a curb door (starter prefab, claim hall)', () => {
    const zones = schemeZones(1)
    const items = schemeItems(1)
    const layout = prefabNavLayout(zones, items)
    const claim = prefabClaimHall(zones, items)
    expect(claim?.belts.length).toBeGreaterThan(0)
    const { arr, g, first, last, seen, crossed } = walkOut(layout, claim, 40)
    expect(arr.count).toBe(0)
    expect(arr.left).toBe(40)
    expect(seen.size).toBe(40)
    const doors = new Set(layout.rooms.filter((r) => r.kind === 'gate').flatMap((r) => apronCells(g, r.id)))
    const curb = new Set(g.spawns)
    for (const [id, c] of first) {
      expect(doors.has(c), `${id} spawned at ${c}`).toBe(true)
      expect(curb.has(last.get(id)!), `${id} left from ${last.get(id)}`).toBe(true)
      expect(crossed.has(id)).toBe(true)
    }
  })

  it('wait at the claim belt when they have a bag', () => {
    const zones = schemeZones(1)
    const items = schemeItems(1)
    const layout = prefabNavLayout(zones, items)
    const claim = prefabClaimHall(zones, items)!
    const arr = new HallArrivals(9)
    arr.setLayout(layout, claim)
    for (let i = 0; i < 6; i++) arr.spawn({ id: `b-${i}`, gate: '', bags: true, needs: [] })
    let atBelt = 0
    for (let t = 0; t < 4000 && arr.count; t++) {
      arr.tick(0.5, t * 0.5, null)
      atBelt = Math.max(atBelt, arr.poses().filter((p) => p.phase === 'claim' && arr.claimCells.has(p.cell)).length)
    }
    expect(atBelt).toBeGreaterThan(0)
    expect(arr.left).toBe(6)
  })

  it('leave a built terminal through its exit door, never back through a lane', () => {
    const layout = sampleTerminal().layout
    expect(layout.doors.some((d) => d.kind === 'exit')).toBe(true)
    const { arr, g, base, first, last, crossed } = walkOut(layout, null, 30)
    expect(arr.left).toBe(30)
    const curb = new Set(g.spawns)
    for (const [id] of first) {
      expect(curb.has(last.get(id)!)).toBe(true)
      expect(crossed.has(id)).toBe(true)
    }
    // Departures cannot use that exit: it is closed on their grid.
    expect(base.spawns.length).toBe(g.spawns.length)
  })

  it('queue behind the departures at a shop counter they share', () => {
    const zones = schemeZones(1)
    const items = schemeItems(1)
    const layout = prefabNavLayout(zones, items)
    const { arr, phases } = walkOut(layout, prefabClaimHall(zones, items), 12, { bags: false, needs: ['shop'] })
    expect(phases.has('queue')).toBe(true)
    expect(phases.has('service')).toBe(true)
    expect(arr.left).toBe(12)
  })

  it('stay off the walk (old figures keep them) when no jet bridge reaches a curb', () => {
    const layout = sampleTerminal().layout
    // Brick up the exit: a wall where the door was.
    const exits = layout.doors.filter((d) => d.kind === 'exit')
    const shut: BuildLayout = {
      ...layout,
      doors: layout.doors.filter((d) => d.kind !== 'exit'),
      walls: [...layout.walls, ...exits.map(({ x, y, dir }) => ({ x, y, dir }))],
    }
    const arr = new HallArrivals()
    arr.setLayout(shut, null)
    expect(arr.spawn({ id: 'x', gate: '' })).toBe(false)
    expect(arr.count).toBe(0)
  })

  it('walks sim arrivals from the starter kit and hides their old hall figure', () => {
    const game = field()
    game.tickHallNav(0.01)
    const hallId = game.hallKey(game.activeHall()!)
    const arrivals = Array.from({ length: 20 }, (_, i) => spawnHallGuest(`arr-${i % 3}`, 'arrive', 'budget', { hallId }))
    game.hallGuests.push(...arrivals)
    const transfer = spawnHallGuest('xfer', 'arrive', 'budget', { hallId, transfer: true })
    game.hallGuests.push(transfer)
    game.tickHallNav(0.01)
    expect(game.hallNav.arrivals.count).toBe(20)
    for (const g of arrivals) expect(game.hallNav.drawsArrival(g.id)).toBe(true)
    expect(game.hallNav.drawsArrival(transfer.id)).toBe(false)
    const out = new Float32Array(game.hallNav.count * 4)
    expect(game.hallNav.writePoses(out)).toBe(game.hallNav.count)
    // A faster kiosk puts the starter bank into the hall sooner, so one arrival
    // needs a little longer than 80s to reach the curb.
    for (let i = 0; i < 5600 && game.hallNav.left < 20; i++) game.tickHallNav(0.02)
    expect(game.hallNav.left).toBe(20)
  })
})

describe('crowd drawing never changes the sim', () => {
  // One guest list for every hall: sim guest ids are random, and walkers roll their traits from their ids.
  const guests = [
    ...Array.from({ length: 700 }, (_, i) => spawnHallGuest(`d-${i}`, 'depart', 'budget', {})),
    ...Array.from({ length: 300 }, (_, i) => spawnHallGuest(`a-${i}`, 'arrive', 'budget', {})),
  ]

  function hall(): HallNav {
    const zones = schemeZones(1)
    const items = schemeItems(1)
    const nav = new HallNav()
    nav.setHall('h', '1', () => prefabNavLayout(zones, items), () => prefabClaimHall(zones, items))
    nav.admit(guests, 0, () => 20)
    return nav
  }

  it('the visible cap and culling draw fewer, while sim counts match an undrawn twin', () => {
    const drawnHall = hall()
    const twin = hall()
    expect(drawnHall.passengers).toBe(1000)
    const crowd = new HallNavCrowd()
    crowd.tuning.maxVisible = 120
    const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600)
    cam.position.set(10, 20, 20)
    cam.lookAt(10, 0, 0)
    cam.updateMatrixWorld()
    for (let f = 0; f < 200; f++) {
      drawnHall.tick(0.05)
      twin.tick(0.05)
      const drawn = crowd.sync(drawnHall, f * 0.05, cam)
      expect(drawn).toBeLessThanOrEqual(120)
      expect(crowd.stats.walkers).toBe(drawnHall.count)
      expect(drawnHall.count).toBe(twin.count)
    }
    expect(drawnHall.boarded).toBe(twin.boarded)
    expect(drawnHall.missed).toBe(twin.missed)
    expect(drawnHall.left).toBe(twin.left)
    const a = new Float32Array(drawnHall.count * 4)
    const b = new Float32Array(twin.count * 4)
    drawnHall.writePoses(a)
    twin.writePoses(b)
    expect(Array.from(a)).toEqual(Array.from(b))
    crowd.dispose()
  })

  it('keeps the nearest walkers under the cap and drops heads and bags far away', () => {
    const nav = hall()
    nav.tick(0.05)
    const crowd = new HallNavCrowd()
    const cam = new THREE.PerspectiveCamera(60, 1, 0.5, 2000)
    cam.position.set(0, 40, 60)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    crowd.tuning.maxVisible = 0
    crowd.tuning.nearDistM = 0
    crowd.tuning.lodDistM = 1e6
    const all = crowd.sync(nav, 0, cam)
    expect(crowd.stats.heads).toBe(all)
    crowd.tuning.maxVisible = 50
    crowd.tuning.lodDistM = 0
    expect(crowd.sync(nav, 0, cam)).toBe(50)
    expect(crowd.stats.visible).toBe(all)
    expect(crowd.stats.heads).toBe(0)
    expect(crowd.stats.bags).toBe(0)
    expect(crowd.stats.instances).toBe(50)
    // The 50 drawn are the 50 nearest.
    const pos = new Float32Array(nav.count * 4)
    nav.writePoses(pos)
    const d = Array.from({ length: nav.count }, (_, i) => {
      const x = pos[i * 4] + nav.originX - cam.position.x
      const y = 0.85 - cam.position.y
      const z = pos[i * 4 + 2] + nav.originZ - cam.position.z
      return x * x + y * y + z * z
    }).sort((p, q) => p - q)
    const body = crowd.group.getObjectByName('hall-nav-body') as THREE.InstancedMesh
    const arr = body.instanceMatrix.array as Float32Array
    for (let k = 0; k < 50; k++) {
      const x = arr[k * 16 + 12] - cam.position.x
      const z = arr[k * 16 + 14] - cam.position.z
      const y = 0.85 - cam.position.y
      expect(x * x + y * y + z * z).toBeLessThanOrEqual(d[49] + 1e-3)
    }
    crowd.dispose()
  })
})
