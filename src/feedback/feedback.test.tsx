import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { beatZoom } from './beat.ts'
import { CELEBRATION_SOUND, FEEDBACK } from './config.ts'
import { burstConfetti, stepConfetti } from './confetti.ts'
import { formatEffect } from './effects.ts'
import { readFeedback } from './read.ts'
import { FeedbackSession } from './session.ts'
import { causeFor, emptyThoughts, stepThoughts } from './thoughts.ts'
import type { FeedbackWorld, PassengerSample } from './types.ts'
import { EffectToasts, MilestoneStack } from './ui/FeedbackChrome.tsx'
import { Game } from '../game/sim.ts'
import { liveFeedback, tickLiveFeedback } from './live.ts'

function world(patch: Partial<FeedbackWorld> = {}): FeedbackWorld {
  return {
    now: 0,
    passengersServed: 0,
    flightsLanded: 0,
    airlines: [],
    reputation: 40,
    levers: [{ id: 'security_lanes', metricId: 'security_wait', value: 1 }],
    metrics: [{ id: 'security_wait', label: 'Security wait', value: 6, unit: 'min' }],
    passengers: [],
    ...patch,
  }
}

function passenger(patch: Partial<PassengerSample> & Pick<PassengerSample, 'id'>): PassengerSample {
  return {
    x: 0,
    y: 0,
    z: 0,
    happiness: 50,
    queued: false,
    waitMin: 0,
    pricey: false,
    ...patch,
  }
}

describe('milestone stack', () => {
  it('shows a short list of goals with progress and pays a reward once', () => {
    const session = new FeedbackSession()
    session.step(world())
    const open = session.getSnapshot().goals
    expect(open).toHaveLength(FEEDBACK.stackSize)
    expect(open[0].id).toBe('first_airline')
    expect(open[0].ratio).toBe(0)
    expect(open[0].rewardText).toBe('$8,000')

    const landed = session.step(world({ flightsLanded: 1, now: 1 }))
    expect(landed.rewards.map((r) => r.id)).toEqual(['first_landing'])
    expect(landed.rewards[0].cash).toBe(5_000)
    expect(session.getSnapshot().paid[0].title).toBe('Land a flight')
    expect(session.getSnapshot().goals.map((g) => g.id)).not.toContain('first_landing')

    const again = session.step(world({ flightsLanded: 1, now: 2 }))
    expect(again.rewards).toEqual([])
  })

  it('does not pay goals that were already met on the first read', () => {
    const session = new FeedbackSession()
    const frame = session.step(
      world({
        passengersServed: 120,
        flightsLanded: 2,
        airlines: [{ id: 'harbor', name: 'Harbor' }],
        reputation: 70,
      }),
    )
    expect(frame.rewards).toEqual([])
    expect(session.getSnapshot().goals.map((g) => g.id)).toEqual(['airlines_3', 'pax_500'])
  })
})

