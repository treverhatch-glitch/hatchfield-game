import { describe, expect, it } from 'vitest'
import { peopleGeo, propParts, walkSwing } from './kit'

describe('terminal prop kit', () => {
  it('builds separate legs and a close-up part for every prop', () => {
    const parts = propParts()
    expect(Object.keys(parts).length).toBeGreaterThan(10)
    for (const list of Object.values(parts)) {
      expect(list.length).toBeGreaterThan(0)
      expect(list.every((part) => part.geo.getAttribute('position').count > 0)).toBe(true)
    }
    expect(parts.counter.some((part) => part.detail)).toBe(true)
    expect(parts.kiosk.some((part) => part.surface === 'steel')).toBe(true)
    expect(parts.kiosk.some((part) => part.surface === 'shop')).toBe(true)
    expect(parts.wc.some((part) => part.surface === 'wall')).toBe(true)
    expect(parts.bin.length).toBeGreaterThan(0)
    expect(parts.bag.some((part) => part.detail)).toBe(true)

    const people = peopleGeo()
    expect(people.legL).not.toBe(people.legR)
    expect(people.torso).not.toBe(people.body)
    expect(people.head).not.toBe(people.torso)
    expect(walkSwing(0.4, 1)).toBeCloseTo(-walkSwing(0.4, 1 + Math.PI))

    for (const geo of [people.body, people.torso, people.legL, people.legR, people.head, people.bag]) geo.dispose()
    for (const list of Object.values(parts)) for (const part of list) part.geo.dispose()
  })
})
