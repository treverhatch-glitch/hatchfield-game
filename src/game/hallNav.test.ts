import { describe, expect, it } from 'vitest'
import { leadSecForTag, type ShowUpPlan } from '../pax/showup.ts'
import { CURB, moveOpen, AIR, PRE } from '../paxnav/index.ts'
import { sampleTerminal } from '../terminalbuild/sample.ts'
import { HallNavCrowd } from '../render/hallNavCrowd.ts'
import { spawnHallGuest } from './guests.ts'
import { prefabNavLayout } from './hallNav.ts'
import { HALL_D, HALL_W, schemeItems, schemeZones } from './terminal.ts'
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

/** Release `n` departures into the active hall, as the show-up loop does. */
function release(game: Game, n: number, tag = 'r') {
  const hallId = game.hallKey(game.activeHall()!)
  for (let i = 0; i < n; i++) game.hallGuests.push(spawnHallGuest(`${tag}-${i}`, 'depart', 'budget', { hallId }))
}

describe('hall walkers (paxnav glue)', () => {
  it('reads every prefab tier as a walkable terminal with curb, lanes and a gate', () => {
    for (const tier of [1, 2, 3] as const) {
      const l = prefabNavLayout(schemeZones(tier), schemeItems(tier))
      expect(l.w * 4).toBe(HALL_W)
      expect(l.h * 4).toBe(HALL_D)
      expect(l.doors.some((d) => d.kind === 'curb')).toBe(true)
      expect(l.doors.some((d) => d.kind === 'apron')).toBe(true)
      expect(l.equipment.some((e) => e.kind === 'security_lane')).toBe(true)
      expect(l.equipment.some((e) => e.kind === 'checkin_desk')).toBe(true)
      expect(l.rooms.some((r) => r.kind === 'gate')).toBe(true)
      // Kit never lands on the bag hall.
      for (const e of l.equipment) expect(l.zones[e.y][e.x]).not.toBe('baggage')
      // The check-in side reaches security only through a lane tile.
      const walls = new Set(l.walls.map((e) => `${e.x},${e.y},${e.dir}`))
      const lanes = new Set(l.equipment.filter((e) => e.kind === 'security_lane').map((e) => `${e.x},${e.y}`))
      const pre = (z: string | null) => z === 'checkin' || z === 'landside'
      for (let y = 0; y < l.h; y++) {
        for (let x = 0; x < l.w; x++) {
          for (const [nx, ny, dir] of [
            [x + 1, y, 'E'],
            [x, y + 1, 'S'],
          ] as const) {
            if (nx >= l.w || ny >= l.h || walls.has(`${x},${y},${dir}`)) continue
            const a = l.zones[y][x]
            const b = l.zones[ny][nx]
            const sec = a === 'security' && pre(b) ? `${x},${y}` : b === 'security' && pre(a) ? `${nx},${ny}` : null
            if (sec) expect(lanes.has(sec)).toBe(true)
          }
        }
      }
    }
  })

  it('goes live on the starter kit and spawns on the curb pavement, on the floor', () => {
    const game = field()
    game.tickHallNav(0.01)
    expect(game.hallNav.live).toBe(true)
    release(game, 40)
    game.tickHallNav(0.001)
    const nav = game.hallNav.nav!
    const g = nav.nav
    expect(nav.count).toBeGreaterThanOrEqual(40)
    for (const p of nav.poses().filter((p) => p.id.startsWith('r-'))) {
      expect(p.y).toBe(0)
      expect(g.mask[nav.cellOf(p.id)] & CURB).toBeTruthy()
    }
    const out = new Float32Array(nav.count * 4)
    expect(game.hallNav.writePoses(out)).toBe(nav.count)
    for (let i = 0; i < nav.count; i++) expect(out[i * 4 + 1]).toBe(0)
  })

  it('never steps through a wall, desk or roof on the way to boarding', () => {
    const game = field()
    // Day-one walkers loop back to the curb once boarded; this test follows one walk each.
    game.hallGuests = game.hallGuests.filter((g) => !g.preview)
    game.tickHallNav(0.01)
    release(game, 60)
    // Boarding opens 30 nav minutes before STD. A near departure lets this
    // short run see them board at the slower walk.
    game.showUps.push({ slotId: 'wall', flightId: 'wall', std: game.clock + 6 } as ShowUpPlan)
    for (const g of game.hallGuests) g.flightId = 'wall'
    const nav = game.hallNav.nav!
    const g = nav.nav
    const last = new Map<string, number>()
    for (let i = 0; i < 6000; i++) {
      game.tickHallNav(0.01)
      for (const p of nav.poses()) {
        const c = nav.cellOf(p.id)
        expect(g.mask[c]).toBeGreaterThan(0)
        const prev = last.get(p.id)
        if (prev != null && prev !== c) expect(moveOpen(g, prev, c, PRE | AIR), `${p.id} ${prev}->${c}`).toBe(true)
        last.set(p.id, c)
      }
      if (game.hallNav.boarded >= 30 && !nav.count) break
    }
    expect(game.hallNav.boarded).toBeGreaterThan(0)
  })

  it('exposes live queues at check-in and security from the kit the player has', () => {
    const game = field()
    game.tickHallNav(0.01)
    release(game, 80)
    let peakSec = 0
    let peakCheckin = 0
    for (let i = 0; i < 400; i++) {
      game.tickHallNav(0.05)
      for (const m of game.hallNav.metrics()) {
        if (m.kind === 'security_lane') peakSec = Math.max(peakSec, m.queueLength)
        if (m.kind === 'checkin_desk') peakCheckin = Math.max(peakCheckin, m.queueLength)
        expect(m.line.length).toBeGreaterThan(0)
      }
    }
    expect(peakSec).toBeGreaterThan(2)
    expect(peakCheckin).toBeGreaterThan(2)
    const sec = game.hallNav.metrics().find((m) => m.kind === 'security_lane')!
    expect(sec.served).toBeGreaterThan(0)
  })

  it('re-plans on a build edit: the hall build replaces the prefab read', () => {
    const game = field()
    game.sandbox = true
    game.tickHallNav(0.01)
    release(game, 10)
    game.tickHallNav(0.01)
    const edit = sampleTerminal()
    const rev = game.hallNav.nav!.revision
    expect(game.applyHallBuild(edit)).toBe(true)
    game.tickHallNav(0.01)
    expect(game.hallNav.nav!.layout).toBe(game.activeHall()!.build)
    expect(game.hallNav.nav!.revision).toBe(rev + 1)
    // Same revision, same layout: no rebuild.
    game.tickHallNav(0.01)
    expect(game.hallNav.nav!.revision).toBe(rev + 1)
  })

  it('keeps 1000+ walkers inside the per-frame budget', () => {
    const game = field()
    game.tickHallNav(0.01)
    release(game, 1200, 'load')
    game.tickHallNav(0.001)
    expect(game.hallNav.passengers).toBe(1200 + game.hallGuests.filter((g) => g.preview).length)
    const t0 = performance.now()
    const frames = 120
    for (let i = 0; i < frames; i++) game.tickHallNav(1 / 60)
    const per = (performance.now() - t0) / frames
    // A 60 fps frame is 16.7 ms; the walk must leave nearly all of it to drawing.
    expect(per).toBeLessThan(8)
  })

  it('boards a leisure bank, and a lead shorter than the walk is what misses', () => {
    const game = field()
    game.hallGuests = game.hallGuests.filter((g) => !g.preview)
    const hallId = game.hallKey(game.activeHall()!)
    const leisure = leadSecForTag('budget')
    game.showUps.push({ slotId: 'leisure', flightId: 'leisure', std: game.clock + leisure } as ShowUpPlan)
    const n = 12
    for (let i = 0; i < n; i++) {
      const g = spawnHallGuest(`ok-${i}`, 'depart', 'budget', { hallId })
      g.flightId = 'leisure'
      game.hallGuests.push(g)
    }
    for (let i = 0; i < 2000 && game.hallNav.boarded < n && game.hallNav.missed === 0; i++) game.tickHallNav(0.5)
    // Walking, security and a shop stop still fit. Nothing misses unless the lead closes first.
    expect(game.hallNav.missed).toBe(0)
    expect(game.hallNav.boarded).toBe(n)

    game.showUps.push({ slotId: 'crush', flightId: 'crush', std: game.clock + 0.5 } as ShowUpPlan)
    for (let i = 0; i < 24; i++) {
      const g = spawnHallGuest(`late-${i}`, 'depart', 'budget', { hallId })
      g.flightId = 'crush'
      game.hallGuests.push(g)
    }
    for (let i = 0; i < 20; i++) game.tickHallNav(0.25)
    expect(game.hallNav.missed).toBeGreaterThan(0)
  })

  it('draws every walker on the hall floor in hall metres', () => {
    const game = field()
    game.tickHallNav(0.01)
    release(game, 300)
    for (let i = 0; i < 60; i++) game.tickHallNav(0.05)
    const crowd = new HallNavCrowd()
    const drawn = crowd.sync(game.hallNav, game.clock)
    expect(drawn).toBe(game.hallNav.count)
    const body = crowd.group.getObjectByName('hall-nav-body') as import('three').InstancedMesh
    const lines = crowd.group.getObjectByName('hall-nav-queue-lines') as import('three').InstancedMesh
    expect(body.count).toBe(drawn)
    expect(lines.count).toBeGreaterThan(0)
    const m = new (body.instanceMatrix.array.constructor as Float32ArrayConstructor)(16)
    for (let i = 0; i < drawn; i++) {
      m.set(body.instanceMatrix.array.subarray(i * 16, i * 16 + 16))
      const x = m[12]
      const y = m[13]
      const z = m[14]
      // Curb pavement is one tile outside the live hall wall.
      const layout = game.hallNav.nav!.layout
      const tileM = layout.tileM && layout.tileM > 0 ? layout.tileM : 4
      expect(Math.abs(x)).toBeLessThanOrEqual((layout.w * tileM) / 2 + 4)
      expect(Math.abs(z)).toBeLessThanOrEqual((layout.h * tileM) / 2 + 4)
      expect(y).toBeGreaterThan(0.5)
      expect(y).toBeLessThan(0.8)
    }
    crowd.dispose()
  })
})
