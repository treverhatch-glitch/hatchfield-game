import { describe, expect, it } from 'vitest'
import { actorsFrom, bubbleFor, isQueued } from './guestActors'

describe('hall guest actors', () => {
  it('skips guests who are not in the world yet', () => {
    const actors = actorsFrom({
      hallGuests: [
        { id: 'a', wx: 1, wz: 2, thought: 'Waiting at the carousel', hasChecked: true },
        { id: 'b', dead: true, wx: 0, wz: 0 },
        { id: 'c' },
      ],
    })
    expect(actors.map((a) => a.id)).toEqual(['a'])
    expect(actors[0].queued).toBe(true)
    expect(actors[0].state).toBe('queue')
    expect(actors[0].hasChecked).toBe(true)
  })

  it('does not queue someone who is walking or seated', () => {
    expect(isQueued('Heading to gate', false, 0, 'gate')).toBe(false)
    expect(isQueued('Waiting for my bag', true, 0, 'claim')).toBe(false)
    expect(isQueued('At the scanner', false, 2, 'security')).toBe(true)
  })

  it('maps wish, bag and anger lines onto the asset bubbles', () => {
    expect(bubbleFor('wish they had burgers')?.image).toContain('burger')
    expect(bubbleFor('Waiting for my bag')?.image).toContain('bag')
    expect(bubbleFor('Lost in the hall')?.image).toContain('angry')
    expect(bubbleFor('Heading to gate')).toBeNull()
  })
})
