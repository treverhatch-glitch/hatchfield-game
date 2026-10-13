import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import {
  advanceBagTags,
  advanceScreen,
  checkedPieceCount,
  freshBook,
  keepPrefabBags,
  makeBagTag,
  markClaimLate,
  ownerClaimReady,
  releaseDelay,
} from './luggage.ts'

describe('luggage book', () => {
  it('puts a carry-on on every passenger and a checked bag on departures', () => {
    const out = spawnHallGuest('f1', 'depart', 'family')
    const inn = spawnHallGuest('f1', 'arrive', 'premium')
    expect(out.carryOn).toBe(true)
    expect(out.hasChecked).toBe(true)
    expect(inn.carryOn).toBe(true)
    expect(inn.hasChecked).toBe(false)
  })

  it('screens a prefab drop and never marks it lost', () => {
    const book = freshBook('f', 12)
    book.dropped = 8
    expect(advanceScreen(book, 0.4, { prefab: true, hallReady: false })).toBe('wait')
    expect(book.screened).toBe(0)
    expect(advanceScreen(book, 0.8, { prefab: true, hallReady: false })).toBe('pass')
    expect(book.screened).toBe(8)
    expect(book.lost).toBe(0)
  })

  it('loses an unscreened drop only when the hall has no bag building and no belt', () => {
    const book = freshBook('f', 10)
    book.dropped = 6
    expect(advanceScreen(book, 1.2, { prefab: false, hallReady: true })).toBe('pass')
    expect(book.lost).toBe(0)

    const bare = freshBook('f2', 10)
    bare.dropped = 6
    expect(advanceScreen(bare, 1.2, { prefab: false, hallReady: false })).toBe('lose')
    expect(bare.lost).toBe(6)
  })

  it('keeps every prefab unit when a later stage skips the cart', () => {
    const book = freshBook('in', 20)
    book.dropped = 0
    keepPrefabBags(book, 'on_claim')
    expect(book.lost).toBe(0)
    expect(book.unloaded).toBe(20)
    expect(book.onClaim).toBe(20)
    keepPrefabBags(book, 'complete')
    expect(book.claimed).toBe(20)
    expect(book.lost).toBe(0)

    const out = freshBook('out', 9)
    out.dropped = 7
    keepPrefabBags(out, 'inflight')
    expect(out.lost).toBe(0)
    expect(out.screened).toBe(7)
    expect(out.loaded).toBe(7)
  })

  it('tags each checked bag with its owner and flight, and staggers reclaim', () => {
    const first = makeBagTag('pax-a', 'NL100', 0, null, 'in')
    const second = makeBagTag('pax-b', 'NL100', 0, null, 'in')
    expect(first.ownerPassengerId).toBe('pax-a')
    expect(first.flightId).toBe('NL100')
    expect(second.flightId).toBe('NL100')
    first.releaseAt = 0
    second.releaseAt = 3
    const clock = {
      prefab: true,
      normal: true,
      departed: () => false,
      stage: () => 'on_claim' as const,
    }
    advanceBagTags([first, second], 0.5, clock)
    expect(first.onClaim).toBe(true)
    expect(second.onClaim).toBe(false)
    expect(ownerClaimReady([first, second], 'pax-a')).toBe(true)
    expect(ownerClaimReady([first, second], 'pax-b')).toBe(false)
    advanceBagTags([first, second], 3, clock)
    expect(second.onClaim).toBe(true)
    expect(first.fault).toBeNull()
    expect(second.fault).toBeNull()
  })

  it('sends a transfer bag onto the connecting flight', () => {
    const bag = makeBagTag('pax-t', 'inbound', 0, 'NL220', 'transfer')
    const missed = advanceBagTags([bag], 0.5, {
      prefab: false,
      normal: true,
      departed: (id) => id === 'NL220',
      stage: () => undefined,
    })
    expect(missed).toBe(1)
    expect(bag.fault).toBe('missed_connection')
    expect(bag.flightId).toBe('inbound')

    const made = makeBagTag('pax-t2', 'inbound', 0, 'NL220', 'transfer')
    const none = advanceBagTags([made], 0.5, {
      prefab: true,
      normal: true,
      departed: () => true,
      stage: () => undefined,
    })
    expect(none).toBe(0)
    expect(made.fault).toBeNull()
    expect(made.flightId).toBe('NL220')
    expect(made.loaded).toBe(true)
  })

  it('marks a late bag only outside a prefab running a normal load', () => {
    const late = makeBagTag('pax-l', 'NL100', 0, null, 'in')
    expect(markClaimLate([late], 'pax-l', 30, { prefab: true, normal: true })).toHaveLength(0)
    expect(late.fault).toBeNull()
    const hit = markClaimLate([late], 'pax-l', 30, { prefab: false, normal: true })
    expect(hit).toHaveLength(1)
    expect(late.fault).toBe('late')
  })

  describe('luggage edge cases and determinism', () => {
    it('handles freshBook edge cases (empty, zero, negative, large, NaN)', () => {
      const empty = freshBook('', 0)
      expect(empty.flightId).toBe('')
      expect(empty.units).toBe(0)
      expect(Number.isNaN(empty.units)).toBe(false)

      const neg = freshBook('neg', -100)
      expect(neg.units).toBe(0)

      const nan = freshBook('nan', NaN)
      expect(nan.units).toBe(0)
      expect(Number.isNaN(nan.units)).toBe(false)

      const large = freshBook('large', 1e9)
      expect(large.units).toBe(1e9)

      // Ensure all numeric counters in freshBook are numbers and not NaN
      for (const [, val] of Object.entries(large)) {
        if (typeof val === 'number') {
          expect(Number.isNaN(val)).toBe(false)
          expect(val).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('handles advanceScreen edge cases (zero drop, NaN/negative dt, large dt)', () => {
      const book = freshBook('f', 10)
      book.dropped = 0
      expect(advanceScreen(book, 10, { prefab: true, hallReady: true })).toBe('wait')

      book.dropped = 5
      expect(advanceScreen(book, NaN, { prefab: true, hallReady: true })).toBe('wait')
      expect(book.screenT).toBe(0)
      expect(Number.isNaN(book.screenT)).toBe(false)

      expect(advanceScreen(book, -5, { prefab: true, hallReady: true })).toBe('wait')
      expect(book.screenT).toBe(0)

      expect(advanceScreen(book, 1e6, { prefab: true, hallReady: true })).toBe('pass')
      expect(book.screened).toBe(5)

      // Already fully screened
      expect(advanceScreen(book, 1.0, { prefab: true, hallReady: true })).toBe('pass')
    })

    it('returns checkedPieceCount for all passenger types', () => {
      expect(checkedPieceCount('budget')).toBe(1)
      expect(checkedPieceCount('business')).toBe(1)
      expect(checkedPieceCount('family')).toBe(2)
      expect(checkedPieceCount('premium')).toBe(2)
      expect(checkedPieceCount('unknown' as any)).toBe(1)
    })

    it('calculates deterministic releaseDelay', () => {
      expect(releaseDelay('')).toBe(0)
      const d1 = releaseDelay('pax-12345')
      const d2 = releaseDelay('pax-12345')
      expect(d1).toBe(d2)
      expect(d1).toBeGreaterThanOrEqual(0)
      expect(d1).toBeLessThanOrEqual(2.4)
      expect(Number.isNaN(d1)).toBe(false)
    })

    it('handles makeBagTag edge cases', () => {
      const tag = makeBagTag('owner', 'flt', NaN, null, 'out')
      expect(tag.id).toBe('owner:flt:0:out')
      expect(Number.isNaN(tag.wait)).toBe(false)
      expect(Number.isNaN(tag.releaseAt)).toBe(false)

      const largeTag = makeBagTag('owner', 'flt', 1e9, 'conn', 'transfer')
      expect(largeTag.id).toBe('owner:flt:1000000000:transfer')
    })

    it('handles ownerClaimReady with empty and partial inputs', () => {
      expect(ownerClaimReady([], 'pax-1')).toBe(false)

      const tagOut = makeBagTag('pax-1', 'flt', 0, null, 'out')
      expect(ownerClaimReady([tagOut], 'pax-1')).toBe(false)

      const tagIn1 = makeBagTag('pax-1', 'flt', 0, null, 'in')
      const tagIn2 = makeBagTag('pax-1', 'flt', 1, null, 'in')
      expect(ownerClaimReady([tagIn1, tagIn2], 'pax-1')).toBe(false)

      tagIn1.onClaim = true
      expect(ownerClaimReady([tagIn1, tagIn2], 'pax-1')).toBe(false)

      tagIn2.picked = true
      expect(ownerClaimReady([tagIn1, tagIn2], 'pax-1')).toBe(true)
    })

    it('handles advanceBagTags edge cases (NaN/negative dt, empty tags, out/transfer tags)', () => {
      expect(advanceBagTags([], 5, { prefab: false, normal: false, departed: () => false, stage: () => 'on_claim' })).toBe(0)

      const tagIn = makeBagTag('pax', 'flt', 0, null, 'in')
      advanceBagTags([tagIn], NaN, { prefab: false, normal: false, departed: () => false, stage: () => 'on_claim' })
      expect(Number.isNaN(tagIn.wait)).toBe(false)
      expect(tagIn.wait).toBe(0)

      advanceBagTags([tagIn], -10, { prefab: false, normal: false, departed: () => false, stage: () => 'on_claim' })
      expect(tagIn.wait).toBe(0)

      const tagOut = makeBagTag('pax', 'flt', 0, null, 'out')
      advanceBagTags([tagOut], 1, { prefab: false, normal: false, departed: () => false, stage: () => 'load_aircraft' })
      expect(tagOut.loaded).toBe(true)
    })

    it('handles markClaimLate edge cases (empty tags, NaN/negative waited)', () => {
      expect(markClaimLate([], 'pax', 100, { prefab: false, normal: false })).toHaveLength(0)

      const tag = makeBagTag('pax', 'flt', 0, null, 'in')
      expect(markClaimLate([tag], 'pax', NaN, { prefab: false, normal: false })).toHaveLength(0)
      expect(tag.fault).toBeNull()

      expect(markClaimLate([tag], 'pax', -5, { prefab: false, normal: false })).toHaveLength(0)
      expect(tag.fault).toBeNull()

      expect(markClaimLate([tag], 'pax', 1e6, { prefab: false, normal: false })).toHaveLength(1)
      expect(tag.fault).toBe('late')
    })

    it('handles keepPrefabBags edge cases and all stages without producing NaN', () => {
      const book = freshBook('f', NaN)
      book.units = NaN as any
      book.dropped = NaN as any
      book.screened = NaN as any
      book.sorted = NaN as any
      book.loaded = NaN as any
      book.unloaded = NaN as any
      book.onClaim = NaN as any
      book.claimed = NaN as any
      book.lost = NaN as any
      book.offloaded = NaN as any
      book.claimLeft = NaN as any

      keepPrefabBags(book, 'complete')

      for (const [, val] of Object.entries(book)) {
        if (typeof val === 'number') {
          expect(Number.isNaN(val)).toBe(false)
          expect(val).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })
})
