import { useEffect, useState } from 'react'
import type { CounterLineKey } from '../diplomacy/types.ts'
import type { Game } from '../game/sim.ts'

const LINE_KEYS: CounterLineKey[] = ['landing', 'passenger', 'slots', 'discount', 'penalties']

/**
 * Prospect letters sit on the left, at most three, and fold back to a tab after 8 seconds.
 * The success percent and the money live in the counter submenu.
 */
export function DiplomacyLetters({ game }: { game: Game }) {
  const letters = game.diplomacyLetters()
  const [openId, setOpenId] = useState<string | null>(null)
  const [counterFor, setCounterFor] = useState<string | null>(null)
  const [ticks, setTicks] = useState<CounterLineKey[]>(['landing'])

  useEffect(() => {
    if (!openId) return
    const timer = window.setTimeout(() => {
      setOpenId(null)
      setCounterFor(null)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [openId, counterFor, ticks])

  if (!letters.length) return null

  return (
    <>
      {letters.map((letter) => {
        const open = openId === letter.id
        const quoting = open && counterFor === letter.id
        const quote = quoting ? game.diplomacyQuote(letter.id, ticks) : null
        const preview = open ? game.diplomacyPreview(letter.airlineId) : null
        return (
          <article
            key={letter.id}
            className={`letter dip tone-good${open ? ' open' : ''}`}
            data-testid="diplomacy-letter"
          >
            <button
              type="button"
              className="letter-tab"
              onClick={() => {
                setOpenId((cur) => (cur === letter.id ? null : letter.id))
                setCounterFor(null)
              }}
            >
              <span className="letter-kind">{letter.kind === 'flights' ? 'Flights' : letter.kind === 'base' ? 'Base' : 'Prospect'}</span>
              <span className="letter-from">{letter.airline}</span>
              <span className="letter-timer">letter</span>
            </button>
            <div className="letter-body">
              <strong>{letter.airline}</strong>
              <p>{letter.text}</p>
              {preview && preview.rivals.length ? (
                <p className="muted">
                  {preview.rivals.map((row) => `${row.name} ${row.why}`).join(' · ')}
                </p>
              ) : null}
              {preview?.warnings.map((warning) => (
                <p key={warning} className="muted">
                  {warning}
                </p>
              ))}
              {quoting && quote ? (
                <div className="dip-sub" data-testid="diplomacy-counter">
                  <p className="muted">Tick the lines you want changed.</p>
                  <ul className="dip-lines">
                    {quote.lines.map((line) => (
                      <li key={line.key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={ticks.includes(line.key)}
                            onChange={() =>
                              setTicks((cur) =>
                                cur.includes(line.key) ? cur.filter((key) => key !== line.key) : [...cur, line.key],
                              )
                            }
                          />
                          {line.label}
                        </label>
                        <span className="muted">
                          {line.offered} → {line.countered}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p data-testid="diplomacy-chance">Success {Math.round(quote.chance * 100)}%</p>
                  <button
                    type="button"
                    className="on"
                    onClick={() => {
                      const chosen = LINE_KEYS.filter((key) => ticks.includes(key) && quote.lines.some((line) => line.key === key))
                      game.answerDiplomacy(letter.id, 'counter', chosen)
                      setCounterFor(null)
                    }}
                  >
                    Send counter
                  </button>
                </div>
              ) : null}
              <div className="row letter-actions">
                <button type="button" className="on" data-testid="diplomacy-accept" onClick={() => game.answerDiplomacy(letter.id, 'accept')}>
                  Accept
                </button>
                <button
                  type="button"
                  data-testid="diplomacy-counter-open"
                  onClick={() => setCounterFor((cur) => (cur === letter.id ? null : letter.id))}
                >
                  Counter
                </button>
                <button type="button" data-testid="diplomacy-decline" onClick={() => game.answerDiplomacy(letter.id, 'decline')}>
                  Decline
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </>
  )
}
