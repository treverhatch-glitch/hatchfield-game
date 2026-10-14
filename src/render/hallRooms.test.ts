import { describe, expect, it } from 'vitest'
import { HALL_D, HALL_W } from '../game/terminal'
import { starterGame } from './world/fixtures'
import { terminals } from './world/layout'
import { planTerminal, terminalPlanSeed } from './world/plan'
import { apronToHall, hallFitFor, hallGuestScale, matchTerminal, poseOnPlan } from './hallRooms'

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
    expect(hallGuestScale(fit)).toBeGreaterThan(0.2)
    expect(hallGuestScale(fit)).toBeLessThan(1)
  })

  it('walks a cleared guest from check-in toward food through the fitted hall', () => {
    const game = starterGame()
    const hit = matchTerminal(terminals(game), game.activeHall()?.origin ?? null)!
    const fit = hallFitFor(hit.info)
    const plan = planTerminal(hit.info, { density: 1, walkersPerCell: 0, seed: terminalPlanSeed(hit.index) })
    const cache = new Map<string, { x: number; z: number }[] | null>()
    const guest = {
      id: 'day1-preview-0',
      node: 'checkin',
      job: 'depart' as const,
      clearedSec: true,
      t: 0.4,
    }
    const pose = poseOnPlan(plan.rooms, guest, 'food', cache)
    expect(pose).not.toBeNull()
    expect(pose!.fromSim).toBe(false)
    const hall = apronToHall(pose!.x, pose!.z, fit)
    expect(Math.abs(hall.x)).toBeLessThan(HALL_W / 2)
    expect(Math.abs(hall.z)).toBeLessThan(HALL_D / 2)
    const again = poseOnPlan(plan.rooms, guest, 'food', cache)
    expect(again).toEqual(pose)
  })
})
