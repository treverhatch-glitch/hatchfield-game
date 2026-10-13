import { useState } from 'react'
import { specCashCost, specColumns, SPEC_PATHS, type SpecPath } from '../progression/specializations'
import type { Game } from '../game/sim'

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Slim specialization tree. One path at a time, inside the bottom panel. */
export function SpecTree({ game }: { game: Game }) {
  const fallback: SpecPath = game.specPaths[game.specPaths.length - 1] ?? 'hub'
  const [view, setView] = useState<SpecPath>(fallback)
  const columns = specColumns(view)
  const ownedPath = game.specPaths.includes(view)
  const path = SPEC_PATHS.find((p) => p.id === view)
  const canCommit = !ownedPath && game.specPointsLeft() > 0

  return (
    <section className="spec-panel" data-testid="spec-tree">
      <p className="muted">
        Path points {game.specPointsLeft()} · tree points {game.treePointsLeft()} of{' '}
        {game.treePointsEarned()} at {game.fieldXpToNext().label}. First capstone is list price.
        Each later path: capstone +50% and site upkeep +10%.
      </p>
      <div className="spec-paths" data-testid="spec-paths">
        {SPEC_PATHS.map((row) => {
          const owned = game.specPaths.includes(row.id)
          return (
            <button
              key={row.id}
              type="button"
              className={view === row.id ? 'on' : ''}
              title={owned ? `${row.label} is committed. ${row.blurb}` : row.blurb}
              onClick={() => setView(row.id)}
            >
              {row.label}
              {owned ? ' · on' : ''}
            </button>
          )
        })}
      </div>
      {!ownedPath ? (
        <div className="spec-commit">
          <p className="muted">
            {path?.label} — {path?.blurb} Commit the path before a node will unlock. The first node
            still costs a tree point and starts upkeep.
          </p>
          <button
            type="button"
            disabled={!canCommit}
            title={
              canCommit
                ? `Commit ${path?.label}. Capstone price rises if this is not your first path.`
                : 'No specialization point. Points arrive at Field Levels 6, 8, and 10.'
            }
            onClick={() => game.chooseSpec(view)}
          >
            {canCommit ? `Commit ${path?.label}` : 'No path point'}
          </button>
        </div>
      ) : null}
      <div className="spec-tree">
          {columns.map((col, i) => (
            <div key={`${view}-${i}`} className="spec-col">
              {col.map((node) => {
                const owned = game.specNodes.includes(node.id)
                const gate = game.canBuySpecNode(node.id)
                const price = node.capstone
                  ? specCashCost(node.cash, game.specPaths, node.path)
                  : node.cash
                return (
                  <article
                    key={node.id}
                    className={`spec-card${owned ? ' owned' : ''}`}
                    data-testid={`spec-node-${node.id}`}
                  >
                    <b>
                      {node.name}{' '}
                      <span className="muted">
                        {owned ? '· live' : `· ${node.cost} pt${node.cost === 1 ? '' : 's'}`}
                      </span>
                    </b>
                    <span className="perk">{node.perk}</span>
                    <span className="cost">{node.tradeoff}</span>
                    {node.capstone && price > node.cash ? (
                      <span className="muted">Capstone {money(price)} · mix +50%</span>
                    ) : node.cash > 0 ? (
                      <span className="muted">Cash {money(price)}</span>
                    ) : null}
                    {node.upkeepPerDay > 0 ? (
                      <span className="muted">{money(node.upkeepPerDay)}/day</span>
                    ) : null}
                    {!owned ? (
                      <button
                        type="button"
                        disabled={!gate.ok}
                        title={gate.ok ? `Unlock ${node.name}` : gate.why}
                        onClick={() => game.buySpecNode(node.id)}
                      >
                        {`Unlock · ${node.cost}`}
                      </button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ))}
      </div>
    </section>
  )
}
