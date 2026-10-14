import { useState } from 'react'
import type { BuildingCard } from '../buildinginfo/card.ts'

const SECTIONS = [
  ['throughput', 'Throughput'],
  ['bays', 'Bays'],
  ['upkeep', 'Upkeep'],
  ['staff', 'Staff'],
] as const

type SectionId = (typeof SECTIONS)[number][0]

/**
 * Left dock for one building. Counts stay behind the subsection until it is
 * opened. Bottleneck icons carry a hover why. This is not an info-view overlay.
 */
export function BuildingPanelView({
  card,
  open,
  onToggle,
  onClose,
}: {
  card: BuildingCard
  open: ReadonlySet<SectionId>
  onToggle: (id: SectionId) => void
  onClose: () => void
}) {
  const figures: Record<SectionId, string> = {
    throughput: card.throughputText,
    bays: card.baysText,
    upkeep: card.upkeepText,
    staff: card.staffText,
  }
  return (
    <aside className="building-panel" data-testid="building-panel" data-status={card.status}>
      <header className="building-panel-head">
        <div>
          <h2>{card.name}</h2>
          <p className="building-status" data-testid="building-status">
            {card.statusLabel}
          </p>
        </div>
        <button type="button" className="building-close" data-testid="building-close" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="building-why" data-testid="building-why">
        {card.why}
      </p>
      {card.icons.length > 0 ? (
        <div className="building-icons" data-testid="building-icons">
          {card.icons.map((icon) => (
            <button
              key={icon.id}
              type="button"
              className="building-icon"
              data-testid={`bottleneck-icon-${icon.id}`}
              title={icon.why}
              aria-label={icon.why}
            >
              <span className="building-icon-badge">{icon.badge}</span>
              <span className="building-tip" role="tooltip">
                {icon.why}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {SECTIONS.map(([id, label]) => {
        const shown = open.has(id)
        return (
          <section key={id} className="building-section" data-open={shown ? 'true' : 'false'}>
            <button
              type="button"
              data-testid={`building-section-${id}`}
              aria-expanded={shown}
              onClick={() => onToggle(id)}
            >
              {label}
            </button>
            {shown ? (
              <div className="building-figure" data-testid={`building-figure-${id}`}>
                <p>{figures[id]}</p>
                {id === 'bays'
                  ? card.bays.map((bay) => (
                      <p key={bay.index} data-testid={`building-bay-${bay.index}`}>
                        {bay.line}
                      </p>
                    ))
                  : null}
              </div>
            ) : null}
          </section>
        )
      })}
    </aside>
  )
}

export function BuildingPanel({ card, onClose }: { card: BuildingCard | null; onClose: () => void }) {
  const [open, setOpen] = useState<ReadonlySet<SectionId>>(new Set())
  const [forId, setForId] = useState(card?.id ?? '')
  if ((card?.id ?? '') !== forId) {
    setForId(card?.id ?? '')
    setOpen(new Set())
  }
  if (!card) return null
  return (
    <BuildingPanelView
      card={card}
      open={open}
      onToggle={(id) =>
        setOpen((cur) => {
          const next = new Set(cur)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
      onClose={onClose}
    />
  )
}
