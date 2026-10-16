import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../../game/sim.ts'
import { bumpTerminalVersion, resetTerminalVersion } from '../../game/terminalVersion.ts'
import { FITTING_KINDS, fittingSpec } from '../../terminalbuild/fittings.ts'
import type { Fitting, FittingKind } from '../../terminalbuild/types.ts'
import { cardForEveryKind, fittingCardModel, fittingCardText, type FittingMetric } from './fittingCard.ts'
import { subscribeFittingCard } from './FittingCard.tsx'

function piece(kind: FittingKind, patch: Partial<Fitting> = {}): Fitting {
  return { id: `piece-${kind}`, kind, x: 1, y: 2, floor: 0, rot: 0, wear: 0, staffed: true, ...patch }
}

function metric(patch: Partial<FittingMetric> = {}): FittingMetric {
  return { queueLength: 0, avgWaitSec: 0, served: 0, serving: false, serviceSec: 30, ...patch }
}

describe('fitting card model', () => {
  afterEach(() => {
    resetTerminalVersion()
    vi.useRealTimers()
  })

  it('builds a card for every kind, security included', () => {
    const cards = cardForEveryKind()
    expect(cards.map((card) => card.kind).sort()).toEqual([...FITTING_KINDS].sort())
    for (const card of cards) {
      const text = fittingCardText(card)
      expect(text).toContain(card.name)
      expect(text).toContain(card.status)
      expect(text).toContain('Queue ')
      expect(text).toContain('Wait ')
      expect(text).toContain('Served ')
      expect(text).toContain('per min')
      expect(text).toContain('Wear ')
      expect(text).toContain('/day')
      expect(text).toContain(card.staff)
      expect(text).toContain(card.stage)
      expect(card.actions).toEqual(expect.arrayContaining(['repair', 'move', 'sell']))
    }
    const lane = cards.find((card) => card.kind === 'security_lane')
    expect(lane?.name).toBe('Security lane')
    expect(lane?.status).toBe('Working')
  })

  it('changes queue and served text for the same fitting', () => {
    const fitting = piece('security_lane', { id: 's1-lane-0' })
    const quiet = fittingCardText(fittingCardModel({ fitting, metric: metric({ queueLength: 1, served: 2 }) }))
    const busy = fittingCardText(
      fittingCardModel({ fitting, metric: metric({ queueLength: 6, served: 9, serving: true, avgWaitSec: 48 }) }),
    )
    expect(quiet).toContain('Queue 1')
    expect(quiet).toContain('Served 2')
    expect(busy).toContain('Queue 6')
    expect(busy).toContain('Served 9')
    expect(busy).not.toBe(quiet)
    expect(fitting.id).toBe('s1-lane-0')
  })

  it('says when a passport booth has no international arrivals due', () => {
    const booth = piece('passport_booth')
    expect(fittingCardModel({ fitting: booth, intlDue: 0 }).passportNote).toBe('Idle: no international flights')
    expect(fittingCardModel({ fitting: booth, intlDue: 2 }).passportNote).toBe(
      '2 international arrivals due in the next hour',
    )
    expect(fittingCardModel({ fitting: piece('bag_drop'), intlDue: 4 }).passportNote).toBeNull()
    expect(fittingCardModel({ fitting: piece('checkin_desk', { staffed: false }) }).status).toBe('No staff')
    expect(fittingCardModel({ fitting: piece('gate_desk', { wear: 100 }) }).status).toBe('Worn out')
    const spec = fittingSpec('security_lane')
    const card = fittingCardModel({
      fitting: piece('security_lane'),
      metric: metric({ serving: true, serviceSec: spec.serviceSec }),
    })
    expect(card.capacityPerMin).toBeGreaterThan(0)
    expect(card.throughputPerMin).toBeGreaterThan(0)
    expect(card.throughputPerMin).toBeLessThanOrEqual(card.capacityPerMin)
  })

  it('notifies at 4 Hz while the terminal version keeps moving', () => {
    vi.useFakeTimers()
    resetTerminalVersion()
    let pulses = 0
    const off = subscribeFittingCard(() => {
      pulses += 1
    })
    bumpTerminalVersion()
    expect(pulses).toBe(1)
    bumpTerminalVersion()
    expect(pulses).toBe(1)
    vi.advanceTimersByTime(250)
    expect(pulses).toBe(2)
    off()
  })
})

describe('fitting actions on the layout', () => {
  it('staffs, repairs, arms a move, and sells without touching the flight bank', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.cash = 5_000_000
    const lane = game.activeHall()?.layout?.fittings?.find((row) => row.kind === 'security_lane')
    expect(lane).toBeTruthy()
    game.selectFacility(lane!.id)
    expect(game.setFittingStaffed(lane!.id, false)).toBe(true)
    expect(game.activeHall()?.layout?.fittings?.find((row) => row.id === lane!.id)?.staffed).toBe(false)
    const worn = game.activeHall()!.layout!.fittings!.find((row) => row.id === lane!.id)!
    worn.wear = 40
    const before = game.cash
    expect(game.repairLayoutFitting(lane!.id)).toBe(true)
    expect(game.activeHall()?.layout?.fittings?.find((row) => row.id === lane!.id)?.wear).toBe(0)
    expect(game.cash).toBeLessThan(before)
    expect(game.beginFittingMove(lane!.id)).toBe(true)
    expect(game.fittingMoveId).toBe(lane!.id)
    const dueBefore = game.intlArrivalsDue()
    expect(game.sellLayoutFitting(lane!.id)).toBe(true)
    expect(game.selectedFacility).toBeNull()
    expect(game.fittingMoveId).toBeNull()
    expect(game.intlArrivalsDue()).toBe(dueBefore)
  })
})
