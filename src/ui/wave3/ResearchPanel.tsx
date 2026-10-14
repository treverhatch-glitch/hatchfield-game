import { useEffect, useState } from 'react'
import { BRANCHES, type ResearchBranch } from '../../wave3/config.ts'
import type { Game } from '../../game/sim.ts'
import { CeoCardView } from './CeoCard.tsx'
import { LabAnimation } from './LabAnimation.tsx'

/** Click-open specialization tree. One branch at a time. */
export function ResearchPanel({ game }: { game: Game }) {
  const [branch, setBranch] = useState<ResearchBranch>('passenger')
  const [showCeo, setShowCeo] = useState(false)
  const gear = game.labGear()
  const rooms = { desk: gear.desks, board: gear.boards, machine: gear.machines }
  const [frame, setFrame] = useState(() => game.wave3.frame(rooms))
  useEffect(() => {
    let raf = 0
    let last = ''
    const loop = () => {
      const gearNow = game.labGear()
      const next = game.wave3.frame({
        desk: gearNow.desks,
        board: gearNow.boards,
        machine: gearNow.machines,
      })
      const key = `${next.phase}:${next.rooms}:${Math.round(next.bob * 8)}:${Math.round(next.glow * 8)}`
      if (key !== last) {
        last = key
        setFrame(next)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [game])
  const points = game.wave3.points()
  const level = game.fieldLevel()
  const nodes = game.wave3.nodes().filter((node) => node.branch === branch)
  const sample = game.signed[0] ?? game.offer?.airline ?? 'bushline'
  const card = game.wave3.relation(sample)

  return (
    <section className="wave3-panel" data-testid="wave3-panel">
      <h3>Research</h3>
      <p className="muted" data-testid="wave3-points">
        {points} research points · operations trickle is on from day 1, before anyone is hired.
        Rooms add the rest
        {rooms.desk + rooms.board + rooms.machine > 0
          ? ` · desk ${rooms.desk} · board ${rooms.board} · bench ${rooms.machine}`
          : ' · no research room placed yet'}
        .
      </p>
      <LabAnimation frame={frame} />
      <div className="dip-tabs" role="tablist">
        {BRANCHES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={branch === id ? 'on' : ''}
            aria-selected={branch === id}
            onClick={() => setBranch(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <ul className="wave3-tree" data-testid="wave3-tree">
        {nodes.map((node) => {
          const owned = game.wave3.state.research.unlocked.includes(node.id)
          const gate = game.wave3BuyPreview(node.id)
          return (
            <li key={node.id} data-testid={`wave3-node-${node.id}`}>
              <b>
                {node.depth}. {node.name}{' '}
                <span className="muted">{owned ? '· live' : `· ${node.cost} RP`}</span>
              </b>
              <span className="muted">{node.blurb}</span>
              {owned ? null : (
                <button type="button" className="wide" disabled={!gate.ok} title={gate.why} onClick={() => game.buyWave3(node.id)}>
                  {gate.ok ? `Research · ${node.cost}` : gate.why}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="muted">Field level {level}. A late lab can nearly finish one branch.</p>
      <button type="button" onClick={() => setShowCeo((v) => !v)}>
        {showCeo ? 'Hide carrier card' : 'Carrier card'}
      </button>
      {showCeo ? (
        <CeoCardView
          card={card.ceo}
          score={card.score}
          band={card.band}
          tierLabel={`T${card.tier} ${card.label}`}
          fleet={card.fleetLabel}
          line={card.ceo.voice}
        />
      ) : null}
    </section>
  )
}
