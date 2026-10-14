import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../game/sim.ts'
import type { HallNode } from '../game/guests.ts'

const LANDSIDE_ONLY: ReadonlySet<HallNode> = new Set(['entrance', 'info', 'checkin', 'bathroom', 'exit'])
const GAME_DAY_SEC = 180

type HubLink = { guestId: string; made: boolean }

/** Seeded stand-in for Math.random so the three days replay the same traffic. */
function seedRandom(seed: number) {
  let s = seed >>> 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  })
}

function hubLinks(game: Game): HubLink[] {
  return (game as unknown as { hubLinks: HubLink[] }).hubLinks
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('three game days on a live hub', () => {
  it('loses no transfer bag and strands no connecting passenger when MCT is met', () => {
    seedRandom(7)
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.cash = 2_000_000
    game.speed = 1
    game.fieldXp = 420
    game.researchPoints = 400
    game.buyResearch('transfer_centre')
    game.buyResearch('rfid_bag_line')
    // Mixed fleet: full service hub carrier, LCC, charter, and a freighter.
    game.signed = ['harbor', 'northline', 'bushline', 'umazon']
    game.hubAirlines = ['harbor', 'northline', 'bushline']
    // A fixed mixed timetable for three days: one slot every 12 s, rotating carriers.
    game.scheduleAuto = false
    const fleet = ['harbor', 'northline', 'bushline', 'umazon'] as const
    game.schedule = Array.from({ length: Math.floor((GAME_DAY_SEC * 3) / 12) }, (_, n) => ({
      id: `day${n}`,
      airline: fleet[n % fleet.length],
      flightNo: `HB${100 + n}`,
      eta: 4 + n * 12,
      status: 'scheduled' as const,
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    }))
    game.spawnCool = 0
    game.offerCool = 1e9
    game.threatCool = 1e9
    game.emergencyCool = 1e9
    expect(game.hasResearch('rfid_bag_line')).toBe(true)

    const verdicts = new Map<string, boolean>()
    const carriers = new Set<string>()
    const step = () => {
      game.tick(0.25)
      for (const link of hubLinks(game)) verdicts.set(link.guestId, link.made)
      for (const g of game.hallGuests) {
        if (!verdicts.has(g.id) || g.dead) continue
        if (g.airlineId) carriers.add(g.airlineId)
        expect(LANDSIDE_ONLY.has(g.node)).toBe(false)
      }
    }
    for (let t = 0; t < GAME_DAY_SEC * 3; t += 0.25) step()

    // Stop the bank and let every open connection window close.
    game.scheduleAuto = false
    game.schedule = []
    game.spawnCool = 1e9
    for (let t = 0; t < 120; t += 0.25) {
      step()
      if (hubLinks(game).length === 0 && t > 30) break
    }
    expect(hubLinks(game)).toHaveLength(0)

    expect(game.flightsDone).toBeGreaterThan(0)
    expect(verdicts.size).toBeGreaterThan(0)
    const made = [...verdicts].filter(([, ok]) => ok).map(([id]) => id)
    const missed = [...verdicts].filter(([, ok]) => !ok).map(([id]) => id)
    expect(made.length).toBeGreaterThan(0)

    // Zero stuck connecting passengers.
    expect(game.hallGuests.filter((g) => verdicts.has(g.id))).toHaveLength(0)
    // Connectors came off more than one passenger carrier, never off the freighter.
    expect(carriers.size).toBeGreaterThan(1)
    expect(carriers.has('umazon')).toBe(false)

    // Every bag of a made connection rode the outbound with its passenger.
    for (const id of made) {
      const bags = game.bagTagsFor(id).filter((tag) => tag.kind === 'transfer')
      expect(bags.length).toBeGreaterThan(0)
      for (const tag of bags) {
        expect(tag.fault).toBeNull()
        expect(tag.loaded).toBe(true)
        expect(tag.picked).toBe(true)
      }
    }
    // A missed connection's bags are left behind once and rebooked with the passenger.
    let leftBehind = 0
    for (const id of missed) {
      for (const tag of game.bagTagsFor(id).filter((t) => t.kind === 'transfer')) {
        expect(tag.fault).toBe('missed_connection')
        expect(tag.loaded).toBe(false)
        expect(tag.connectFlightId?.startsWith('rebook:')).toBe(true)
        leftBehind += 1
      }
    }
    expect(game.bagsMishandled).toBeGreaterThanOrEqual(leftBehind)
    expect(game.missedConnections).toBeGreaterThanOrEqual(missed.length)
    expect(game.bagsLost).toBe(0)
    for (const n of [game.cash, game.missedConnections, game.bagsMishandled, game.bagsLost]) {
      expect(Number.isFinite(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
    }
  }, 120_000)
})
