import { describe, expect, it } from 'vitest'
import { helipadTurnOnPad, type PadTurn } from './padHeli.ts'

const cell = { c: 4, r: 9 }

function turn(partial: Partial<PadTurn>): PadTurn {
  return { craft: 'helo', phase: 'servicing', stand: cell, ...partial }
}

describe('decorative pad helicopter', () => {
  it('shows only while a helicopter turn is on that pad', () => {
    expect(helipadTurnOnPad([], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ phase: 'approach' })], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ phase: 'hold' })], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ phase: 'takeoff' })], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ phase: 'gone' })], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ stand: { c: 1, r: 1 } })], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ craft: 'jet', phase: 'servicing' })], cell)).toBe(false)
    expect(helipadTurnOnPad([turn({ phase: 'landing' })], cell)).toBe(true)
    expect(helipadTurnOnPad([turn({ phase: 'taxi_in' })], cell)).toBe(true)
    expect(helipadTurnOnPad([turn({ phase: 'servicing' })], cell)).toBe(true)
    expect(helipadTurnOnPad([turn({ phase: 'deboard' })], cell)).toBe(true)
    expect(helipadTurnOnPad([turn({ phase: 'board' })], cell)).toBe(true)
    expect(helipadTurnOnPad([turn({ phase: 'parked' })], cell)).toBe(true)
  })
})