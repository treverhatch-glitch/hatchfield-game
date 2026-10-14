import { describe, expect, it } from 'vitest'
import {
  connectionCauseSentence,
  connectionHint,
  connectionMissRate,
  connectionReportLines,
  emptyConnectionTally,
  recordConnection,
} from './cause.ts'

describe('connection miss causes', () => {
  it('names a late inbound, a slow belt, and a long walk', () => {
    expect(
      connectionCauseSentence({ reason: 'below_mct', delayMin: 176.2, available: 0, needed: 60, mct: 60 }),
    ).toBe('Inbound was 176 min late, inside the 60 min minimum connection.')
    expect(connectionCauseSentence({ reason: 'bag_late', delayMin: 0, available: 64, needed: 90, mct: 60 })).toBe(
      'Bags needed 90 min on the belt and the window was 64 min.',
    )
    expect(connectionCauseSentence({ reason: 'pax_late', delayMin: 0, available: 40, needed: 55, mct: 60 })).toBe(
      'The walk between gates needed 55 min and the window was 40 min.',
    )
    expect(connectionHint('below_mct')).toMatch(/curb/)
    expect(connectionHint('bag_late')).toMatch(/transfer centre/i)
    expect(connectionHint('pax_late')).toMatch(/people mover/i)
  })

  it('reports the miss share and the leading cause', () => {
    const tally = emptyConnectionTally()
    expect(connectionMissRate(tally)).toBeNull()
    expect(connectionReportLines(tally, null)).toEqual([])
    recordConnection(tally, 'ok', { delayMin: 0, available: 160, bagMin: 54 })
    recordConnection(tally, 'below_mct', { delayMin: 180, available: -20, bagMin: 54 })
    recordConnection(tally, 'below_mct', { delayMin: 90, available: 70, bagMin: 54 })
    recordConnection(tally, 'bag_late', { delayMin: 0, available: 64, bagMin: 90 })
    expect(connectionMissRate(tally)).toBeCloseTo(0.75)
    const lines = connectionReportLines(tally, {
      reason: 'below_mct',
      delayMin: 180,
      available: 0,
      needed: 60,
      mct: 60,
    })
    expect(lines[0]).toBe('Made 1 of 4 · 75% missed')
    expect(lines[1]).toBe('Late inbound 2 · bags 1 · walk 0 · diverted 0')
    expect(lines.some((line) => line.includes('curb'))).toBe(true)
    expect(tally.delayBuckets[2]).toBe(1)
    expect(tally.delayBuckets[3]).toBe(1)
  })
})