describe('celebrations', () => {
  it('marks the first landing, the 100th passenger, and a new airline', () => {
    const session = new FeedbackSession()
    session.step(world())

    const landing = session.step(world({ flightsLanded: 1, now: 1 }))
    expect(landing.celebrations.map((c) => c.kind)).toEqual(['first_landing'])
    expect(landing.sounds).toEqual([CELEBRATION_SOUND.first_landing])
    expect(landing.beat?.id).toBe('first_landing')
    expect(landing.beat?.dolly).toBe(FEEDBACK.beatDolly)
    expect(session.getSnapshot().celebration?.title).toBe('First landing')

    const quiet = session.step(world({ flightsLanded: 1, now: 2 }))
    expect(quiet.celebrations).toEqual([])
    expect(quiet.beat).toBeNull()

    const hundred = session.step(world({ flightsLanded: 1, passengersServed: 100, now: 3 }))
    expect(hundred.celebrations.map((c) => c.kind)).toEqual(['pax_100'])
    expect(hundred.sounds).toEqual([CELEBRATION_SOUND.pax_100])

    const signed = session.step(
      world({
        flightsLanded: 1,
        passengersServed: 100,
        airlines: [{ id: 'northline', name: 'Northline' }],
        now: 10,
      }),
    )
    expect(signed.celebrations[0]).toMatchObject({
      kind: 'new_airline',
      title: 'Northline signed',
      sound: CELEBRATION_SOUND.new_airline,
    })
  })

  it('dollies the camera in and back', () => {
    expect(beatZoom(0, FEEDBACK.beatSec, FEEDBACK.beatDolly)).toBe(1)
    expect(beatZoom(FEEDBACK.beatSec / 2, FEEDBACK.beatSec, FEEDBACK.beatDolly)).toBeCloseTo(1 - FEEDBACK.beatDolly)
    expect(beatZoom(FEEDBACK.beatSec, FEEDBACK.beatSec, FEEDBACK.beatDolly)).toBe(1)
  })

  it('bursts confetti and lets it fall', () => {
    const pieces = burstConfetti(12, 7)
    expect(pieces).toHaveLength(12)
    const fallen = stepConfetti(pieces, 0.5)
    expect(fallen.length).toBeGreaterThan(0)
    expect(fallen[0].y).toBeGreaterThan(pieces[0].y)
    expect(fallen[0].life).toBeLessThan(pieces[0].life)
  })
})

describe('thought bubbles', () => {
  it('names the cause: queue, prices, or delight', () => {
    expect(causeFor(passenger({ id: 'q', queued: true }))).toBe('queue')
    expect(causeFor(passenger({ id: 'w', waitMin: 6 }))).toBe('queue')
    expect(causeFor(passenger({ id: 'p', pricey: true, happiness: 40 }))).toBe('prices')
    expect(causeFor(passenger({ id: 'd', happiness: 90 }))).toBe('delight')
    expect(causeFor(passenger({ id: 'n', happiness: 60 }))).toBeNull()
  })

  it('shows a few icons, follows the passenger, then waits out the cooldown', () => {
    const options = { chance: 1, cap: 1, life: 1, cooldown: 10, sampleEvery: 5 }
    const first = stepThoughts(
      emptyThoughts(0),
      [passenger({ id: 'a', queued: true, x: 1 }), passenger({ id: 'b', queued: true, x: 2 })],
      0,
      options,
    )
    expect(first.live).toHaveLength(1)
    expect(first.live[0].passengerId).toBe('a')
    expect(first.live[0].icon).toBe('queue')
    expect(first.live[0].mood).toBe('upset')

    const moved = stepThoughts(first, [passenger({ id: 'a', queued: true, x: 8 }), passenger({ id: 'b', queued: true })], 0.4, options)
    expect(moved.live[0].x).toBe(8)

    const next = stepThoughts(moved, [passenger({ id: 'a', queued: true }), passenger({ id: 'b', queued: true })], 5, options)
    expect(next.live.map((t) => t.passengerId)).toEqual(['b'])
  })

  it('stays quiet when the sample roll misses', () => {
    const none = stepThoughts(
      emptyThoughts(0),
      [passenger({ id: 'a', happiness: 95 }), passenger({ id: 'b', queued: true })],
      0,
      { chance: 0, cap: 8, life: 4, cooldown: 10, sampleEvery: 3 },
    )
    expect(none.live).toEqual([])
  })
})

