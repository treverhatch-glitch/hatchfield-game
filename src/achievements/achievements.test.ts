
import { describe, expect, it } from "vitest"
import { AchievementTracker } from "./achievements"

describe("AchievementTracker", () => {
  it("starts with no achievements unlocked", () => {
    const tracker = new AchievementTracker()
    expect(Object.keys(tracker.state.unlocked).length).toBe(0)
    expect(tracker.popUnlocks().length).toBe(0)
  })

  it("unlocks an achievement when threshold is met", () => {
    const tracker = new AchievementTracker()
    const mockGame = { paxServed: 100, flightsDone: 0, cash: 0, reputation: 0 }

    tracker.check(mockGame)

    const unlocks = tracker.popUnlocks()
    expect(unlocks.length).toBe(1)
    expect(unlocks[0].id).toBe("pax_100")

    expect(tracker.state.unlocked["pax_100"]).toBeDefined()
  })

  it("does not unlock the same achievement twice", () => {
    const tracker = new AchievementTracker()
    const mockGame = { paxServed: 150, flightsDone: 0, cash: 0, reputation: 0 }

    tracker.check(mockGame)
    tracker.popUnlocks()

    // Check again
    tracker.check(mockGame)
    expect(tracker.popUnlocks().length).toBe(0)
  })

  it("can load and save state", () => {
    const tracker1 = new AchievementTracker()
    const mockGame = { paxServed: 1000, flightsDone: 0, cash: 0, reputation: 0 }

    tracker1.check(mockGame)
    const state = tracker1.save()

    const tracker2 = new AchievementTracker()
    tracker2.load(state)

    expect(tracker2.state.unlocked["pax_100"]).toBeDefined()
    expect(tracker2.state.unlocked["pax_1000"]).toBeDefined()

    // Check again, should not pop since they were loaded as unlocked
    tracker2.check(mockGame)
    expect(tracker2.popUnlocks().length).toBe(0)
  })
})
