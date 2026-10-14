import { useState } from 'react'
import type { Band, DiplomacyTier } from '../diplomacy/types.ts'
import type { Game } from '../game/sim.ts'
import { RELATION_MIN, RELATION_MAX } from '../wave3/config.ts'
import { RELATION_PART_LABELS } from '../wave3/relations.ts'
import type { RelationParts } from '../wave3/types.ts'
import { AirlineMark } from './AirlineMark.tsx'
import { PortraitFace } from './PortraitFace.tsx'
import { ReactionCard } from './ReactionCard.tsx'

const TIERS: DiplomacyTier[] = [1, 2, 3, 4, 5]

const BAND_ICON: Record<Band, string> = {
  hostile: '▲',
  cold: '❄',
  neutral: '–',
  warm: '☀',
  partner: '✎',
}

/**
 * Airlines desk inside the slim-bar panel. One card opens at a time.
 * Standing, share, fees and other figures sit in click-open submenus.
 */
export function AirlinesDesk({ game }: { game: Game }) {
  const [tier, setTier] = useState<DiplomacyTier>(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [menu, setMenu] = useState<'standing' | 'contract' | 'demand' | 'fees' | 'figure' | 'rivals' | null>(null)
  const [more, setMore] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [tenureOpen, setTenureOpen] = useState(false)
  const [spatFigures, setSpatFigures] = useState(false)
  const [courting, setCourting] = useState(false)
  const [relationsOpen, setRelationsOpen] = useState(false)
  const [relationId, setRelationId] = useState<string | null>(null)
  const roster = game.diplomacyCards()
  const cards = roster.filter((card) => card.tier === tier)
  const nameOf = (id: string) => roster.find((card) => card.id === id)?.name ?? id
  const spats = game.diplomacySpats()
  const unlocked = game.fieldLevel()
  const prog = game.fieldXpToNext()

  return (
    <section className="airline-tiers" data-testid="diplomacy-panel">
      <h3>Airlines</h3>
      <p className="muted eco-line">
        Field Level {prog.level}
        {prog.level < 5 ? ` · ${Math.round(prog.pct * 100)}% to Lv${prog.level + 1}` : ' · max'}
        {' · '}
        hotkey L
      </p>
      <div className="dip-tabs">
        <button
          type="button"
          className={relationsOpen ? 'on' : ''}
          data-testid="airline-relations-open"
          onClick={() => {
            setRelationsOpen((open) => !open)
            setRelationId(null)
          }}
        >
          Relations
        </button>
      </div>
      {relationsOpen ? (
        <div className="dip-sub" data-testid="airline-relations">
          {game.signed.length === 0 ? (
            <p className="muted">No signed carriers yet. A kept contract is what starts the climb.</p>
          ) : (
            <ul className="dip-roster">
              {game.signed.map((id) => {
                const rel = game.wave3.relation(id)
                const open = relationId === id
                const span = RELATION_MAX - RELATION_MIN
                const pct = Math.max(0, Math.min(100, ((rel.score - RELATION_MIN) / span) * 100))
                const lines = (Object.keys(RELATION_PART_LABELS) as (keyof RelationParts)[]).filter(
                  (key) => rel.parts[key] !== 0,
                )
                return (
                  <li key={id}>
                    <button type="button" className="dip-card" onClick={() => setRelationId(open ? null : id)}>
                      <AirlineMark id={id} color={game.airline(id).color} />
                      <span className="dip-name">{game.airline(id).name}</span>
                      <span className="dip-band">
                        T{rel.tier} {rel.label}
                      </span>
                      <span className="dip-trend">{rel.score > 0 ? `+${rel.score.toFixed(1)}` : rel.score.toFixed(1)}</span>
                    </button>
                    {open ? (
                      <div className="dip-sub" data-testid="airline-relation-detail">
                        <p>
                          {rel.unlock}
                          {rel.next ? ` · next ${rel.next.unlock} at ${rel.next.minScore}` : ''}
                        </p>
                        <div className="rel-meter" aria-hidden>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <ul className="dip-lines">
                          {lines.map((key) => (
                            <li key={key}>
                              <span>{RELATION_PART_LABELS[key]}</span>
                              <span>{rel.parts[key] > 0 ? `+${rel.parts[key].toFixed(1)}` : rel.parts[key].toFixed(1)}</span>
                            </li>
                          ))}
                        </ul>
                        {rel.tier >= 2 ? (
                          <p className="muted">
                            More routes · {rel.extraSlots} extra
                            {rel.routesGranted > 0 ? ` · ${rel.routesGranted} on the board` : ''}
                          </p>
                        ) : null}
                        {rel.tier >= 4 ? (
                          <p className="muted">Bigger aircraft · the largest type already in the fleet.</p>
                        ) : null}
                        {rel.tier >= 3 && !rel.hubAsked && game.airline(id).kind !== 'cargo' && !game.isHub(id) ? (
                          <button type="button" className="on" onClick={() => game.openRelationHub(id)}>
                            Hub request
                          </button>
                        ) : null}
                        {rel.tier >= 5 ? <p>Exclusivity · they want the pier to themselves.</p> : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
      <div className="dip-tabs" role="tablist">
        {TIERS.map((level) => (
          <button
            key={level}
            type="button"
            role="tab"
            className={tier === level ? 'on' : ''}
            aria-selected={tier === level}
            onClick={() => {
              setTier(level)
              setOpenId(null)
              setMenu(null)
            }}
          >
            T{level}
            {unlocked < level ? ' · locked' : ''}
          </button>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="muted">No carriers in this tier yet. The clock unlocks the next letter.</p>
      ) : (
        <ul className="dip-roster">
          {cards.map((card) => {
            const open = openId === card.id
            const lines = card.breakdown
              ? more
                ? card.breakdown.lines
                : card.breakdown.visibleLines
              : []
            const spat = spats.find((row) => row.airlineId === card.id)
            return (
              <li key={card.id} data-testid="diplomacy-card">
                <button
                  type="button"
                  className="dip-card"
                  onClick={() => {
                    setOpenId((cur) => (cur === card.id ? null : card.id))
                    setMenu(null)
                    setMore(false)
                    setMemoryOpen(false)
                    setTenureOpen(false)
                    setSpatFigures(false)
                    setCourting(false)
                  }}
                >
                  <AirlineMark id={card.id} color={card.livery[0]} />
                  <span className="dip-livery" style={{ background: card.livery[0], borderColor: card.livery[1] }} />
                  <span className="dip-name">{card.name}</span>
                  <span
                    className="dip-band"
                    style={{ color: card.band.color }}
                    title={card.band.word}
                  >
                    <span aria-hidden>{BAND_ICON[card.band.band]}</span> {card.band.word}
                  </span>
                  <span className="dip-trend" aria-label={`trend ${card.trend}`}>
                    {card.trend === 'up' ? '↑' : card.trend === 'down' ? '↓' : '→'}
                  </span>
                </button>
                {open ? (
                  <div className="dip-detail" data-testid="diplomacy-detail">
                    <p className="muted">
                      {card.shareClass} · {card.interests.join(' · ')}
                      {card.stage !== 'none' ? ` · ${card.stage.replace(/_/g, ' ')}` : ''}
                      {card.isHub ? ' · Hub' : card.isBase ? ' · Base' : ''}
                    </p>
                    <div className="dip-tabs">
                      <button type="button" className={menu === 'standing' ? 'on' : ''} onClick={() => setMenu(menu === 'standing' ? null : 'standing')}>
                        Standing
                      </button>
                      <button type="button" className={menu === 'contract' ? 'on' : ''} onClick={() => setMenu(menu === 'contract' ? null : 'contract')}>
                        Contract
                      </button>
                      <button type="button" className={menu === 'demand' ? 'on' : ''} onClick={() => setMenu(menu === 'demand' ? null : 'demand')}>
                        Demand
                      </button>
                      <button type="button" className={menu === 'fees' ? 'on' : ''} onClick={() => setMenu(menu === 'fees' ? null : 'fees')}>
                        Fees
                      </button>
                      {card.figure ? (
                        <button
                          type="button"
                          className={menu === 'figure' ? 'on' : ''}
                          data-testid="diplomacy-figure-open"
                          onClick={() => setMenu(menu === 'figure' ? null : 'figure')}
                        >
                          Contact
                        </button>
                      ) : null}
                      <button type="button" className={menu === 'rivals' ? 'on' : ''} onClick={() => setMenu(menu === 'rivals' ? null : 'rivals')}>
                        Rivals
                      </button>
                    </div>
                    {menu === 'standing' && card.breakdown ? (
                      <div className="dip-sub" data-testid="diplomacy-formula">
                        <p>{card.breakdown.formula}</p>
                        <ul className="dip-lines">
                          {lines.map((line) => (
                            <li key={`${line.kind}-${line.label}`}>
                              <span>{line.label}</span>
                              <span>{line.value > 0 ? `+${Math.round(line.value)}` : Math.round(line.value)}</span>
                            </li>
                          ))}
                        </ul>
                        {card.breakdown.hiddenLineCount > 0 ? (
                          <button type="button" onClick={() => setMore((v) => !v)}>
                            {more ? 'Fewer lines' : `${card.breakdown.hiddenLineCount} more`}
                          </button>
                        ) : null}
                        {card.status === 'signed' ? (
                          <div className="row letter-actions">
                            <button type="button" onClick={() => game.diplomacyApologize(card.id)}>
                              Apology
                            </button>
                            <button type="button" onClick={() => game.diplomacyEndeavor(card.id)}>
                              Joint endeavor
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {menu === 'contract' ? (
                      <ol className="dip-ladder">
                        {card.ladder.map((step) => (
                          <li key={step.id} data-state={step.state}>
                            <b>
                              {step.state === 'done' ? '✓' : step.state === 'offered' ? '●' : '·'} {step.label}
                            </b>
                            <span className="muted">{step.detail}</span>
                            {step.id === 'hub' && step.state === 'open' ? (
                              <div>
                                <ReactionCard game={game} airlineId={card.id} kind="hub" />
                                <button type="button" className="on" onClick={() => game.requestDiplomacyHub(card.id)}>
                                  Sign hub
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {menu === 'figure' && card.figure ? (
                      <div className="dip-sub" data-testid="diplomacy-figure">
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <PortraitFace card={card.portrait} name={card.figure.name} />
                          <div>
                            <strong>{card.figure.name}</strong>
                            <p className="muted">{card.figure.title}</p>
                            <p>{card.figure.traits.join(' · ')}</p>
                          </div>
                        </div>
                        <p>{card.figure.agenda}</p>
                        <p className="muted">Voice · {card.figure.voice}</p>
                        <p>{card.figure.shift ?? 'Founding chair. A successor keeps one trait and rolls one new.'}</p>
                        <div className="row letter-actions">
                          <button type="button" onClick={() => setMemoryOpen((v) => !v)}>
                            Memory
                          </button>
                          <button type="button" onClick={() => setTenureOpen((v) => !v)}>
                            Tenure
                          </button>
                        </div>
                        {memoryOpen ? (
                          card.figure.memory.length ? (
                            <ul className="dip-lines">
                              {card.figure.memory.map((line) => (
                                <li key={line}>
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">Nothing quoted back yet.</p>
                          )
                        ) : null}
                        {tenureOpen ? (
                          <p className="muted">
                            Generation {card.figure.generation + 1} · retires day {Math.round(card.figure.retireDay)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {menu === 'rivals' ? (
                      <div className="dip-sub" data-testid="diplomacy-rivals">
                        <p>
                          {card.rivals.length
                            ? `Rivals · ${card.rivals.map((id) => nameOf(id)).join(', ')}`
                            : 'No direct rival yet.'}
                        </p>
                        {card.allies.length ? <p className="muted">Allies · {card.allies.map((id) => nameOf(id)).join(', ')}</p> : null}
                        {spat ? (
                          <>
                            <p>{spat.headline}</p>
                            <div className="row letter-actions">
                              <button type="button" onClick={() => game.answerDiplomacySpat(spat.id, 'concede')}>
                                Concede
                              </button>
                              <button type="button" onClick={() => game.answerDiplomacySpat(spat.id, 'hold')}>
                                Hold firm
                              </button>
                              <button type="button" onClick={() => setCourting((v) => !v)}>
                                Court
                              </button>
                              <button type="button" onClick={() => setSpatFigures((v) => !v)}>
                                Contacts
                              </button>
                            </div>
                            {courting ? (
                              <div className="row letter-actions">
                                {spat.offers.length ? (
                                  spat.offers.map((offer) => (
                                    <button
                                      key={offer.id}
                                      type="button"
                                      onClick={() => game.answerDiplomacySpat(spat.id, 'court', offer.id)}
                                    >
                                      {offer.name}
                                    </button>
                                  ))
                                ) : (
                                  <p className="muted">No rival has offered to take the slots.</p>
                                )}
                              </div>
                            ) : null}
                            {spatFigures ? (
                              <ul className="dip-lines">
                                <li>
                                  <span>Reputation each month</span>
                                  <span>{spat.reputationPerMonth}</span>
                                </li>
                                {spat.offers.map((offer) => (
                                  <li key={offer.id}>
                                    <span>Court {offer.name}</span>
                                    <span>{offer.cost}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          <p className="muted">No public spat.</p>
                        )}
                        {card.poachRisk > 0 ? (
                          <p className="muted">A rival airport is circling. Open Standing for the causes.</p>
                        ) : null}
                      </div>
                    ) : null}
                    {menu === 'demand' ? (
                      card.openCommitment ? (
                        <div className="dip-sub">
                          <p>{card.openCommitment.text}</p>
                          <p className="muted">
                            Progress {Math.round(card.openCommitment.progress * 100)}% · deadline day{' '}
                            {Math.round(card.openCommitment.deadlineDay)}
                          </p>
                          <div className="row letter-actions">
                            <button type="button" className="on" onClick={() => game.answerDiplomacyDemand(card.openCommitment!.id, 'accept')}>
                              Accept
                            </button>
                            <button type="button" onClick={() => game.counterDiplomacyDemand(card.openCommitment!.id, 'longer')}>
                              Longer
                            </button>
                            <button type="button" onClick={() => game.answerDiplomacyDemand(card.openCommitment!.id, 'decline')}>
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="muted">No open demand.</p>
                      )
                    ) : null}
                    {menu === 'fees' ? (
                      <div className="dip-sub" data-testid="diplomacy-fees">
                        <p>Published fee index {game.publishedFeeIndex.toFixed(2)}</p>
                        <p className="muted">A rise hits Standing. Landing fees move with it.</p>
                        <div className="row letter-actions">
                          <button type="button" onClick={() => game.setPublishedFeeIndex(game.publishedFeeIndex - 0.01)}>
                            Cut 1%
                          </button>
                          <button type="button" onClick={() => game.setPublishedFeeIndex(game.publishedFeeIndex + 0.01)}>
                            Raise 1%
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
