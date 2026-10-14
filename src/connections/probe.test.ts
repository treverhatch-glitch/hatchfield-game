import { it, vi } from 'vitest'
import { Game } from '../game/sim.ts'

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

function field(lane: boolean, hotels: boolean) {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 2_000_000
  game.fieldXp = 420
  game.researchPoints = 400
  if (lane) game.buyResearch('transfer_centre')
  game.signed = ['harbor', 'northline', 'umazon']
  game.hubAirlines = ['harbor']
  game.scheduleAuto = false
  const fleet = ['harbor', 'harbor', 'northline', 'umazon'] as const
  game.schedule = Array.from({ length: 80 }, (_, n) => ({
    id: `hub${n}`,
    airline: fleet[n % fleet.length],
    flightNo: `HB${200 + n}`,
    eta: 4 + n * 30,
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
  if (hotels) {
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
  }
  return game
}

it('probe', () => {
  for (const [lane, hotels] of [
    [true, true],
    [false, true],
    [true, false],
  ] as const) {
    seedRandom(11)
    const game = field(lane, hotels)
    const mct = game.connectionsPanel().mct
    let cancelled = false
    for (let t = 0; t < 3 * 180 + 1; t += 0.25) {
      game.tick(0.25)
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
    const view = game.connectionsPanel()
    console.log(
      'PROBE',
      JSON.stringify({
        lane,
        hotels,
        mct,
        totals: view.totals,
        nights: game.connections.nights,
        last: game.connections.lastNight && {
          rooms: game.connections.lastNight.rooms,
          occupied: game.connections.lastNight.occupied,
          revenue: game.connections.lastNight.revenue,
          overflow: game.connections.lastNight.overflow,
          lines: game.connections.lastNight.lines.map((l) => [l.name, l.occupied, l.rooms, l.revenue, l.bySegment]),
        },
        sort: [view.sortLoad, view.sortCapacity, view.misconnectRate],
        rep: game.reputation,
        statuses: game.schedule.reduce<Record<string, number>>((m, s) => ((m[s.status] = (m[s.status] ?? 0) + 1), m), {}),
        bigDelays: game.schedule.filter((s) => s.delaySec * 8 >= 180).length,
        done: game.flightsDone,
        alerts: game.alerts.active.filter((a) => a.key.startsWith('conn:')).map((a) => a.detail),
      }),
    )
    vi.restoreAllMocks()
  }
}, 300_000)
