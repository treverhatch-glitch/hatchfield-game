import { describe, expect, it } from 'vitest'
import { REAL_AIRFRAMES } from '../render/aircraft/realworld.ts'
import { standRefusal } from './eligibility.ts'
import { standAllowReason } from './fit.ts'

describe('stand eligibility', () => {
  it('refuses a rival on a leased stand and allows the holder', () => {
    const rival = standRefusal({
      airlineId: 'zephyr_go',
      leaseAirlineId: 'gulf_pearl',
      size: 'narrow',
      rung: 1,
      airframeId: 'b738',
      aircraftIcao: REAL_AIRFRAMES.b738.icao,
    })
    expect(rival).toMatch(/leased/)
    expect(
      standRefusal({
        airlineId: 'gulf_pearl',
        leaseAirlineId: 'gulf_pearl',
        size: 'narrow',
        rung: 1,
        airframeId: 'b738',
        aircraftIcao: REAL_AIRFRAMES.b738.icao,
      }),
    ).toBeNull()
  })

  it('refuses an A380 on a D-rung heavy pad, a 737 on asphalt, and a Citation on grass', () => {
    expect(standAllowReason('heavy', 0, 'a380', REAL_AIRFRAMES.a380.icao)).toMatch(/code D/)
    expect(standAllowReason('narrow', 0, 'b738', REAL_AIRFRAMES.b738.icao)).toMatch(/asphalt|concrete/i)
    expect(standAllowReason('light', 0, 'citation', REAL_AIRFRAMES.citation.icao)).toMatch(/grass/i)
    expect(standAllowReason('heavy', 2, 'a380', REAL_AIRFRAMES.a380.icao)).toBeNull()
    expect(standAllowReason('narrow', 1, 'b738', REAL_AIRFRAMES.b738.icao)).toBeNull()
    expect(standAllowReason('light', 1, 'citation', REAL_AIRFRAMES.citation.icao)).toBeNull()
  })

  it('refuses a closed or reserved stand before it talks about fit', () => {
    expect(standRefusal({ closed: true, airlineId: 'sky', aircraftIcao: 'C', standLetter: 'C' })).toMatch(/closed/)
    expect(standRefusal({ reserved: true, airlineId: 'sky', aircraftIcao: 'C', standLetter: 'C' })).toMatch(/reserved/)
  })

  it('keeps the contract size-class sentence', () => {
    expect(
      standRefusal({
        airlineId: 'al',
        sizeClassFits: false,
        standId: 'N1',
        aircraftSizeClass: 'wide',
      }),
    ).toBe('stand N1 too small for wide')
  })
})
