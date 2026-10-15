import { useSyncExternalStore } from 'react'
import type { Game } from '../../game/sim.ts'
import { ALLOCATOR_WAIT, HUB_TIER_LABEL } from '../../hubprogress/config.ts'
import { hubProgressRows, hubShowcase } from '../../hubprogress/present.ts'
import { hubProfileSnapshot, openHubProfile, subscribeHubProfile } from './session.ts'

function mark(status: string): string {
  return status === 'ok' ? '✓' : '·'
}

export function HubProfile({ game, id }: { game: Game; id: string }) {
  const view = game.hubCarrierView(id)
  const list = view.checklist
  const showcase = hubShowcase(list)
  const nextLabel = list.next ? HUB_TIER_LABEL[list.next] : null
  const width = list.total > 0 ? Math.round((list.met / list.total) * 100) : 0

  return (
    <section className="hub-profile" data-testid="hub-profile">
      <p className="hub-tier" data-testid="hub-tier">
        Hub tier {HUB_TIER_LABEL[list.current]}
        {nextLabel ? ` → ${nextLabel}` : ''}
      </p>
      <p className="muted" data-testid="hub-progress-count">
        {list.met} of {list.total} lines
      </p>
      <div className="rel-meter" aria-hidden>
        <span style={{ width: `${width}%` }} />
      </div>
      <ul className="hub-lines">
        {list.lines.map((line) => (
          <li key={line.id} data-status={line.status} data-testid={`hub-line-${line.id}`}>
            <span aria-hidden>{mark(line.status)}</span>
            <span>{line.label}</span>
            <span className="muted">{line.detail}</span>
          </li>
        ))}
      </ul>
      {nextLabel ? (
        <div data-testid="hub-rewards">
          <p>If you accept {nextLabel}</p>
          <ul className="hub-lines">
            {list.rewards.map((text) => (
              <li key={text}>
                <span aria-hidden>·</span>
                <span>{text}</span>
              </li>
            ))}
            {list.perk ? (
              <li>
                <span aria-hidden>·</span>
                <span>{list.perk}</span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <p className="muted" data-testid="hub-showcase">
        Now: {showcase.now}
      </p>
      <p className="muted" data-testid="hub-showcase-next">
        Next: {showcase.next}
      </p>
      <div className="hub-actions">
        <button type="button" data-testid="hub-dedicate-desk" disabled title={ALLOCATOR_WAIT}>
          Dedicate a desk
        </button>
        <button type="button" data-testid="hub-dedicate-lounge" disabled>
          Dedicate a lounge
        </button>
        <button type="button" data-testid="hub-dedicate-gate" disabled>
          Dedicate a gate
        </button>
        <button type="button" data-testid="hub-dedicate-hangar" disabled>
          Dedicate a hangar bay
        </button>
      </div>
    </section>
  )
}

/** Short hub block under the relations meter. The checklist opens in place. */
export function HubSection({ game, id }: { game: Game; id: string }) {
  const openId = useSyncExternalStore(subscribeHubProfile, hubProfileSnapshot, hubProfileSnapshot)
  const list = game.hubChecklistFor(id)
  const nextLabel = list.next ? HUB_TIER_LABEL[list.next] : null
  return (
    <div data-testid="hub-section">
      <p>
        Hub tier {HUB_TIER_LABEL[list.current]}
        {nextLabel ? ` → ${nextLabel}` : ''}
        {' · '}
        {list.met} of {list.total} lines
      </p>
      <button type="button" data-testid={`hub-open-${id}`} onClick={() => openHubProfile(id)}>
        {openId === id ? 'Hide checklist' : 'Checklist'}
      </button>
      {openId === id ? <HubProfile game={game} id={id} /> : null}
    </div>
  )
}

/** Airlines → Hub. One row per signed carrier. Primary hub is pinned first. */
export function HubProgress({ game }: { game: Game }) {
  const openId = useSyncExternalStore(subscribeHubProfile, hubProfileSnapshot, hubProfileSnapshot)
  const rows = hubProgressRows(game.hubCarrierViews())
  const holder = rows.find((row) => row.primary)
  return (
    <section data-testid="hub-progress">
      <h3>Hub progress</h3>
      {rows.length === 0 ? (
        <p className="muted">No signed carriers yet. A kept contract is what starts the climb.</p>
      ) : (
        <ul className="hub-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="dip-card" data-testid={`hub-row-${row.id}`} onClick={() => openHubProfile(row.id)}>
                <span className="dip-band">{row.tierLabel}</span>
                <span className="dip-name">{row.name}</span>
                <span className="dip-trend">
                  {row.met}/{row.total}
                </span>
                <span className="dip-band">{row.note}</span>
              </button>
              {openId === row.id ? <HubProfile game={game} id={row.id} /> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{holder ? `One Primary hub. ${holder.name} holds it.` : 'One Primary hub.'}</p>
    </section>
  )
}
