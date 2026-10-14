import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { readPhoneCards } from './readGame.ts'

describe('readPhoneCards', () => {
  it('reads a contract letter and leaves emergencies, threats, hints, and alerts out', () => {
    const game = new Game()
    game.offer = { airline: 'northline', age: 0, deadline: 90 }
    game.pendingThreat = {
      id: 'threat-1',
      severity: 'hard',
      blurb: 'Hard threat on the apron',
      age: 0,
      deadline: 20,
    }
    game.pendingEmergency = {
      id: 'em-1',
      kind: 'divert',
      blurb: 'Weather divert',
      fee: 8000,
      age: 0,
      deadline: 30,
      airline: 'harbor',
      needs: { stand: true, fire: true, fuel: true, hangar: false, minRunway: 8 },
    }
    game.advice.push({ id: 'session-contract', title: 'Sign a carrier', cells: [], detail: 'Tip chip', fix: '' })
    game.alerts.raise(
      { key: 'fuel-dry', severity: 'critical', title: 'Fuel farm dry', detail: 'No fuel' },
      0,
    )

    const cards = readPhoneCards(game)
    expect(cards.map((card) => card.id)).toEqual(['contract', 'contract-file'])
    const letter = cards.find((card) => card.id === 'contract')
    expect(letter?.tab).toBe('messages')
    expect(letter?.actions.map((action) => action.id)).toEqual(['sign', 'decline', 'negotiate', 'later'])
    expect(cards.find((card) => card.id === 'contract-file')?.tab).toBe('contracts')
    const blob = JSON.stringify(cards)
    expect(blob).not.toContain('Hard threat')
    expect(blob).not.toContain('Weather divert')
    expect(blob).not.toContain('Sign a carrier')
    expect(blob).not.toContain('Fuel farm dry')
    expect(game.pendingEmergency?.id).toBe('em-1')
    expect(game.pendingThreat?.id).toBe('threat-1')
  })
})
