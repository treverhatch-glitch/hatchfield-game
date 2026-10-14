import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../game/sim.ts'
import type { HallNode } from '../game/guests.ts'

const GAME_DAY_SEC = 180
const LANDSIDE_ONLY: ReadonlySet<HallNode> = new Set(['entrance', 'info', 'checkin', 'bathroom', 'exit'])

/** Seeded stand-in for Math.random so the day replays the same traffic. */
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

afterEach(() => {
  vi.restoreAllMocks()
})

/** A mid-game field with a full-service hub carrier, a landside inn and airside day rooms. */
function hubField(opts: { transferCentre?: boolean } = {}) {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 2_000_000
  game.speed = 1
  game.fieldXp = 420
  game.researchPoints = 400
  if (opts.transferCentre !== false) game.buyResearch('transfer_centre')
  game.signed = ['harbor', 'northline', 'umazon']
  game.hubAirlines = ['harbor']
  game.scheduleAuto = false
  const fleet = ['harbor', 'harbor', 'northline', 'umazon'] as const
  // One slot every 9 s through the whole day, so there is a late bank too.
  game.schedule = Array.from({ length: Math.floor(GAME_DAY_SEC / 9) + 4 }, (_, n) => ({
    id: `hub${n}`,
    airline: fleet[n % fleet.length],
    flightNo: `HB${200 + n}`,
    eta: 4 + n * 9,
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
  // Landside inn next to the terminal and a block of airside day rooms.
  const origin = game.fits[0].origin
  let placed = false
  for (let r = 1; r < game.tiles.length - 1 && !placed; r++) {
    for (let c = 1; c < game.tiles[r].length - 1 && !placed; c++) {
      if (game.tiles[r][c] !== 'grass' || game.siteAt({ c, r })) continue
      if (Math.hypot(c - origin.c, r - origin.r) > 8) continue
      game.tiles[r][c] = 'hotel'
      game.hotelClass[`${c},${r}`] = 'inn'
      placed = true
    }
  }
  game.fits[0].rooms.dayhotel = 1
  return game
}

describe('a game day on a live hub with transfers and hotels', () => {
  it('routes transfers airside, tracks MCT and bags, strands and rebooks, and fills the hotels', () => {
    seedRandom(11)
    const game = hubField()
    expect(game.hotelSites().map((s) => s.grade).sort()).toEqual(['inn', 'transit'])
    const cash0 = game.cash

    const transferIds = new Set<string>()
    let cancelled = false
    for (let t = 0; t < GAME_DAY_SEC + 1; t += 0.25) {
      game.tick(0.25)
      for (const g of game.hallGuests) {
        if (!g.transfer || g.dead) continue
        transferIds.add(g.id)
        // Airside transfer flow: never stands in a landside-only room (a lane exists).
        expect(LANDSIDE_ONLY.has(g.node)).toBe(false)
      }
      // Mid-afternoon a hub rotation close to departure is cancelled.
      if (!cancelled && t >= 60) {
        const slot = game.schedule.find(
          (s) => s.airline === 'harbor' && s.status === 'scheduled' && s.eta > game.clock + 2 && s.eta < game.clock + 20,
        )
        if (slot) {
          slot.status = 'cancelled'
          cancelled = true
        }
      }
    }
    expect(cancelled).toBe(true)

    const done = game.connections.ledger.history.at(-1)
    expect(done).toBeDefined()
    const day = done!
    // Hub carrier generated connecting traffic, resolved as made or missed.
    expect(day.transfers).toBeGreaterThan(10)
    expect(transferIds.size).toBeGreaterThan(0)
    expect(day.made).toBeGreaterThan(0)
    expect(day.made + day.missed).toBeLessThanOrEqual(day.transfers)
    expect(day.missedMct).toBeLessThanOrEqual(day.missed)
    // Every transfer bag through the sort is counted; misconnects are a small share.
    expect(day.transferBags).toBeGreaterThan(0)
    expect(day.misconnectedBags).toBeLessThanOrEqual(day.transferBags)
    // Re-screened transfers used the airside lane, never the landside detour.
    expect(day.screened).toBeGreaterThan(0)
    expect(day.landsideRecheck).toBe(0)
    // Short layovers browsed; the cancel stranded and rebooked people.
    expect(day.layoverShort).toBeGreaterThan(0)
    expect(day.stranded).toBeGreaterThan(0)
    expect(day.rebooked + day.overnight).toBe(day.stranded)

    // Hotels booked last night with real occupancy and revenue.
    const night = game.connections.lastNight
    expect(night).not.toBeNull()
    expect(night!.rooms).toBeGreaterThan(0)
    expect(night!.occupied).toBeGreaterThan(0)
    expect(night!.occupancy).toBeGreaterThan(0)
    expect(night!.occupancy).toBeLessThanOrEqual(1)
    expect(night!.revenue).toBeGreaterThan(0)
    const hotelIncome = game.bank.ledgerForGameDay(0).byCategory.landside_fees ?? 0
    expect(hotelIncome).toBeGreaterThanOrEqual(night!.revenue)

    // The views read the same numbers.
    const view = game.connectionsPanel()
    expect(view.mct.total).toBeGreaterThanOrEqual(25)
    expect(view.history.at(-1)?.transfers).toBe(day.transfers)
    const hotels = game.hotelPanel()
    expect(hotels.rows.some((r) => r.occupancy > 0)).toBe(true)

    // Money stays finite; reputation never goes negative.
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.cash).toBeLessThan(cash0 + 10_000_000)
    expect(game.reputation).toBeGreaterThanOrEqual(0)

    // Save round trip keeps the ledger, rates and last night.
    game.setHotelRate('landside', 1.3)
    game.persist()
    const copy = new Game()
    expect(copy.load()).toBe(true)
    expect(copy.connections.ledger.history.at(-1)).toEqual(day)
    expect(copy.connections.rates.landside).toBeCloseTo(1.3, 9)
    expect(copy.connections.lastNight?.revenue).toBe(night!.revenue)
  }, 120_000)

  it('without a transfer lane, re-screened transfers go landside and MCT is longer', () => {
    seedRandom(5)
    const lane = hubField()
    const none = hubField({ transferCentre: false })
    expect(none.connectionsPanel().mct.total).toBeGreaterThan(lane.connectionsPanel().mct.total)
    for (let t = 0; t < 70; t += 0.25) none.tick(0.25)
    const today = none.connections.ledger.today
    expect(today.screened).toBeGreaterThan(0)
    expect(today.landsideRecheck).toBe(today.screened)
    expect(none.alerts.active.some((a) => a.key === 'conn:recheck')).toBe(true)
  }, 120_000)
})
