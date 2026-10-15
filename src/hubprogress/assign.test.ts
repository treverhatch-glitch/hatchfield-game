import { describe, expect, it } from 'vitest'
import { LEASE_SCORE_CAP, SCORE_PER_LEASE } from './config.ts'
import { assignSentences, readLaneLocks } from './assign.ts'

describe('assign screen copy', () => {
  it('names the lease credit and no rival hit for a stand', () => {
    const copy = assignSentences({
      airlineName: 'Gulf Pearl',
      waits: false,
      anger: 'Accepting will anger Zephyr Go and Tango Air (-8).',
      spared: 'Seoul Star is an alliance partner and is spared.',
    })
    expect(copy.relationship).toBe(`+${SCORE_PER_LEASE.dedicated} per day on Dedicated leases, capped at ${LEASE_SCORE_CAP}.`)
    expect(copy.rival.startsWith('No rival hit for the lease.')).toBe(true)
    expect(copy.rival).toContain('Zephyr Go and Tango Air')
    expect(copy.flexibility).toBe('Serves only Gulf Pearl. Taken out of the common pool.')
  })

  it('tells a desk or lane lock that the checklist still waits', () => {
    const copy = assignSentences({ airlineName: 'Brisa', waits: true, anger: '', spared: '' })
    expect(copy.relationship).toContain('waits on the desk allocator')
    expect(copy.rival).toBe('No rival hit for the lease.')
  })

  it('ignores a bad lane row', () => {
    expect(readLaneLocks([{ laneId: 'lane-1', airlineId: 'brisa' }, { laneId: '' }, null])).toEqual([
      { laneId: 'lane-1', airlineId: 'brisa' },
    ])
  })
})
