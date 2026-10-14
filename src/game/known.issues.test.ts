import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

describe('known overnight fixes', () => {
  it('does not post a $0 payroll shortfall when the bank is empty', () => {
    const game = field()
    game.bank.post('landing_fees', 20_000, { simMinutes: 10, source: 'sim' })
    game.cash = 0.4
    const gap = game.cash - game.bank.balance
    game.clock = 179
    game.tick(2)
    const line = game.news.find((n) => /Payroll/.test(n.text))
    expect(line?.text ?? '').toMatch(/Payroll missed entirely/)
    expect(line?.text ?? '').not.toMatch(/paid \$0/)
    // The day's upkeep leaves cash in debt; a missed payroll no longer lifts it back to $0 (#192).
    expect(game.cash).toBeLessThan(0)
    expect(game.cash - game.bank.balance).toBeCloseTo(gap, 6)
  })

  it('warns in the advisor before Standing collapses', () => {
    const game = field()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.airlineHeat.northline = 30
    game.refreshAdvice()
    const card = game.advice.find((a) => a.id === 'standing-northline')
    expect(card).toBeTruthy()
    const text = `${card?.title} ${card?.detail} ${card?.fix}`
    expect(text).toMatch(/Standing/)
    expect(text).not.toMatch(/heat/i)
    game.airlineHeat.northline = 80
    game.refreshAdvice()
    expect(game.advice.some((a) => a.id === 'standing-northline')).toBe(false)
  })

  it('counts a second premade hall once the construction site finishes', () => {
    const game = field()
    const before = game.fits.length
    game.cash += 500_000
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) game.tiles[14 + r][22 + c] = 'grass'
    }
    game.placePremade({ c: 22, r: 14 })
    expect(game.fits.length).toBe(before)
    const site = game.sites.at(-1)
    expect(site?.kind).toBe('premade')
    game.finishSite(site!)
    game.sites = game.sites.filter((s) => s !== site)
    expect(game.fits.length).toBe(before + 1)
  })
})
