import { useEffect, useSyncExternalStore } from 'react'
import type { Game } from '../game/sim.ts'
import { readMapView } from '../info/read.ts'
import {
  closeMapDetail,
  mapViewSnapshot,
  openMapDetail,
  selectMapView,
  subscribeMapView,
  toggleMapView,
} from '../info/session.ts'
import { MAP_VIEW_LABEL, MAP_VIEWS, type InfoViewModel, type MapViewId } from '../info/types.ts'
import { FuelPanel } from './FuelOverlay.tsx'
import { LandsidePanel } from './LandsideOverlay.tsx'
import { useDesktop } from './phone/useDesktop.ts'
import './infoViews.css'

/**
 * Cities-style info views. One overlay at a time. Esc closes it.
 * The bar only reads snapshots; open and shut live in the view session.
 */
export function InfoViews({ game }: { game: Game }) {
  const desktop = useDesktop()
  const session = useSyncExternalStore(subscribeMapView, mapViewSnapshot, mapViewSnapshot)

  useEffect(() => {
    if (!game.landsideOpen) return
    if (mapViewSnapshot().active !== 'traffic') selectMapView('traffic')
    openMapDetail(game.landsideFocus)
  }, [game, game.landsideOpen, game.landsideFocus])

  useEffect(() => {
    if (!game.fuelOpen) return
    if (mapViewSnapshot().active !== 'fuel') selectMapView('fuel')
    openMapDetail(null)
  }, [game, game.fuelOpen])

  if (!desktop || !game.site || game.view === 'hall') return null
  const model = session.active ? readMapView(game, session.active) : null

  const pick = (id: MapViewId) => {
    const current = mapViewSnapshot().active
    if (current === 'traffic') game.closeLandside()
    if (current === 'fuel') game.closeFuelFarm()
    toggleMapView(id)
  }

  return (
    <>
      <div className="info-views" data-testid="info-view-bar">
        <div className="info-view-row" role="toolbar" aria-label="Info views">
          {MAP_VIEWS.map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`info-view-${id}`}
              className={session.active === id ? 'on' : ''}
              aria-pressed={session.active === id}
              onClick={() => pick(id)}
            >
              {MAP_VIEW_LABEL[id]}
            </button>
          ))}
        </div>
        {model ? (
          <Legend
            model={model}
            open={session.detail}
            onNumbers={() => (session.detail ? closeMapDetail() : openMapDetail(session.focus))}
          />
        ) : null}
      </div>
      {model && session.detail ? (
        <div className="info-detail">
          {session.active === 'traffic' ? (
            <LandsidePanel
              game={game}
              focus={session.focus ?? game.landsideFocus}
              onClose={() => {
                closeMapDetail()
                game.closeLandside()
              }}
              onSelect={(id) => openMapDetail(id)}
            />
          ) : null}
          {session.active === 'fuel' ? (
            <FuelPanel
              game={game}
              onClose={() => {
                closeMapDetail()
                game.closeFuelFarm()
              }}
            />
          ) : null}
          {session.active !== 'traffic' && session.active !== 'fuel' ? (
            <DetailPanel model={model} onClose={() => closeMapDetail()} />
          ) : null}
        </div>
      ) : null}
      <span data-testid="info-view-active" hidden>
        {session.active ?? ''}
      </span>
    </>
  )
}

function Legend({ model, open, onNumbers }: { model: InfoViewModel; open: boolean; onNumbers: () => void }) {
  return (
    <aside className="info-legend" data-testid="info-view-legend">
      <header>
        <h2>{model.title}</h2>
        <button type="button" className="ghost" data-testid="info-view-numbers" aria-expanded={open} onClick={onNumbers}>
          Numbers
        </button>
      </header>
      <div className="info-swatches">
        {model.legend.map((stop) => (
          <span key={stop.label}>
            <i style={{ background: stop.color }} />
            {stop.label}
          </span>
        ))}
      </div>
      <ul>
        {model.scores.map((score) => (
          <li key={score.id} className="info-score" data-testid={`info-score-${score.id}`} title={score.why}>
            <span className="k">{score.label}</span>
            <span className="v">{score.value}</span>
            <span className="why" role="tooltip">
              {score.why}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function DetailPanel({ model, onClose }: { model: InfoViewModel; onClose: () => void }) {
  return (
    <aside className="info-panel" data-testid="info-view-panel">
      <header>
        <h2>{model.title}</h2>
        <button type="button" className="ghost" data-testid="info-view-close" onClick={onClose}>
          Close
        </button>
      </header>
      <ul>
        {model.scores.map((row) => (
          <li key={`score-${row.id}`} className="info-detail-row" data-testid={`info-detail-${row.id}`} title={row.why}>
            <span className="k">{row.label}</span>
            <span className="v">{row.value}</span>
            <span className="why" role="tooltip">
              {row.why}
            </span>
          </li>
        ))}
        {model.details.map((row) => (
          <li key={row.id} className="info-detail-row" data-testid={`info-detail-${row.id}`} title={row.why}>
            <span className="k">{row.label}</span>
            <span className="v">{row.value}</span>
            <span className="why" role="tooltip">
              {row.why}
            </span>
          </li>
        ))}
        {model.scores.length + model.details.length === 0 ? <li className="empty">Nothing on the field for this view yet.</li> : null}
      </ul>
      {model.fixes.length > 0 ? (
        <ul className="info-fixes">
          {model.fixes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  )
}

