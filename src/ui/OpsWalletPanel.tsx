import { useState } from 'react'
import type { WalletNodeView, WalletView } from '../economy/wallet.ts'
import { LiveText } from './LiveText.tsx'

/** The slice of Game the wallet sheet reads. It stays inside the bottom chrome. */
export interface OpsWalletGame {
  opsWallet(): WalletView
  buyOpsTech(id: string): boolean
}

const STATE_LABEL: Record<WalletNodeView['state'], string> = {
  owned: 'Owned',
  buyable: 'Ready',
  short: 'Short of RP',
  locked: 'Locked',
  held: 'Held back',
}

/**
 * Operations wallet. Points arrive on their own (field levels, cleared bottlenecks, flights,
 * researchers). This sheet is where they are spent. Nodes no system reads are held back.
 */
export function OpsWalletPanel({ game }: { game: OpsWalletGame }) {
  const view = game.opsWallet()
  const [branchId, setBranchId] = useState(view.branches[0]?.id ?? '')
  const branch = view.branches.find((row) => row.id === branchId) ?? view.branches[0]
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    branch?.nodes.find((node) => node.id === selectedId) ??
    branch?.nodes.find((node) => node.id === view.nextBuy) ??
    branch?.nodes[0]
  const spendable = (row: WalletView['branches'][number]) =>
    row.nodes.filter((node) => node.state === 'buyable').length

  return (
    <section className="rtree ops-wallet" data-testid="ops-wallet">
      <div className="dip-tabs" role="tablist" aria-label="Operations wallet">
        <button type="button" role="tab" className="on" aria-selected="true">
          Ops wallet
        </button>
      </div>
      <p className="muted" data-testid="ops-wallet-intro">
        A second pot of points, apart from the Growth tree. It buys operations upgrades. Nodes the airport does not
        read yet stay held back, so nothing here is a dead purchase.
      </p>
      <div className="rtree-body">
        <ul className="rtree-cats">
          {view.branches.map((row) => {
            const ready = spendable(row)
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={branch?.id === row.id ? 'on' : ''}
                  aria-pressed={branch?.id === row.id}
                  data-testid={`ops-branch-${row.id}`}
                  onClick={() => {
                    setBranchId(row.id)
                    setSelectedId(null)
                  }}
                >
                  {row.name}
                  {ready > 0 ? <span className="muted"> · {ready} ready</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="rtree-canvas" data-testid="ops-nodes">
          <div className="rtree-lane">
            {branch?.nodes.map((node, index) => (
              <span key={node.id} className="rtree-step">
                {index > 0 ? <i className="rtree-line" /> : null}
                <button
                  type="button"
                  className={`rtree-node is-${node.state === 'buyable' || node.state === 'short' ? 'available' : node.state === 'owned' ? 'owned' : 'locked'}${selected?.id === node.id ? ' is-selected' : ''}`}
                  data-testid={`ops-node-${node.id}`}
                  data-state={node.state}
                  data-role={node.role}
                  onClick={() => setSelectedId(node.id)}
                >
                  {node.state === 'locked' || node.state === 'held' ? (
                    <span className="rtree-lock" aria-label={STATE_LABEL[node.state]}>
                      🔒
                    </span>
                  ) : (
                    <span className="rtree-ring" />
                  )}
                  <span className="rtree-name">{node.name}</span>
                  <span className={`rtree-cost${node.state === 'buyable' ? ' is-open' : ''}`}>{node.costRp}</span>
                </button>
              </span>
            ))}
          </div>
        </div>
        <aside className="rtree-card" data-testid="ops-card">
          {selected ? (
            <>
              <h3>{selected.name}</h3>
              <p>{selected.description}</p>
              <p className="muted" data-testid="ops-node-shows">
                {selected.role === 'live' ? 'In the airport: ' : selected.role === 'stepping' ? 'Step: ' : ''}
                {selected.shows}
              </p>
              <p className="muted" data-testid="ops-node-state">
                {STATE_LABEL[selected.state]} · {selected.costRp} RP · Field level {selected.fieldLevel}
              </p>
              {selected.reason && selected.state !== 'held' ? (
                <p className="muted" data-testid="ops-lock">
                  {selected.reason}
                </p>
              ) : null}
              {selected.state === 'owned' ? null : (
                <button
                  type="button"
                  className="wide"
                  data-testid="ops-unlock"
                  disabled={selected.state !== 'buyable'}
                  onClick={() => game.buyOpsTech(selected.id)}
                >
                  {selected.state === 'buyable' ? `Unlock · ${selected.costRp} RP` : STATE_LABEL[selected.state]}
                </button>
              )}
            </>
          ) : null}
        </aside>
      </div>
      <footer className="rtree-foot" data-testid="ops-wallet-points">
        Ops points:{' '}
        <LiveText read={() => `${game.opsWallet().points}`} testId="ops-wallet-points-live" /> · {view.owned} of{' '}
        {view.branches.length * 4} owned · {Math.round(view.progress * 100)}% to the next point
      </footer>
      <details className="ops-sources">
        <summary>How points arrive</summary>
        <ul className="airlines">
          {view.sources.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
