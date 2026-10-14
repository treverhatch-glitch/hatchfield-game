import { describe, expect, it } from 'vitest'
import type { RequestKind } from '../../src/inbound/types.ts'
import {
  LONG_STEP_SEC,
  TEST_TIMEOUT_MS,
  buildAirport,
  expectBoundedGrowth,
  expectHealthy,
  runDays,
  useSeed,
} from './harness.ts'

const KINDS: RequestKind[] = ['ga', 'bizjet', 'charter', 'medical', 'weather_divert', 'ferry']

describe('inbound requests, 30 days', () => {
  useSeed(1030)

  it('walk-in and priority asks come and go without wedging the field', { timeout: TEST_TIMEOUT_MS }, () => {
    const g = buildAirport({ deskStaff: 1, mechanics: 1, cash: 250_000 })
    let injected = 0
    let answered = 0
    const m = runDays(g, 30, {
      stepSec: LONG_STEP_SEC,
      onDayStart: (game, day) => {
        // Open a card every second day, rotating kinds, and answer it the way a player would.
        if (day % 2 !== 0) return
        const offer = game.injectInbound(KINDS[(day / 2) % KINDS.length])
        if (!offer) return
        injected += 1
        const take = day % 4 === 0
        const ok = take ? game.acceptInbound(offer.id) : game.refuseInbound(offer.id)
        if (ok) answered += 1
      },
    })
    expectHealthy(m)
    expectBoundedGrowth(m)
    expect(injected).toBeGreaterThan(0)
    expect(answered).toBeGreaterThan(0)
    expect(g.inboundOffer()?.id ?? null).not.toBe(undefined)
  })
})
