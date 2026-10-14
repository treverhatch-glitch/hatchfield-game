import { beforeEach, describe, expect, it } from 'vitest'
import { CONTRACT_LETTER_DEADLINE, FIRST_CONTRACT_LETTER_DEADLINE } from './catalog.ts'
import { Game } from './sim.ts'
import type { FieldTask } from './types.ts'

function fresh(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

function run(game: Game, seconds: number) {
  game.speed = 1
  for (let t = 0; t < seconds; t += 0.25) game.tick(0.25)
}

beforeEach(() => {
  localStorage.clear()
})

describe('letter timers hold while read', () => {
  it('gives the first contract letter at least 90s, later ones the normal clock', () => {
    expect(FIRST_CONTRACT_LETTER_DEADLINE).toBeGreaterThanOrEqual(90)
    const game = fresh()
    const letter = () => {
      game.offer = null
      game.offerCool = 0
      game.considerOffers()
      return game.offer as { airline: string; deadline: number } | null
    }
    const first = letter()
    expect(first?.deadline).toBe(FIRST_CONTRACT_LETTER_DEADLINE)

    game.signed = [first!.airline]
    expect(letter()?.deadline).toBe(CONTRACT_LETTER_DEADLINE)
  })

  it('pauses the contract countdown while held, resumes on release', () => {
    const game = fresh()
    game.offer = { airline: 'northline', age: 0, deadline: 10 }
    game.holdLetters(['contract'])
    run(game, 20)
    expect(game.offer?.deadline).toBe(10)

    game.holdLetters([])
    run(game, 4)
    expect(game.offer?.deadline).toBeLessThan(10)
    run(game, 10)
    expect(game.offer).toBeNull()
  })

  it('only holds the letter being read', () => {
    const game = fresh()
    game.offer = { airline: 'northline', age: 0, deadline: 30 }
    game.holdLetters(['mx'])
    run(game, 5)
    expect(game.offer!.deadline).toBeLessThan(30)
    expect(game.letterHeld('mx')).toBe(true)
    expect(game.letterHeld('contract')).toBe(false)
  })

  it('pushes a field ask deadline out while held', () => {
    const game = fresh()
    const task: FieldTask = {
      id: 'ask-hold',
      airline: 'northline',
      kind: 'police',
      title: 'Police post',
      blurb: 'Build a police post',
      bonus: 1000,
      deadline: game.clock + 8,
      age: 0,
    }
    game.fieldTask = task
    game.holdLetters(['field'])
    const left = game.fieldTaskLeft()
    run(game, 20)
    expect(game.fieldTask?.id).toBe('ask-hold')
    expect(game.fieldTaskLeft()).toBeCloseTo(left, 0)
  })
})
