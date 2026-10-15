import { describe, expect, it } from 'vitest'
import type { StandClass } from '../game/types.ts'
import { REAL_AIRFRAMES } from '../render/aircraft/realworld.ts'
import { envelopeLetter, standAccepts } from '../render/aircraft/stands.ts'
import { letterOf, standAllows } from './fit.ts'
import { legacyFitting, migrateStand } from './migrate.ts'

const COMBOS: { cls: StandClass; scale?: 'small' | 'wide' | 'jumbo' }[] = [
  { cls: 'S', scale: 'small' },
  { cls: 'M', scale: 'small' },
  { cls: 'M' },
  { cls: 'L', scale: 'wide' },
  { cls: 'L', scale: 'jumbo' },
  { cls: 'L' },
]

describe('stand migration acceptance', () => {
  it('keeps every airframe on the stand that accepts it today', () => {
    for (const combo of COMBOS) {
      const migrated = migrateStand({ cls: combo.cls, scale: combo.scale, access: 'remote' })
      const letter = envelopeLetter(combo.cls, combo.scale)
      expect(letterOf(migrated.size, migrated.rung)).toBe(letter)
      for (const [id, frame] of Object.entries(REAL_AIRFRAMES)) {
        const today = standAccepts(letter, frame.icao)
        const next = standAllows(migrated.size, migrated.rung, id, frame.icao)
        expect(next, `${id} on ${combo.cls}/${combo.scale ?? 'none'}`).toBe(today)
      }
    }
  })

  it('still refuses a helicopter on a fixed-wing stand', () => {
    const migrated = migrateStand({ cls: 'L', access: 'remote' })
    expect(standAllows(migrated.size, migrated.rung, 'aw139', 'H')).toBe(false)
    expect(standAllows(migrated.size, migrated.rung, 's76', 'H')).toBe(false)
  })

  it('keeps an L stand with no scale able to take an A380', () => {
    const migrated = migrateStand({ cls: 'L', access: 'remote' })
    expect(migrated).toMatchObject({ size: 'heavy', rung: 2 })
    expect(standAllows(migrated.size, migrated.rung, 'a380', REAL_AIRFRAMES.a380.icao)).toBe(true)
  })

  it('writes a legacy jet bridge only when the old record was a jetway', () => {
    expect(legacyFitting(migrateStand({ cls: 'M', access: 'jetway' }))).toEqual({
      id: 'jet_bridge',
      granted: 'legacy',
    })
    expect(legacyFitting(migrateStand({ cls: 'M', access: 'remote', hallNear: true }))).toBeNull()
    expect(legacyFitting(migrateStand({ cls: 'M', hallNear: true }))).toEqual({
      id: 'jet_bridge',
      granted: 'legacy',
    })
    expect(legacyFitting(migrateStand({ cls: 'M', hallNear: false }))).toBeNull()
  })
})
