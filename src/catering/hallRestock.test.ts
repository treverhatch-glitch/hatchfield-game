import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HANDOFF_STEP_M, LOCK_TOLERANCE_M } from '../logistics/socketTurn'
import { CateringEngine } from './engine'
import { counterRoute, dist, DOCK_TOLERANCE_M, RESTOCK_STEP_M, supplyPose } from './supplyPath'

describe('hall restock path', () => {
  it('is the only shelf refill, and the cart docks before the shelf rises', () => {
    const sim = readFileSync('src/game/sim.ts', 'utf8')
    const nav = readFileSync('src/paxnav/paxnav.ts', 'utf8')
    expect(sim).not.toMatch(/foodShelf\s*\+=/)
    expect(sim).not.toMatch(/shopShelf\s*\+=/)
    expect(nav).not.toMatch(/restockPerHour/)
    expect(RESTOCK_STEP_M).toBe(HANDOFF_STEP_M)
    expect(DOCK_TOLERANCE_M).toBe(LOCK_TOLERANCE_M)

    for (const kind of ['food', 'shop'] as const) {
      const route = counterRoute(kind)
      expect(route.length).toBeGreaterThan(2)
      for (let i = 1; i < route.length; i++) {
        expect(dist(route[i - 1], route[i])).toBeLessThanOrEqual(RESTOCK_STEP_M + 1e-6)
      }
    }

    const engine = new CateringEngine()
    engine.setReorderAt('shop_burger', 0)
    engine.setSku('shop_burger', 'burger', 4)
    const before = engine.skuCount('shop_burger', 'burger')
    expect(engine.requestRestock('shop_burger')).toBe(true)

    let now = 0
    let prev: { x: number; y: number; z: number } | null = null
    let maxStep = 0
    let dockedBeforeRise = false
    let rose = false
    for (let i = 0; i < 4000 && !rose; i++) {
      now += 0.05
      engine.tick(now)
      const runner = engine.runners[0]
      const pose = supplyPose(runner, engine.now, engine.config.supplyDurations, 'food')
      if (prev) maxStep = Math.max(maxStep, dist(prev, pose))
      prev = { x: pose.x, y: pose.y, z: pose.z }
      const stock = engine.skuCount('shop_burger', 'burger')
      if (pose.phase === 'shelving' && pose.docked && stock === before) dockedBeforeRise = true
      if (stock > before) {
        rose = true
        expect(dockedBeforeRise).toBe(true)
        expect(pose.dockGap).toBeLessThanOrEqual(DOCK_TOLERANCE_M)
      }
    }
    expect(rose).toBe(true)
    expect(maxStep).toBeLessThanOrEqual(RESTOCK_STEP_M + 1e-4)
  })

  it('sends one runner to one counter', () => {
    const engine = new CateringEngine()
    engine.setReorderAt('shop_burger', 0)
    engine.setReorderAt('shop_news', 0)
    expect(engine.requestRestock('shop_burger')).toBe(true)
    expect(engine.requestRestock('shop_news')).toBe(true)
    engine.tick(0.01)
    const busy = engine.runners.filter((r) => r.phase !== 'idle')
    expect(busy).toHaveLength(1)
    expect(busy[0].shopId).toBe('shop_burger')
  })
})
