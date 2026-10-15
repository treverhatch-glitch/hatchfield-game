import { useState } from 'react'
import { CATEGORIES, SPEC_BRANCHES } from '../../research/config.ts'
import { lockCopy, nodeCost, nodeState, shortfallCopy } from '../../research/logic.ts'
import { RESEARCH_NODES, nodesInCategory } from '../../research/nodes.ts'
import type { ResearchNode, ResearchState } from '../../research/types.ts'

export function ResearchTree({
  state,
  fieldLevel,
  ratePerSec,
  focusId,
  onUnlock,
}: {
  state: ResearchState
  fieldLevel: number
  ratePerSec: number
  focusId?: string | null
  onUnlock: (id: string) => void
}) {
  const focus = focusId ? RESEARCH_NODES.find((row) => row.id === focusId) : undefined
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>(focus?.category ?? 'airfield')
  const [selectedId, setSelectedId] = useState<string>(focus?.id ?? 'airfield-1')

  const nodes = nodesInCategory(category)
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0]
  const selectedState = selected ? nodeState(state, selected, fieldLevel) : 'locked'
  const selectedCost = selected ? nodeCost(state, selected) : 0
  const needCopy = selected && selectedState === 'available' ? shortfallCopy(state.points, selectedCost, ratePerSec) : null
  const lockedCopy = selected && selectedState === 'locked' ? lockCopy(state, selected, fieldLevel) : null

  return (
    <section className="rtree" data-testid="research-tree">
      <div className="dip-tabs" role="tablist" aria-label="Growth">
        <button type="button" role="tab" className="on" aria-selected="true">
          Research tree
        </button>
      </div>
      <div className="rtree-body">
        <ul className="rtree-cats">
          {CATEGORIES.map((row) => {
            const open = fieldLevel >= row.unlockLevel
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={category === row.id ? 'on' : ''}
                  aria-pressed={category === row.id}
                  onClick={() => {
                    setCategory(row.id)
                    const first = nodesInCategory(row.id)[0]
                    if (first) setSelectedId(first.id)
                  }}
                >
                  {open ? null : <span aria-hidden="true">🔒 </span>}
                  {row.label}
                  {open ? null : <span className="muted"> · Lv {row.unlockLevel}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="rtree-canvas" data-testid="research-nodes">
          {category === 'specs' ? (
            <SpecLanes nodes={nodes} state={state} fieldLevel={fieldLevel} selectedId={selected?.id ?? ''} onSelect={setSelectedId} />
          ) : (
            <NodeLane nodes={nodes} state={state} fieldLevel={fieldLevel} selectedId={selected?.id ?? ''} onSelect={setSelectedId} />
          )}
        </div>
        <aside className="rtree-card" data-testid="research-card">
          {selected ? (
            <>
              <h3>{selected.name}</h3>
              <p>{selected.blurb}</p>
              <p className="muted">Unlocks: {selected.unlocks}</p>
              <p className="muted" data-testid="research-node-state">
                {selectedState === 'owned' ? 'Owned' : selectedState === 'available' ? 'Available' : 'Locked'}
                {' · '}
                {selectedCost === 0 ? 'Free' : `${selectedCost} RP`}
              </p>
              {lockedCopy ? (
                <p className="muted" data-testid="research-lock">
                  {lockedCopy}
                </p>
              ) : null}
              {selectedState === 'owned' ? null : (
                <button
                  type="button"
                  className="wide"
                  data-testid="research-unlock"
                  disabled={selectedState !== 'available' || state.points < selectedCost}
                  onClick={() => onUnlock(selected.id)}
                >
                  {selectedState === 'locked'
                    ? 'Locked'
                    : needCopy
                      ? needCopy
                      : selectedCost === 0
                        ? 'Unlock'
                        : `Unlock · ${selectedCost} RP`}
                </button>
              )}
            </>
          ) : null}
        </aside>
      </div>
      <footer className="rtree-foot" data-testid="research-tree-points">
        Available research points: {state.points}
        {needCopy ? ` · ${needCopy}` : ''}
      </footer>
    </section>
  )
}

function NodeLane({
  nodes,
  state,
  fieldLevel,
  selectedId,
  onSelect,
}: {
  nodes: ResearchNode[]
  state: ResearchState
  fieldLevel: number
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="rtree-lane">
      {nodes.map((node, index) => (
        <span key={node.id} className="rtree-step">
          {index > 0 ? <i className="rtree-line" /> : null}
          <NodeButton node={node} state={state} fieldLevel={fieldLevel} selected={node.id === selectedId} onSelect={onSelect} />
        </span>
      ))}
    </div>
  )
}

function SpecLanes({
  nodes,
  state,
  fieldLevel,
  selectedId,
  onSelect,
}: {
  nodes: ResearchNode[]
  state: ResearchState
  fieldLevel: number
  selectedId: string
  onSelect: (id: string) => void
}) {
  const charter = nodes.find((node) => node.id === 'spec-charter')
  return (
    <div className="rtree-specs">
      {charter ? (
        <NodeButton node={charter} state={state} fieldLevel={fieldLevel} selected={charter.id === selectedId} onSelect={onSelect} />
      ) : null}
      {SPEC_BRANCHES.map((branch) => (
        <div key={branch.id} className="rtree-lane">
          <span className="rtree-branch">{branch.label}</span>
          {nodes
            .filter((node) => node.branch === branch.id)
            .map((node, index) => (
              <span key={node.id} className="rtree-step">
                {index > 0 ? <i className="rtree-line" /> : null}
                <NodeButton node={node} state={state} fieldLevel={fieldLevel} selected={node.id === selectedId} onSelect={onSelect} />
              </span>
            ))}
        </div>
      ))}
    </div>
  )
}

function NodeButton({
  node,
  state,
  fieldLevel,
  selected,
  onSelect,
}: {
  node: ResearchNode
  state: ResearchState
  fieldLevel: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const status = nodeState(state, node, fieldLevel)
  const cost = nodeCost(state, node)
  return (
    <button
      type="button"
      className={`rtree-node is-${status}${selected ? ' is-selected' : ''}`}
      id={`research-node-${node.id}`}
      data-testid={`research-node-${node.id}`}
      data-state={status}
      onClick={() => onSelect(node.id)}
    >
      {status === 'locked' ? (
        <span className="rtree-lock" aria-label="Locked">
          🔒
        </span>
      ) : (
        <span className="rtree-ring" />
      )}
      <span className="rtree-name">{node.name}</span>
      <span className={`rtree-cost${status === 'available' ? ' is-open' : ''}`}>{cost === 0 ? 'Free' : cost}</span>
    </button>
  )
}
