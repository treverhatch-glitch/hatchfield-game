import { describe, expect, it } from 'vitest'
import { LEASE_SCORE_CAP, SCORE_PER_LEASE } from './config.ts'
import { assignSentences, bulkKindFor, checklistAssignTarget, leaseCell, readLaneLocks } from './assign.ts'

describe('assign picker copy', () => {
  it('names the lease credit, no rival hit, and the pool cost', () => {
    const copy = assignSentences({
      airlineName: 'Gulf Pearl',
      kind: 'gate',
      anger: 'Accepting will anger Zephyr Go and Tango Air (-8).',
      spared: 'Seoul Star is an alliance partner and is spared.',
    })
    expect(copy.relationship).toBe(
      `+${SCORE_PER_LEASE.dedicated} per day on Dedicated leases, capped at ${LEASE_SCORE_CAP}.`,
    )
    expect(copy.rival.startsWith('No rival hit for the lease.')).toBe(true)
    expect(copy.rival).toContain('Zephyr Go and Tango Air')
    expect(copy.rival).toContain('Seoul Star')
    expect(copy.flexibility).toBe('Serves only Gulf Pearl. Taken out of the common pool.')
  })

  it('tells a desk lock that the checklist still waits', () => {
    const copy = assignSentences({
      airlineName: 'Brisa',
      kind: 'desk',
      anger: '',
      spared: '',
      feeNote: 'Below Preferred this desk costs $2,000.',
    })
    expect(copy.relationship).toContain('waits on the desk allocator')
    expect(copy.rival).toBe('No rival hit for the lease.')
    expect(copy.flexibility).toContain('Serves only Brisa')
    expect(copy.flexibility).toContain('$2,000')
  })

  it('links a missing line to the kind it names', () => {
    expect(checklistAssignTarget('desk')).toEqual({ kind: 'desk' })
    expect(checklistAssignTarget('lane')).toEqual({ kind: 'lane' })
    expect(checklistAssignTarget('pier')).toEqual({ kind: 'gate' })
    expect(checklistAssignTarget('veh-tug')).toEqual({ kind: 'vehicle', role: 'tug' })
    expect(checklistAssignTarget('fuel')).toEqual({ kind: 'vehicle', role: 'fuelTruck' })
    expect(checklistAssignTarget('tenure')).toBeNull()
    expect(checklistAssignTarget('onTime')).toBeNull()
    expect(bulkKindFor('desk')).toBe('desk')
    expect(bulkKindFor('gate')).toBe('gate')
    expect(bulkKindFor('lounge')).toBeNull()
  })

  it('reads a stand cell and ignores a bad lane row', () => {
    expect(leaseCell('stand:4,12')).toEqual({ c: 4, r: 12, index: 0 })
    expect(leaseCell('lounge:3,8:1')).toEqual({ c: 3, r: 8, index: 1 })
    expect(readLaneLocks([{ laneId: 'lane-1', airlineId: 'brisa' }, { laneId: '' }, null])).toEqual([
      { laneId: 'lane-1', airlineId: 'brisa' },
    ])
  })
})
