import { describe, expect, it } from 'vitest'
import type { Game } from '../../src/game/sim.ts'
import { TEST_TIMEOUT_MS, buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

const litterPieces = (g: Game) => g.fits.reduce((n, fit) => n + (fit.litter?.length ?? 0), 0)

describe('litter and janitors', () => {
  useSeed(3)

  it('janitors keep the halls no dirtier than an unstaffed run', { timeout: TEST_TIMEOUT_MS }, () => {
    const dirty = buildAirport({ deskStaff: 1, janitors: 0 })
    expectHealthy(runDays(dirty, 5))

    const clean = buildAirport({ deskStaff: 1, janitors: 3 })
    expectHealthy(runDays(clean, 5))

    expect(clean.hallJanitors.length).toBe(3)
    expect(Number.isFinite(litterPieces(clean))).toBe(true)
    expect(litterPieces(clean)).toBeLessThanOrEqual(litterPieces(dirty))
  })
})
