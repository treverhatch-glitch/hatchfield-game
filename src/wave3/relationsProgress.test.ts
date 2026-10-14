import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from '../game/airframes.ts'
import { CONTRACT_TIERS, tierWantsLargerMetal, unlocksThrough } from './config.ts'
import { shapeAirlineOffer } from './contracts.ts'
import { Wave3Engine } from './engine.ts'
import { fleetIdsFor, largestInFleet } from './fleet.ts'
import {
  emptyRelations,
  noteFine,
  noteLetter,
  noteMissedAsk,
  noteTurnaround,
  readRelation,
  reviewRelationDay,
  shiftScore,
} from './relations.ts'

const field = { stands: 4, gates: 2, lounges: 1 }

describe('relation progression', () => {
  it('climbs from on-time turns, kept contracts, capacity, lounges and gates', () => {
    let state = noteLetter(emptyRelations(), 'harbor', 'accept')
    for (let turn = 0; turn < 10; turn++) state = noteTurnaround(state, 'harbor', 'success')
    for (let day = 0; day < 30; day++) {
      if (day % 2 === 0) state = noteTurnaround(state, 'harbor', 'success')
      state = reviewRelationDay(state, { day, signed: ['harbor'], ...field })
    }
    const row = readRelation(state, 'harbor')
    expect(row.score).toBeGreaterThanOrEqual(20)
    expect(row.parts.onTime).toBeGreaterThan(0)
    expect(row.parts.kept).toBeGreaterThan(0)
    expect(row.parts.capacity).toBeGreaterThan(0)
    expect(row.parts.lounge).toBeGreaterThan(0)
    expect(row.parts.gate).toBeGreaterThan(0)
    const engine = new Wave3Engine()
    engine.state = { ...engine.state, relations: state }
    expect(engine.relation('harbor').tier).toBeGreaterThanOrEqual(2)
    expect(engine.relation('harbor').unlocks).toContain('More routes')
  })

  it('falls from delays, missed asks and fines', () => {
    let state = noteLetter(emptyRelations(), 'zoomjet', 'accept')
    const afterAccept = readRelation(state, 'zoomjet').score
    state = noteTurnaround(state, 'zoomjet', 'delay')
    state = noteMissedAsk(state, 'zoomjet')
    state = noteFine(state, 'zoomjet')
    const row = readRelation(state, 'zoomjet')
    expect(row.score).toBeLessThan(afterAccept)
    expect(row.parts.delay).toBeLessThan(0)
    expect(row.parts.missed).toBeLessThan(0)
    expect(row.parts.fine).toBeLessThan(0)
    expect(row.counts.delay).toBe(1)
    expect(row.counts.missed).toBe(1)
    expect(row.counts.fine).toBe(1)
  })

  it('reviews a day once', () => {
    let state = noteLetter(emptyRelations(), 'harbor', 'accept')
    state = reviewRelationDay(state, { day: 3, signed: ['harbor'], ...field })
    const once = readRelation(state, 'harbor').score
    state = reviewRelationDay(state, { day: 3, signed: ['harbor'], ...field })
    expect(readRelation(state, 'harbor').score).toBe(once)
  })

  it('gives every tier a visible unlock and never adds metal', () => {
    expect(CONTRACT_TIERS.map((row) => row.unlock)).toEqual([
      'Published schedule',
      'More routes',
      'Hub request',
      'Bigger aircraft',
      'Exclusivity',
    ])
    expect(new Set(CONTRACT_TIERS.map((row) => row.unlock)).size).toBe(5)
    const fleet = fleetIdsFor('bushline')
    for (const row of CONTRACT_TIERS) {
      const relations = shiftScore(emptyRelations(), 'bushline', row.minScore < 0 ? 0 : row.minScore)
      const shaped = shapeAirlineOffer(
        { id: 'bushline', name: 'Bushline Local', fleet: [...fleet] },
        {
          slotsPerWeek: 14,
          feePerPassenger: 5,
          feePerLanding: 150,
          penaltyPerCancellation: 500,
          penaltyPerDelayMinute: 5,
        },
        relations,
      )
      expect(shaped.airframes).toEqual(['bn2', 'dhc6'])
      expect(unlocksThrough(row.tier)).toContain(row.unlock)
    }
    expect(tierWantsLargerMetal(3)).toBe(false)
    expect(tierWantsLargerMetal(4)).toBe(true)
    expect(largestInFleet([AIRFRAMES.bn2!, AIRFRAMES.dhc6!]).id).toBe('dhc6')
  })

  it('opens extra routes from the tier without changing the fine ledger', () => {
    const engine = new Wave3Engine()
    engine.noteLetter('harbor', 'accept')
    for (let turn = 0; turn < 12; turn++) engine.noteTurnaround('harbor', 'success')
    for (let day = 0; day < 40; day++) engine.reviewDay({ day, signed: ['harbor'], ...field })
    expect(engine.relation('harbor').tier).toBeGreaterThanOrEqual(2)
    expect(engine.routesDue('harbor')).toBeGreaterThan(0)
    engine.noteRoutesGranted('harbor', engine.routesDue('harbor'))
    expect(engine.routesDue('harbor')).toBe(0)
    expect(engine.prefersLargerMetal('harbor')).toBe(engine.relation('harbor').tier >= 4)
  })
})
