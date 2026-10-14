import { beforeEach, describe, expect, it } from 'vitest'
import { AlertStack, type AlertInput } from './alerts.ts'
import { ALERT_TUNING } from './alertsData.ts'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'

const fuel: AlertInput = {
  key: 'cond:fuel-out',
  severity: 'critical',
  title: 'Fuel farm is empty',
  detail: '0 L',
  at: { view: 'apron', cells: [{ c: 3, r: 4 }] },
}
const cash: AlertInput = { key: 'cond:cash', severity: 'warning', title: 'Cash is low', detail: '$4k' }
const inbound: AlertInput = {
  key: 'event:inbound-failed',
  severity: 'critical',
  title: 'Inbound diverted',
  detail: 'HF12',
  event: true,
}

describe('alert stack', () => {
  it('debounces duplicates into one row', () => {
    const s = new AlertStack()
    s.raise(fuel, 0)
    s.raise(fuel, 1)
    s.raise({ ...fuel, detail: 'still 0 L' }, 2)
    expect(s.count).toBe(1)
    expect(s.active[0].detail).toBe('still 0 L')
  })

  it('counts repeated events on the same row', () => {
    const s = new AlertStack()
    s.raise(inbound, 0)
    s.raise({ ...inbound, detail: 'HF14' }, 3)
    expect(s.count).toBe(1)
    expect(s.active[0].count).toBe(2)
  })

  it('a row only ever escalates severity', () => {
    const s = new AlertStack()
    s.raise(cash, 0)
    s.raise({ ...cash, severity: 'critical' }, 1)
    expect(s.active[0].severity).toBe('critical')
    s.raise(cash, 2)
    expect(s.active[0].severity).toBe('critical')
  })

  it('dismiss closes one row and keeps it quiet for a while', () => {
    const s = new AlertStack({ dismissQuietSec: 10 })
    s.raise(fuel, 0)
    s.raise(cash, 0)
    s.dismiss(s.active[0].id, 0)
    expect(s.active.map((a) => a.key)).toEqual(['cond:cash'])
    expect(s.raise(fuel, 5)).toBeNull()
    expect(s.count).toBe(1)
    expect(s.raise(fuel, 11)).not.toBeNull()
    expect(s.count).toBe(2)
  })

  it('ignore silences a problem until it clears', () => {
    const s = new AlertStack({ dismissQuietSec: 1 })
    const row = s.raise(fuel, 0)!
    s.ignore(row.id)
    expect(s.raise(fuel, 500)).toBeNull()
    s.sync('cond:', new Set())
    expect(s.raise(fuel, 501)).not.toBeNull()
  })

  it('sync clears conditions that are no longer true, but not events', () => {
    const s = new AlertStack()
    s.raise(fuel, 0)
    s.raise(cash, 0)
    s.raise(inbound, 0)
    s.sync('cond:', new Set(['cond:cash']))
    expect(s.active.map((a) => a.key).sort()).toEqual(['cond:cash', 'event:inbound-failed'])
  })

  it('event rows fade on their own', () => {
    const s = new AlertStack({ eventTtlSec: 10 })
    s.raise(inbound, 0)
    s.tick(9)
    expect(s.count).toBe(1)
    s.tick(10)
    expect(s.count).toBe(0)
  })

  it('minimise keeps the rows behind the counter', () => {
    const s = new AlertStack()
    s.raise(fuel, 0)
    s.raise(cash, 0)
    s.setMinimised(true)
    expect(s.minimised).toBe(true)
    expect(s.count).toBe(2)
  })

  it('ranks critical first', () => {
    const s = new AlertStack()
    s.raise(cash, 0)
    s.raise(fuel, 1)
    expect(s.ranked().map((a) => a.key)).toEqual(['cond:fuel-out', 'cond:cash'])
  })
})

describe('alerts on the game', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  function started(): Game {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 1
    return game
  }

  it('raises low cash once, and clears it when the bank recovers', () => {
    const game = started()
    game.cash = ALERT_TUNING.lowCash - 1
    for (let i = 0; i < 20; i++) game.tick(0.05 * 4)
    expect(game.alerts.active.filter((a) => a.key === 'cond:cash')).toHaveLength(1)
    game.cash = ALERT_TUNING.lowCash * 10
    for (let i = 0; i < 20; i++) game.tick(0.05 * 4)
    expect(game.alerts.active.some((a) => a.key === 'cond:cash')).toBe(false)
  })

  it('an over-capacity hall raises an alert that pans into the hall', () => {
    const game = started()
    const fit = game.fits[0]
    fit.capGuests = 0
    game.hallGuests.push(spawnHallGuest('keep-full', 'depart', 'budget'))
    game.markHallOverloaded()
    for (let i = 0; i < 20; i++) game.tick(0.05 * 4)
    const row = game.alerts.active.find((a) => a.key.startsWith('cond:hall-full:'))
    expect(row?.at?.view).toBe('hall')
    game.panToAlert(row!.id)
    expect(game.view).toBe('hall')
    expect(game.advisorCells.length).toBeGreaterThan(0)
    expect(game.camGoal?.view).toBe('hall')
  })

  it('panToAlert ignores an alert without an at focus gracefully', () => {
    const game = new Game()
    const row = game.alerts.raise(cash, game.clock)
    expect(row?.at).toBeUndefined()
    game.panToAlert(row!.id)
    // No crash, and focus stays default
    expect(game.camGoal).toBeNull()
  })

  it('clears over-capacity after an expansion and a dismiss stays quiet', () => {
    const game = started()
    game.speed = 1
    const fit = game.fits[0]
    fit.capGuests = 0
    game.hallGuests.push(spawnHallGuest('crowd', 'depart', 'budget'))
    game.markHallOverloaded()
    game.tick(0.3)
    expect(game.hallOverloaded).toBe(true)
    fit.capGuests = 80
    game.tick(0.3)
    expect(game.hallOverloaded).toBe(false)
    expect(game.advice.some((a) => a.id === 'over-capacity')).toBe(false)

    fit.capGuests = 0
    game.markHallOverloaded()
    game.dismissCapacityHint()
    expect(game.visibleHints().some((a) => a.id === 'over-capacity')).toBe(false)
    game.tick(0.3)
    expect(game.hallOverloaded).toBe(true)
    expect(game.visibleHints().some((a) => a.id === 'over-capacity')).toBe(false)
  })

  it('upgrading the prefab recalculates the cap and clears the hint when the crowd fits', () => {
    const game = started()
    game.cash = 500_000
    game.fieldXp = 420
    const fit = game.fits[0]
    const before = fit.capGuests ?? 40
    const hallId = game.hallKey(fit)
    for (let i = 0; i < before + 1; i++) {
      game.hallGuests.push(spawnHallGuest(`crowd-${i}`, 'depart', 'budget', { hallId }))
    }
    game.markHallOverloaded()
    expect(game.advice.some((a) => a.id === 'over-capacity')).toBe(true)
    game.upgradeHall()
    expect(fit.tier).toBe(2)
    expect(fit.capGuests).toBeGreaterThan(before)
    expect(game.hallOverloaded).toBe(false)
    expect(game.advice.some((a) => a.id === 'over-capacity')).toBe(false)
    expect(game.alerts.active.some((a) => a.key.startsWith('cond:hall-full'))).toBe(false)
  })

  it('dismissing from the game removes the row', () => {
    const game = started()
    game.raiseAlert(inbound)
    const id = game.alerts.active[0].id
    game.dismissAlert(id)
    expect(game.alerts.count).toBe(0)
  })
})
