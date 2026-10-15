import { describe, expect, it } from 'vitest'
import { HALL_D, HALL_W } from '../game/terminal'
import { starterGame } from './world/fixtures'
import { terminals } from './world/layout'
import { planTerminal, terminalPlanSeed } from './world/plan'
import { apronToHall, hallFitFor, matchTerminal, roomShellBounds, showLegacyHallFurniture } from './hallRooms'

describe('hall room fit', () => {
  it('fits the nine starter rooms inside the hall and leaves decorative walkers off', () => {
    const game = starterGame()
    const hit = matchTerminal(terminals(game), game.activeHall()?.origin ?? null)
    expect(hit).not.toBeNull()
    const fit = hallFitFor(hit!.info)
    const plan = planTerminal(hit!.info, { density: 1, walkersPerCell: 0, seed: terminalPlanSeed(hit!.index) })
    expect(plan.walkers).toHaveLength(0)
    expect(plan.rooms.rooms).toHaveLength(9)
    expect(new Set(plan.rooms.rooms.map((r) => r.kind))).toEqual(
      new Set(['checkin', 'security', 'airside', 'shops', 'gate', 'lab', 'office']),
    )
    expect(plan.rooms.walls.some((w) => w.kind === 'glass')).toBe(true)
    expect(plan.rooms.walls.some((w) => w.kind === 'solid' && !w.header)).toBe(true)
    const rp = plan.rooms
    const corners = [
      [rp.x0, rp.z0],
      [rp.x0 + rp.w * rp.size, rp.z0],
      [rp.x0, rp.z0 + rp.h * rp.size],
      [rp.x0 + rp.w * rp.size, rp.z0 + rp.h * rp.size],
    ]
    for (const [x, z] of corners) {
      const p = apronToHall(x, z, fit)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(HALL_W / 2 - 1)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(HALL_D / 2 - 1)
    }
    const shell = roomShellBounds(rp, fit)
    const shellW = shell.maxX - shell.minX
    expect(shellW).toBeLessThan(HALL_W - 6)
    expect(shellW).toBeGreaterThan(HALL_D * 0.7)
    for (const [x, z] of corners) {
      const p = apronToHall(x, z, fit)
      expect(p.x).toBeGreaterThan(shell.minX)
      expect(p.x).toBeLessThan(shell.maxX)
      expect(p.z).toBeGreaterThan(shell.minZ)
      expect(p.z).toBeLessThan(shell.maxZ)
    }
    expect(showLegacyHallFurniture(true)).toBe(false)
    expect(showLegacyHallFurniture(false)).toBe(true)
  })
})
