import { useEffect } from 'react'
import type { Game } from '../../game/sim.ts'
import { HubProfile } from './HubPanels.tsx'

/** Airlines menu tab. Every signed carrier, outside the phone. */
export function AirlinesHub({ game }: { game: Game }) {
  const focus = game.hubDeepLinkAirline
  useEffect(() => {
    if (!focus) return
    document.getElementById(`airline-hub-${focus}`)?.scrollIntoView({ block: 'nearest' })
  }, [focus, game.hubDeepLinkTick, game.hubRelationsTick])

  return (
    <section className="airline-hub" data-testid="airline-hub">
      <h3>Airlines hub</h3>
      {game.signed.length === 0 ? (
        <p className="muted">No signed carriers yet. A kept contract is what starts the climb.</p>
      ) : (
        game.signed.map((id) => {
          const rel = game.wave3.relation(id)
          const score = rel.score > 0 ? `+${rel.score.toFixed(1)}` : rel.score.toFixed(1)
          const anger = game.hubAngerPreview(id)
          const assets = game.dedicatedAssetLabels(id)
          return (
            <article key={id} id={`airline-hub-${id}`} className="airline-hub-card" data-testid={`airline-hub-${id}`}>
              <h4>{game.airline(id).name}</h4>
              <p data-testid={`airline-hub-rel-${id}`}>
                {rel.label} {score} · {game.wave3.feeLine(id)}
              </p>
              <HubProfile game={game} id={id} />
              <p data-testid={`airline-hub-rivals-${id}`}>
                {anger.anger || 'No signed rival is angry about this step.'}
                {anger.spared ? ` ${anger.spared}` : ''}
              </p>
              <div data-testid={`airline-hub-dedicated-${id}`}>
                <p>Dedicated assets</p>
                {assets.length === 0 ? (
                  <p className="muted">Nothing dedicated yet.</p>
                ) : (
                  <ul className="hub-lines">
                    {assets.map((label) => (
                      <li key={label}>
                        <span aria-hidden>·</span>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}
