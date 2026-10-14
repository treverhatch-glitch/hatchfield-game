import { useState } from 'react'
import { money } from '../game/catalog.ts'
import type { Game } from '../game/sim.ts'

type MenuId = 'flow' | 'bags' | 'stranded' | 'history'

function pct(n: number): string {
  return `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`
}

/**
 * Connections info view: transfer volume, MCT and misses, misconnected bags,
 * stranded passengers. Alerts pan to the problem.
 */
export function ConnectionsPanel({ game }: { game: Game }) {
  const [open, setOpen] = useState<MenuId | null>('flow')
  const view = game.connectionsPanel()
  const toggle = (id: MenuId) => setOpen((cur) => (cur === id ? null : id))
  const t = view.today
  const made = t.made + t.missed > 0 ? t.made / (t.made + t.missed) : 1
  const yesterday = view.history.at(-1)

  return (
    <section data-testid="connections-panel">
      <h3>Connections</h3>
      <p className="muted" data-testid="connections-headline">
        MCT {view.mct.total} min · {t.transfers} transfers today · {pct(made)} made ·{' '}
        {t.misconnectedBags} bags misconnected
      </p>
      {yesterday ? (
        <p className="muted" data-testid="connections-yesterday">
          Yesterday {yesterday.transfers} transfers · {yesterday.missed} missed · {yesterday.misconnectedBags} bags
          misconnected · {yesterday.stranded} stranded
        </p>
      ) : null}
      {view.alerts.length ? (
        <ul className="airlines" data-testid="connections-alerts">
          {view.alerts.slice(0, 4).map((alert) => (
            <li key={alert.id}>
              <span>{alert.text}</span>
              <button type="button" onClick={() => game.focusConnections(alert.cell)}>
                Show
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="staff-subs">
        <button type="button" aria-expanded={open === 'flow'} onClick={() => toggle('flow')}>
          Transfer flow
          <span className="muted">
            {t.missed} missed · {t.missedMct} under MCT
          </span>
        </button>
        {open === 'flow' ? (
          <div className="staff-detail" data-testid="connections-flow">
            <p>
              Published MCT {view.mct.total} min = facility {view.mct.base} min floor, walk{' '}
              {view.mct.walkMinutes.toFixed(1)} min, screening {view.mct.screenMinutes} min
            </p>
            <p className="muted">
              {view.transferLane
                ? 'Transfer security lane open airside.'
                : 'No transfer lane: re-screened transfers go out through arrivals (Transfer Centre adds one).'}
            </p>
            <p>
              {t.screened} re-screened · {t.landsideRecheck} via landside · {t.layoverShort} short layovers ·{' '}
              {t.layoverLong} long/overnight
            </p>
            {view.hubAirlines.length ? (
              <ul className="airlines">
                {view.hubAirlines.map((a) => (
                  <li key={a.id}>
                    <b>{a.name}</b>
                    <span className="muted">
                      {pct(a.share)} transfer · {pct(1 - a.share)} O&amp;D · {pct(a.screen)} re-screened
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No hub carrier signed yet.</p>
            )}
          </div>
        ) : null}

        <button type="button" aria-expanded={open === 'bags'} onClick={() => toggle('bags')}>
          Transfer bags
          <span className="muted">{pct(view.misconnectRate)} misconnect</span>
        </button>
        {open === 'bags' ? (
          <div className="staff-detail" data-testid="connections-bags">
            <p>
              Sort {view.sortLoad}/{Math.round(view.sortCapacity)} bags/h · misconnect {pct(view.misconnectRate)}
            </p>
            <p>
              {t.transferBags} transfer bags today · {t.misconnectedBags} misconnected
            </p>
          </div>
        ) : null}

        <button type="button" aria-expanded={open === 'stranded'} onClick={() => toggle('stranded')}>
          Stranded
          <span className="muted">
            {t.stranded} today · {t.overnight} overnight
          </span>
        </button>
        {open === 'stranded' ? (
          <div className="staff-detail" data-testid="connections-stranded">
            <p>
              {t.rebooked} rebooked same day · {t.overnight} hotel vouchers
            </p>
            <p className="muted">
              Airport paid {money(t.voucherAirport)} · airlines paid {money(t.voucherAirline)}
            </p>
          </div>
        ) : null}

        <button type="button" aria-expanded={open === 'history'} onClick={() => toggle('history')}>
          Last days
          <span className="muted">{view.history.length} closed</span>
        </button>
        {open === 'history' ? (
          <ul className="airlines" data-testid="connections-history">
            {view.history
              .slice(-7)
              .reverse()
              .map((d) => (
                <li key={d.day}>
                  <b>Day {d.day + 1}</b>
                  <span className="muted">
                    {d.transfers} transfers · {d.missed} missed · {d.misconnectedBags} bags · {d.stranded} stranded
                  </span>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
