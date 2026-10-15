import { describe, expect, it } from 'vitest'
import { allianceOf, rivalsOfRoster, ROSTER_RIVAL_PAIRS } from '../airlines/rivals.ts'
import { angerSentence, planBacklash } from './backlash.ts'
import { emptyHubFacilities, hubChecklist } from './checklist.ts'
import { MIN_DAYS_AT_TIER, RIVAL_BACKLASH } from './config.ts'
import { vehicleNeedFor } from './vehicles.ts'

describe('roster rivals', () => {
  it('spares Seoul Star when Gulf Pearl climbs and names Zephyr Go and Tango Air', () => {
    expect(allianceOf('gulf_pearl')).toContain('seoul_star')
    expect(rivalsOfRoster('gulf_pearl')).toEqual(expect.arrayContaining(['zephyr_go', 'tango_air']))
    expect(rivalsOfRoster('gulf_pearl')).not.toContain('seoul_star')
    for (const [a, b] of ROSTER_RIVAL_PAIRS) {
      expect(allianceOf(a)).not.toContain(b)
    }
  })
})

describe('backlash plan', () => {
  const signed = [
    { id: 'zephyr_go', name: 'Zephyr Go', standing: 20 },
    { id: 'tango_air', name: 'Tango Air', standing: 80 },
    { id: 'seoul_star', name: 'Seoul Star', standing: 90 },
  ]

  it('says who the accept will anger and turns a happy relocate into a trim', () => {
    const low = planBacklash({
      holderId: 'gulf_pearl',
      tier: 'hub',
      signed,
      roll: 0.05,
      poachStandingMax: 42,
    })
    expect(low.anger).toContain('Zephyr Go -6.7')
    expect(low.anger).toContain('Tango Air -2.9')
    expect(low.anger).not.toContain('Seoul Star')
    expect(low.spared).toContain('Seoul Star')
    expect(low.hit.find((row) => row.airlineId === 'zephyr_go')?.effect).toBe('relocate')
    expect(low.hit.find((row) => row.airlineId === 'tango_air')?.effect).toBe('trim')
    expect(low.hit.find((row) => row.airlineId === 'zephyr_go')?.score).toBe(-6.7)
    expect(low.hit.find((row) => row.airlineId === 'tango_air')?.score).toBe(-2.9)
    expect(low.hit.every((row) => row.score !== RIVAL_BACKLASH.hub.score)).toBe(true)

    const calm = planBacklash({ holderId: 'gulf_pearl', tier: 'focus', signed, roll: 0, poachStandingMax: 42 })
    expect(calm.anger).toBe('')
    expect(calm.hit).toEqual([])
  })

  it('scales a negative rival harder than a happy one, and a fierce pair harder still', () => {
    const plan = planBacklash({
      holderId: 'gulf_pearl',
      tier: 'primary',
      signed: [
        { id: 'aurora_nordic', name: 'Aurora Nordic', standing: 76 },
        { id: 'zephyr_go', name: 'Zephyr Go', standing: -15 },
      ],
      roll: 0.5,
      poachStandingMax: 42,
    })
    const aurora = plan.hit.find((row) => row.airlineId === 'aurora_nordic')
    const zephyr = plan.hit.find((row) => row.airlineId === 'zephyr_go')
    expect(aurora?.intensity).toBe('fierce')
    expect(aurora?.effect).toBe('score')
    expect(zephyr?.effect).toBe('relocate')
    expect(Math.abs(aurora?.score ?? 0)).toBeLessThan(15)
    expect(Math.abs(zephyr?.score ?? 0)).toBeGreaterThan(Math.abs(aurora?.score ?? 0))
    expect(Math.abs(zephyr?.score ?? 0)).toBeGreaterThan(15)
  })

  it('builds the anger sentence for one name and for three', () => {
    expect(angerSentence(['Zephyr Go'], -8)).toBe('Accepting will anger Zephyr Go (-8).')
    expect(angerSentence(['A', 'B', 'C'], -4)).toBe('Accepting will anger A, B, and C (-4).')
  })
})

describe('vehicle gates and tenure', () => {
  it('asks a budget base for a tug, a flag hub for three trucks, and a cargo hub for fuel', () => {
    expect(vehicleNeedFor('budget', 'base')).toEqual({ tug: 1 })
    expect(vehicleNeedFor('budget', 'hub')).toEqual({ tug: 1 })
    expect(vehicleNeedFor('flag', 'hub')).toMatchObject({ tug: 1, belt: 1, catering: 1 })
    expect(vehicleNeedFor('flag', 'primary')).toMatchObject({ tug: 1, belt: 1, catering: 1 })
    expect(vehicleNeedFor('cargo', 'hub')).toEqual({ fuelTruck: 1 })
    expect(vehicleNeedFor('heli', 'base')).toEqual({})
    expect(MIN_DAYS_AT_TIER.primary).toBe(30)
  })

  it('keeps the next letter closed until the current tier has been held', () => {
    const early = hubChecklist(
      {
        id: 'brisa',
        name: 'Brisa',
        type: 'budget',
        signed: true,
        tier: 'station',
        contractTier: 2,
        onTimeRate: 0.9,
        onTimeDays: 14,
      },
      { ...emptyHubFacilities(), daysAtTier: 3, deskAllocator: true, preferredDesks: 1 },
    )
    expect(early.lines.find((line) => line.id === 'tenure')?.status).toBe('missing')
    expect(early.eligible).toBe(false)

    const held = hubChecklist(
      {
        id: 'brisa',
        name: 'Brisa',
        type: 'budget',
        signed: true,
        tier: 'focus',
        contractTier: 3,
        diplomacyBand: 'warm',
        onTimeRate: 0.9,
        onTimeDays: 14,
      },
      { ...emptyHubFacilities(), daysAtTier: 14, deskAllocator: true, dedicatedDesks: 2, overnight: 1 },
    )
    expect(held.lines.find((line) => line.id === 'veh-tug')?.status).toBe('missing')
    const withTug = hubChecklist(
      {
        id: 'brisa',
        name: 'Brisa',
        type: 'budget',
        signed: true,
        tier: 'focus',
        contractTier: 3,
        diplomacyBand: 'warm',
        onTimeRate: 0.9,
        onTimeDays: 14,
      },
      {
        ...emptyHubFacilities(),
        daysAtTier: 14,
        deskAllocator: true,
        dedicatedDesks: 2,
        overnight: 1,
        vehicles: { tug: 1 },
      },
    )
    expect(withTug.lines.find((line) => line.id === 'veh-tug')?.status).toBe('ok')
    expect(withTug.eligible).toBe(true)
  })
})
