import type { Game } from '../game/sim.ts'
import { openCurbFlow, pressureColor, type SegmentRead } from '../landside/index.ts'
import { LiveText } from './LiveText.tsx'

function pct(n: number): string {
  if (!Number.isFinite(n)) return '0%'
  return `${Math.round(n * 100)}%`
}

function one(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}

function segmentLine(segment: SegmentRead): string {
  const name = segment.kind === 'curb' ? 'Curb' : 'Road'
  return `${name} ${segment.c},${segment.r} · ${segment.lanes} lane${segment.lanes === 1 ? '' : 's'} · capacity ${one(segment.capacity)} · flow ${one(segment.flowPerMin)}/min`
}

/**
 * Side panel for curb capacity and flow. Opens from the Curb button or a
 * click on a road, curb, lot, or bus bay. It sits off the approach.
 */
export function LandsideOverlay({ game }: { game: Game }) {
  if (!game.site || game.view === 'hall') return null
  const open = game.landsideOpen
  const view = game.landsideView()
  const focus = game.landsideFocus
  const rows = [...view.segments].sort((a, b) => {
    if (focus && a.id === focus) return -1
    if (focus && b.id === focus) return 1
    if (a.kind !== b.kind) return a.kind === 'curb' ? -1 : 1
    return b.ratio - a.ratio
  })
  return (
    <div className="landside-dock">
      <button
        type="button"
        className={open ? 'on' : ''}
        data-testid="landside-flow-toggle"
        aria-expanded={open}
        onClick={() => openCurbFlow(game)}
      >
        Curb flow
      </button>
      {open ? (
        <aside className="landside-panel" data-testid="landside-flow">
          <header>
            <h2>Curb flow</h2>
            <button type="button" className="ghost" data-testid="landside-flow-close" onClick={() => game.closeLandside()}>
              Close
            </button>
          </header>
          <p className="landside-summary" data-testid="landside-summary">
            <LiveText
              testId="landside-summary-live"
              read={() => {
                const live = game.landsideView()
                const missed = game.missedCheckIns
                const withheld = Math.round(missed * game.fees.paxFee)
                return `Arrivals ${one(live.arrivalsPerMin)}/min · road ${one(live.roadFlowPerMin)}/${one(live.laneFlowPerMin)} per min · curb ${one(live.curbBusy)}/${live.curbStalls} · queue ${one(live.queue)} · ${live.delaySec > 1 ? `${Math.round(live.delaySec)}s late` : 'on time'} · missed check-ins ${missed}${missed > 0 ? ` · $${withheld.toLocaleString('en-US')} passenger fees not collected` : ''}`
              }}
            />
          </p>
          <dl className="landside-modes">
            <div>
              <dt>Car</dt>
              <dd>{one(view.modes.car)}/min</dd>
            </div>
            <div>
              <dt>Taxi</dt>
              <dd>{one(view.modes.taxi)}/min</dd>
            </div>
            <div>
              <dt>Bus</dt>
              <dd>{view.busBays ? `${one(view.modes.bus)}/min` : 'no bay'}</dd>
            </div>
            <div>
              <dt>Rail</dt>
              <dd>{view.rail ? `${one(view.modes.rail)}/min` : 'later'}</dd>
            </div>
          </dl>
          <p className="landside-meta">
            {view.lanes} lane{view.lanes === 1 ? '' : 's'} · {view.parkSpaces} parking stalls · pressure{' '}
            {pct(view.pressure)}
          </p>
          <ul className="landside-fixes">
            {view.fixes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <ul className="landside-segments">
            {rows.slice(0, 8).map((segment) => (
              <li key={segment.id} data-focused={segment.id === focus ? 'true' : 'false'}>
                <button type="button" onClick={() => game.openLandside({ c: segment.c, r: segment.r })}>
                  <span className="swatch" style={{ background: pressureColor(segment.ratio) }} />
                  <span>{segmentLine(segment)}</span>
                </button>
                <span className="bar">
                  <span style={{ width: `${Math.max(4, Math.min(100, segment.ratio * 100))}%`, background: pressureColor(segment.ratio) }} />
                </span>
              </li>
            ))}
            {rows.length === 0 ? <li className="empty">No public road yet.</li> : null}
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
