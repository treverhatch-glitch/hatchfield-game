import { describe, expect, it } from 'vitest'
import { bigTerminal, runChecked } from './fixtures.test-util.ts'
import { GUEST_GLANCE, GUEST_FIRST_NAMES, PaxNav, glanceOf, guestName, moodWord, topNeedOf, type NeedKey } from './index.ts'

const calm: Record<NeedKey, number> = { hunger: 0.1, thirst: 0.1, bladder: 0.1, boredom: 0.1, tired: 0.1, comfort: 0.1, anxiety: 0 }

describe('guest names and glance', () => {
  it('gives the same guest the same name every time, and different guests different names', () => {
    expect(guestName('pax-1')).toBe(guestName('pax-1'))
    const names = new Set(Array.from({ length: 300 }, (_, i) => guestName(`pax-${i}`)))
    expect(names.size).toBeGreaterThan(200)
    for (const n of names) expect(GUEST_FIRST_NAMES).toContain(n.split(' ')[0] as (typeof GUEST_FIRST_NAMES)[number])
  })

  it('maps satisfaction to a mood word, best band first', () => {
    expect(moodWord(100)).toBe('Delighted')
    expect(moodWord(70)).toBe('Content')
    expect(moodWord(50)).toBe('Uneasy')
    expect(moodWord(30)).toBe('Unhappy')
    expect(moodWord(0)).toBe('Furious')
  })

  it('names the highest need only when it is worth naming', () => {
    expect(topNeedOf(calm)).toBeNull()
    const hot = topNeedOf({ ...calm, bladder: 0.9, hunger: 0.6 })!
    expect(hot.key).toBe('bladder')
    expect(hot.label).toBe(GUEST_GLANCE.needLabels.bladder)
  })

  it('reads a live walker: name, mood, top need and the thought they last had', () => {
    const nav = new PaxNav(bigTerminal(), { seed: 7, guests: true })
    nav.addStock('shop1', -1000)
    nav.spawn({
      id: 'hungry',
      gate: 'g1',
      departAt: 3 * 3600,
      bags: false,
      purpose: 'leisure',
      flags: [],
      startNeeds: { hunger: 0.95, bladder: 0, boredom: 0, thirst: 0 },
    })
    runChecked(nav, 0, 400, 0.25)
    const card = nav.guest('hungry')!
    expect(card.name).toBe(guestName('hungry'))
    const g = glanceOf(card)
    expect(g.name).toBe(card.name)
    expect(g.mood).toBe(moodWord(card.satisfaction))
    const latest = card.thoughts[card.thoughts.length - 1]
    expect(g.thought).toBe(`${latest.icon} ${latest.text}`)
    expect(card.thoughts.map((t) => t.text)).toContain('Shop is out of stock')
  })

  it('carries a thought out as a mood event the sim can put on the fare', () => {
    const nav = new PaxNav(bigTerminal(), { seed: 7, guests: true })
    nav.addStock('shop1', -1000)
    nav.spawn({
      id: 'hungry',
      gate: 'g1',
      departAt: 3 * 3600,
      bags: false,
      purpose: 'leisure',
      flags: [],
      startNeeds: { hunger: 0.95, bladder: 0, boredom: 0, thirst: 0 },
    })
    runChecked(nav, 0, 400, 0.25)
    const moods = nav.drainMood()
    const stockout = moods.find((m) => m.key === 'out_of_stock')
    expect(stockout?.id).toBe('hungry')
    expect(stockout!.delta).toBeLessThan(0)
    expect(nav.drainMood()).toEqual([])
  })
})
