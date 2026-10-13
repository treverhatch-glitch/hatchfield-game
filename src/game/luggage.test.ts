import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import {
  advanceBagTags,
  advanceScreen,
  freshBook,
  keepPrefabBags,
  makeBagTag,
  markClaimLate,
  ownerClaimReady,
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
})