describe('before/after toasts', () => {
  it('reports the measured change after a lever moves', () => {
    expect(formatEffect('Security wait', 6, 2, 'min')).toBe('Security wait 6m to 2m')

    const session = new FeedbackSession()
    session.step(world({ now: 0 }))
    const armed = session.step(
      world({
        now: 1,
        levers: [{ id: 'security_lanes', metricId: 'security_wait', value: 3 }],
        metrics: [{ id: 'security_wait', label: 'Security wait', value: 6, unit: 'min' }],
      }),
    )
    expect(armed.rewards).toEqual([])
    expect(session.getSnapshot().toasts).toEqual([])

    session.step(
      world({
        now: 1 + FEEDBACK.effectSettleSec,
        levers: [{ id: 'security_lanes', metricId: 'security_wait', value: 3 }],
        metrics: [{ id: 'security_wait', label: 'Security wait', value: 2, unit: 'min' }],
      }),
    )
    expect(session.getSnapshot().toasts.map((t) => t.text)).toEqual(['Security wait 6m to 2m'])
  })

  it('stays quiet when the measurement does not move', () => {
    const session = new FeedbackSession()
    session.step(world())
    session.step(
      world({
        now: 1,
        levers: [{ id: 'security_lanes', metricId: 'security_wait', value: 2 }],
      }),
    )
    session.step(
      world({
        now: 1 + FEEDBACK.effectSettleSec,
        levers: [{ id: 'security_lanes', metricId: 'security_wait', value: 2 }],
        metrics: [{ id: 'security_wait', label: 'Security wait', value: 6, unit: 'min' }],
      }),
    )
    expect(session.getSnapshot().toasts).toEqual([])
  })
})

describe('airport read', () => {
  it('turns hall loads and prices into levers, metrics, and passengers', () => {
    const read = readFeedback({
      clock: 12,
      paxServed: 4,
      flightsDone: 1,
      signed: ['harbor'],
      reputation: 44,
      publishedFeeIndex: 1,
      fees: { paxFee: 20 },
      fits: [{ rooms: { security: 2 } }],
      hallGuests: [
        { id: 'a', happiness: 42, wx: 1, wz: 2, thought: 'Waiting in the security queue', node: 'security' },
        { id: 'gone', happiness: 10, dead: true, wx: 0, wz: 0 },
      ],
      hallNav: { loads: () => [{ kind: 'security_lane', estWaitSec: 360 }] },
      airline: () => ({ name: 'Harbor Air' }),
    })
    expect(read.metrics.find((m) => m.id === 'security_wait')).toMatchObject({ value: 6, label: 'Security wait' })
    expect(read.levers.find((l) => l.id === 'security_lanes')?.value).toBe(2)
    expect(read.passengers).toHaveLength(1)
    expect(read.passengers[0]).toMatchObject({ queued: true, pricey: true, waitMin: 6 })
    expect(read.airlines).toEqual([{ id: 'harbor', name: 'Harbor Air' }])
    expect(causeFor(read.passengers[0])).toBe('queue')
  })
})

describe('feedback chrome', () => {
  it('renders goal bars and a before/after toast', () => {
    const goals = renderToStaticMarkup(
      <MilestoneStack
        goals={[
          {
            id: 'first_landing',
            title: 'Land a flight',
            detail: 'The first arrival on your runway.',
            value: 0,
            target: 1,
            ratio: 0.4,
            rewardText: '$5,000',
          },
        ]}
        paid={[]}
      />,
    )
    expect(goals).toContain('data-testid="milestone-stack"')
    expect(goals).toContain('Land a flight')
    expect(goals).toContain('width:40%')
    expect(goals).toContain('Reward $5,000')

    const toast = renderToStaticMarkup(<EffectToasts toasts={[{ id: 't1', text: 'Security wait 6m to 2m' }]} />)
    expect(toast).toContain('Security wait 6m to 2m')
    expect(toast).toContain('data-testid="effect-toast"')
  })
})

describe('live rewards', () => {
  it('grants milestone cash through the airport ledger', () => {
    liveFeedback.reset()
    const game = new Game()
    const cash = game.cash
    tickLiveFeedback(game)
    expect(game.cash).toBe(cash)
    game.flightsDone = 1
    game.clock = 1
    tickLiveFeedback(game)
    expect(game.cash).toBe(cash + 5_000)
  })
})
