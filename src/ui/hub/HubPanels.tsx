import { useSyncExternalStore } from 'react'
import type { Game } from '../../game/sim.ts'
import { HUB_TIER_LABEL } from '../../hubprogress/config.ts'
import { hubProgressRows, hubShowcase } from '../../hubprogress/present.ts'
import {
  closeHubAssign,
  hubAssignSnapshot,
  hubProfileSnapshot,
  openHubAssign,
  openHubProfile,
  subscribeHubProfile,
} from './session.ts'

function mark(status: string): string {
  return status === 'ok' ? '✓' : '·'
}

export function HubProfile({ game, id }: { game: Game; id: string }) {
  const view = game.hubCarrierView(id)
  const list = view.checklist
  const showcase = hubShowcase(list)
  const anger = game.hubAngerPreview(id)
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
        <button type="button" data-testid="hub-dedicate-desk" onClick={() => game.dedicateDesk(id)}>
          Dedicate a desk
        </button>
        <button type="button" data-testid="hub-open-assign" onClick={() => openHubAssign(id)}>
          Assign
        </button>
        {list.next === 'base' || list.next === 'hub' || list.next === 'primary' ? (
          <>
            <p className="hub-anger" data-testid="hub-anger">
              {anger.anger || 'No signed rival is angry about this step.'}
            </p>
            {anger.spared ? <p className="muted">{anger.spared}</p> : null}
          </>
        ) : null}
        {game.hubVehicleChoices(id).map((choice) => (
          <span key={choice.role}>
            <button
              type="button"
              data-testid={`hub-dedicate-${choice.role}`}
              disabled={choice.blocked != null}
              title={choice.blocked ?? undefined}
              onClick={() => game.dedicateHubVehicle(id, choice.role)}
            >
              {choice.label}
            </button>
            {choice.held.map((held) => (
              <button key={held.id} type="button" data-testid={`hub-release-${choice.role}`} onClick={() => game.releaseHubVehicle(id, held.id)}>
                {held.label}
              </button>
            ))}
          </span>
        ))}
        {game.hubFacilityChoices(id).map((choice) => (
          <span key={choice.kind}>
            <button
              type="button"
              data-testid={`hub-dedicate-${choice.kind}`}
              disabled={choice.blocked != null}
              title={choice.blocked ?? undefined}
              onClick={() => game.dedicateHubFacility(id, choice.kind)}
            >
              {choice.label}
            </button>
            {choice.held.map((held) => (
              <button
                key={held.id}
                type="button"
                data-testid={`hub-release-${choice.kind}`}
                onClick={() => game.releaseHubLease(id, held.id)}
              >
                {held.label}
              </button>
            ))}
          </span>
        ))}
      </div>
      {game.hubLeaseWarningText(id) ? (
        <p className="muted" data-testid="hub-tier-warning">
          {game.hubLeaseWarningText(id)}
        </p>
      ) : null}
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

/** Left side panel. Common, Preferred, and Dedicated stay on the one desk list. */
export function HubAssign({ game }: { game: Game }) {
  const airlineId = useSyncExternalStore(subscribeHubProfile, hubAssignSnapshot, hubAssignSnapshot)
  if (!airlineId) return null
  const name = game.airline(airlineId).name
  const rows = game.hubDeskRows(airlineId)
  return (
    <aside className="hub-assign" data-testid="hub-assign">
      <div className="panel-head">
        <h2>Assign · {name}</h2>
        <button type="button" className="ghost" data-testid="hub-assign-close" onClick={() => closeHubAssign()}>
          Close
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No check-in desk is built. A kiosk cannot take a name.</p>
      ) : (
        <ul className="hub-lines">
          {rows.map((row) => (
            <li key={row.deskId} data-testid={`hub-desk-${row.deskId}`}>
              <span>{row.staffed ? 'Staffed' : 'Dark'}</span>
              <span>{row.label}</span>
              <span className="hub-assign-modes">
                {(['common', 'preferred', 'dedicated'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={row.mode === mode ? 'on' : ''}
                    data-testid={`hub-mode-${row.deskId}-${mode}`}
                    onClick={() => game.leaseDesk(airlineId, row.deskId, mode)}
                  >
                    {mode === 'common' ? 'Common' : mode === 'preferred' ? 'Preferred' : 'Dedicated'}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
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
