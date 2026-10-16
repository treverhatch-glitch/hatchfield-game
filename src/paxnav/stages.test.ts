import { describe, expect, it } from 'vitest'
import { DEPARTURE_STAGES } from '../terminalbuild/stages.ts'
import { bigTerminal } from './fixtures.test-util.ts'
import { PaxNav } from './paxnav.ts'
import { traceCovers } from './stages.ts'

describe('departure stages', () => {
  it('hits every stage or a named skip, and boards only after the gate desk', () => {
    const nav = new PaxNav(bigTerminal(), { seed: 3, guests: false })
    const departAt = 20_000
    expect(nav.spawn({ id: 'p1', gate: 'g1', departAt, bags: true, needs: ['toilet'], online: false })).toBe(true)
    const events = []
    for (let t = 0; t < departAt && nav.has('p1'); t += 15) {
      nav.tick(15, t)
      events.push(...nav.drainEvents())
    }
    const boarded = events.find((e) => e.kind === 'boarded')
    expect(boarded?.id).toBe('p1')
    const trace = nav.stageTrace('p1')
    expect(trace).toBeTruthy()
    expect(traceCovers(trace!, DEPARTURE_STAGES)).toBe(true)
    expect(trace!.hit.indexOf('GATE_QUEUE')).toBeGreaterThanOrEqual(0)
    expect(trace!.hit.indexOf('GATE_QUEUE')).toBeLessThan(trace!.hit.indexOf('BOARD'))
    expect(trace!.hit).not.toContain('PASSPORT')
    expect(trace!.skips.some((s) => s.stage === 'BAG_DROP' && s.reason === 'desk already took the bags')).toBe(true)
  })
})
