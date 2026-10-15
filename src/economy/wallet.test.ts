import { describe, expect, it } from 'vitest'
import { createInitialEconomyState } from './engine.ts'
import { restoreEconomyState, walletCanSell, walletRefusal, walletRole, walletView } from './wallet.ts'
import { LIVE_TECH } from './wiring.ts'

const rich = () => ({ ...createInitialEconomyState(), researchPoints: 50, fieldLevel: 8 })

describe('ops wallet', () => {
  it('marks nodes the sim reads as live and unread leaves as held', () => {
    for (const id of Object.keys(LIVE_TECH)) expect(walletRole(id)).toBe('live')
    expect(walletRole('commercial.t4')).toBe('held')
    expect(walletCanSell('commercial.t4')).toBe(false)
  })

  it('treats prerequisites of a live node as stepping stones that can be bought', () => {
    expect(walletRole('sustainability.t1')).toBe('live')
    expect(walletRole('maintenance.t3')).toBe('stepping')
    expect(walletCanSell('maintenance.t3')).toBe(true)
  })

  it('refuses a held node even with plenty of points', () => {
    expect(walletRefusal('commercial.t1', rich(), 8)).toMatch(/Held back/)
  })

  it('refuses until points and field level are enough, then allows', () => {
    const poor = { ...createInitialEconomyState(), researchPoints: 0, fieldLevel: 1 }
    expect(walletRefusal('sustainability.t1', poor, 1)).toMatch(/more RP/)
    expect(walletRefusal('sustainability.t1', { ...poor, researchPoints: 5 }, 1)).toBeNull()
    expect(walletRefusal('sustainability.t1', poor, 1, true)).toBeNull()
  })

  it('requires prerequisites in order', () => {
    expect(walletRefusal('sustainability.t2', rich(), 8)).toMatch(/Needs/)
  })

  it('reports what can be bought now and an owned count', () => {
    const view = walletView(rich(), 8)
    expect(view.buyable).toBeGreaterThan(0)
    expect(view.nextBuy).not.toBeNull()
    expect(view.owned).toBe(0)
    const node = view.branches.flatMap((b) => b.nodes).find((n) => n.id === 'sustainability.t1')
    expect(node?.state).toBe('buyable')
    expect(node?.shows).toBe(LIVE_TECH['sustainability.t1'].shows)
  })

  it('round-trips and sanitises saved economy state', () => {
    const state = { ...rich(), unlockedTech: ['sustainability.t1'] }
    const back = restoreEconomyState(JSON.parse(JSON.stringify(state)))
    expect(back?.unlockedTech).toEqual(['sustainability.t1'])
    expect(back?.researchPoints).toBe(50)
    const dirty = restoreEconomyState({ ...state, unlockedTech: ['nope.t9', 'sustainability.t1', 4], researchPoints: -3 })
    expect(dirty?.unlockedTech).toEqual(['sustainability.t1'])
    expect(dirty?.researchPoints).toBe(0)
    expect(restoreEconomyState(undefined)).toBeNull()
  })
})
