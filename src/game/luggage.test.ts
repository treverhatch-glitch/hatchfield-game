import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { advanceScreen, freshBook, keepPrefabBags } from './luggage.ts'

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
})
