import { beforeEach, describe, expect, it } from 'vitest'
import { coolAfterSign, lettersSettled } from './contractPacing.ts'
import { LETTER_PACING } from './contractPacingData.ts'
import { Game } from './sim.ts'
import type { Speed } from './types.ts'

function withSeed(seed: number, run: () => void) {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    run()
  } finally {
    Math.random = orig
  }
}

function started(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  game.paxDesks = 16
  game.paxKiosks = 4
  return game
}

/** Play `realSec` wall seconds at `speed`, signing every letter the moment it lands. */
function eagerSigner(game: Game, realSec: number, speed: Speed) {
  game.speed = speed
  const signedAt: number[] = []
  const dt = 0.5
  for (let t = 0; t < realSec; t += dt) {
    if (game.offer) {
      const before = game.signed.length
      game.acceptOffer()
      if (game.signed.length > before) signedAt.push(game.clock)
    }
    game.tick(dt)
  }
  return signedAt
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('letter cool after a signature', () => {
  it('grows with each carrier on the books and stays inside the cap', () => {
    const cools = [1, 2, 3, 4].map((n) => coolAfterSign(n, 0))
    for (let i = 1; i < cools.length; i++) expect(cools[i]).toBeGreaterThan(cools[i - 1])
    expect(coolAfterSign(1, 0)).toBe(LETTER_PACING.afterSignBase)
    expect(coolAfterSign(1, 1)).toBe(LETTER_PACING.afterSignBase + LETTER_PACING.afterSignJitter)
    expect(coolAfterSign(50, 1)).toBe(LETTER_PACING.afterSignMax)
  })

  it('never lets the second letter in under one sim minute', () => {
    expect(coolAfterSign(1, 0)).toBeGreaterThanOrEqual(60)
  })
})

describe('letters wait for the book to settle', () => {
  it('holds a small book until every signed carrier has turned a flight', () => {
    expect(lettersSettled({ signed: 0, flightsDone: 0, sinceSign: 0 })).toBe(true)
    expect(lettersSettled({ signed: 1, flightsDone: 0, sinceSign: 10 })).toBe(false)
    expect(lettersSettled({ signed: 1, flightsDone: 1, sinceSign: 10 })).toBe(true)
    expect(lettersSettled({ signed: 2, flightsDone: 1, sinceSign: 10 })).toBe(false)
    expect(lettersSettled({ signed: 2, flightsDone: 2, sinceSign: 10 })).toBe(true)
  })

  it('a stuck ramp does not silence the phone forever', () => {
    expect(lettersSettled({ signed: 1, flightsDone: 0, sinceSign: LETTER_PACING.settleMaxWait })).toBe(true)
  })

  it('a grown book is paced by the cool alone', () => {
    expect(
      lettersSettled({ signed: LETTER_PACING.settleUntilSigned, flightsDone: 0, sinceSign: 0 }),
    ).toBe(true)
  })
})

describe('first fifteen minutes on a new field', () => {
  it('the first carrier writes soon after the kit goes down', () => {
    withSeed(7, () => {
      const game = started()
      game.speed = 1
      for (let t = 0; t < 30 && !game.offer; t += 0.5) game.tick(0.5)
      expect(game.offer).not.toBeNull()
    })
  })

  it('an eager signer at 1× gets at most two carriers in five minutes', { timeout: 30_000 }, () => {
    withSeed(11, () => {
      const game = started()
      const signedAt = eagerSigner(game, 300, 1)
      expect(signedAt.length).toBeGreaterThanOrEqual(1)
      expect(signedAt.length).toBeLessThanOrEqual(2)
      for (let i = 1; i < signedAt.length; i++) {
        expect(signedAt[i] - signedAt[i - 1]).toBeGreaterThanOrEqual(LETTER_PACING.afterSignBase)
      }
    })
  })

  it('an eager signer at 3× gets well under six carriers in five minutes', { timeout: 60_000 }, () => {
    // The owner playtest hit six in about five minutes.
    for (const seed of [23, 41, 97]) {
      withSeed(seed, () => {
        const game = started()
        const signedAt = eagerSigner(game, 300, 3)
        expect(signedAt.length).toBeGreaterThanOrEqual(2)
        expect(signedAt.length).toBeLessThanOrEqual(4)
      })
    }
  })

  it('the second letter waits for the first carrier to turn a flight', () => {
    withSeed(5, () => {
      const game = started()
      game.speed = 1
      let flownAtSecond: number | null = null
      for (let t = 0; t < 900; t += 0.5) {
        if (game.offer) {
          if (game.signed.length === 1) {
            flownAtSecond = game.flightsDone
            break
          }
          game.acceptOffer()
        }
        game.tick(0.5)
      }
      expect(flownAtSecond).not.toBeNull()
      expect(flownAtSecond!).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('a carrier already on the books', () => {
  it('does not sign them a second time', () => {
    const game = started()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed.filter((id) => id === 'northline')).toHaveLength(1)
    expect(game.news.some((n) => n.text.includes('already on the books'))).toBe(true)
  })
})

describe('the letter says what it needs', () => {
  it('lists stands, aircraft size, and security, with a qualifies line', () => {
    const game = started()
    const rows = game.reqReport('northline').map((r) => r.label)
    expect(rows.some((l) => /stand(s)?$/.test(l))).toBe(true)
    expect(rows.some((l) => /(Small|Medium|Large) stand\+/.test(l))).toBe(true)
    expect(rows.some((l) => /security/i.test(l))).toBe(true)
    const verdict = game.letterVerdict('northline')
    expect(verdict.met).toBe(game.reqReport('northline').every((r) => r.met))
  })

  it('goes red and names the missing row when the field falls short', () => {
    const game = started()
    for (const row of game.tiles) for (let c = 0; c < row.length; c++) if (row[c] === 'stand') row[c] = 'grass'
    const verdict = game.letterVerdict('northline')
    expect(verdict.met).toBe(false)
    expect(verdict.label).toMatch(/not ready/i)
    expect(verdict.missing.some((m) => /stand/i.test(m))).toBe(true)
  })

  it('names the metal the carrier card sells', () => {
    const game = started()
    const craft = game.contractCraftNeed('bushline')
    expect(craft?.label).toMatch(/Small stand\+/)
    expect(craft?.met).toBe(true)
  })
})

describe('second-letter hint respects the hint switches', () => {
  it('shows after the first departure, mutes as a session hint, and returns with All hints', () => {
    const game = started()
    game.signed = ['northline']
    game.buildTrayOpened = true
    game.flightsDone = 1
    game.refreshAdvice()
    expect(game.visibleHints().some((a) => a.id === 'session-second')).toBe(true)

    game.muteHint('session-second')
    expect(game.hintPrefs.allEnabled).toBe(false)
    expect(game.visibleHints().some((a) => a.id.startsWith('session-'))).toBe(false)

    game.setAllHints(true)
    expect(game.visibleHints().some((a) => a.id === 'session-second')).toBe(true)
  })
})
