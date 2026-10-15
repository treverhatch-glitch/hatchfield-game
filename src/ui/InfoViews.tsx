import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Game } from '../game/sim.ts'
import { CLOSED_NO_STAFF_LINE } from '../servicepoints/index.ts'
import { moreInfoSpots, moreMenuSnapshot, setMoreMenu, subscribeMoreMenu } from '../info/moreMenu.ts'
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
import { CarbonInfoView } from './CarbonInfo.tsx'
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
  const more = useSyncExternalStore(subscribeMoreMenu, moreMenuSnapshot, moreMenuSnapshot)
  const [, setPulse] = useState(0)
  useEffect(() => {
    const off = game.subscribe(() => setPulse((n) => n + 1))
    return () => {
      off()
    }
  }, [game])

  useEffect(() => {
    if (!game.landsideOpen) return
    if (game.infoOpen) game.toggleInfo(game.infoOpen)
    if (mapViewSnapshot().active !== 'traffic') selectMapView('traffic')
    openMapDetail(game.landsideFocus)
  }, [game, game.landsideOpen, game.landsideFocus])

  useEffect(() => {
    if (!game.fuelOpen) return
    if (game.infoOpen) game.toggleInfo(game.infoOpen)
    if (mapViewSnapshot().active !== 'fuel') selectMapView('fuel')
    openMapDetail(null)
  }, [game, game.fuelOpen])

  if (!desktop || !game.site) return null
  const onApron = game.view !== 'hall'
  const model = onApron && session.active ? readMapView(game, session.active) : null
  const spots = moreInfoSpots(game.infoHotspots())
  const linesId = game.infoOpen

  const pick = (id: MapViewId) => {
    setMoreMenu(false)
    if (game.infoOpen) game.toggleInfo(game.infoOpen)
    const current = mapViewSnapshot().active
    if (current === 'traffic') game.closeLandside()
    if (current === 'fuel') game.closeFuelFarm()
    toggleMapView(id)
  }

  const chooseSpot = (id: string) => {
    setMoreMenu(false)
    const current = mapViewSnapshot().active
    if (mapViewSnapshot().detail) {
      closeMapDetail()
      if (current === 'traffic') game.closeLandside()
      if (current === 'fuel') game.closeFuelFarm()
    }
    game.toggleInfo(id)
  }

  return (
    <>
      {onApron ? (
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
          {spots.length > 0 ? (
            <button
              type="button"
              data-testid="info-view-more"
              className={more || (linesId != null && spots.some((spot) => spot.id === linesId)) ? 'on' : ''}
              aria-expanded={more}
              aria-haspopup="menu"
              onClick={() => setMoreMenu(!more)}
            >
              More
            </button>
          ) : null}
        </div>
        {more && spots.length > 0 ? (
          <div className="info-more" role="menu" data-testid="info-view-menu" aria-label="More info">
            {spots.map((spot) => (
              <button
                key={spot.id}
                type="button"
                role="menuitem"
                data-testid={`info-menu-${spot.id}`}
                className={linesId === spot.id ? 'on' : ''}
                onClick={() => chooseSpot(spot.id)}
              >
                {spot.label}
              </button>
            ))}
          </div>
        ) : null}
        {model ? (
          <Legend
            model={model}
            open={session.detail}
            onNumbers={() => {
              if (game.infoOpen) game.toggleInfo(game.infoOpen)
              if (session.detail) closeMapDetail()
              else openMapDetail(session.focus)
            }}
          />
        ) : null}
      </div>
      ) : null}
      {linesId ? (
        <LinesPanel game={game} id={linesId} onClose={() => game.toggleInfo(linesId)} />
      ) : model && session.detail ? (
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

function LinesPanel({ game, id, onClose }: { game: Game; id: string; onClose: () => void }) {
  const title = game.infoHotspots().find((spot) => spot.id === id)?.label ?? 'Info'
  const repair = id === 'links' ? game.linkRepairOffer() : null
  const lines = game.infoLines(id)
  const hireForPoint = lines.includes(CLOSED_NO_STAFF_LINE)
  return (
    <div className="info-detail">
      <aside className="info-panel" data-testid="info-view-panel">
        <header>
          <h2>{title}</h2>
          <button type="button" className="ghost" data-testid="info-view-close" onClick={onClose}>
            Close
          </button>
        </header>
        <ul>
          {lines.map((line) => (
            <li key={line} className="info-detail-row" data-testid="info-line">
              {line}
            </li>
          ))}
        </ul>
        {hireForPoint ? (
          <button type="button" data-testid="hire-for-point" onClick={() => game.hireDeskStaff()}>
            Hire
          </button>
        ) : null}
        {repair ? (
          <button
            type="button"
            data-testid="repair-link"
            onClick={() => game.repairLink(repair.mode)}
          >
            {repair.label}
          </button>
        ) : null}
        {id === 'carbon' ? (
          <CarbonInfoView
            view={game.carbonView()}
            onStart={() => game.startGreenPioneer()}
            onOffset={() => game.buyCarbonOffsets()}
          />
        ) : null}
        {id.startsWith('tower:') && game.towerIIIUpgradeOffer() ? (
          <button
            type="button"
            data-testid="upgrade-tower-iii"
            disabled={!game.towerIIIUpgradeOffer()!.ok}
            onClick={() => game.buyTowerIII()}
          >
            {game.towerIIIUpgradeOffer()!.ok
              ? `Build Tower III $${game.towerIIIUpgradeOffer()!.cost.toLocaleString('en-US')}`
              : 'Tower III unavailable'}
          </button>
        ) : null}
      </aside>
    </div>
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

