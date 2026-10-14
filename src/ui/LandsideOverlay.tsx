import type { Game } from '../game/sim.ts'
import { segmentWhy } from '../info/model.ts'
import { pressureColor, type SegmentRead } from '../landside/index.ts'
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

const MODE_WHY = {
  car: 'Inputs: arrivals per minute times the car share of the curb split.',
  taxi: 'Inputs: arrivals per minute times the taxi share of the curb split.',
  bus: 'Inputs: arrivals per minute times the bus share, or no bay when none is built.',
  rail: 'Inputs: arrivals per minute times the rail share, once a station is open.',
} as const

/**
 * Click-open numbers for the Traffic info view.
 * The info-view bar owns the button. This panel only reads the landside snapshot.
 */
export function LandsidePanel({
  game,
  focus,
  onClose,
  onSelect,
}: {
  game: Game
  focus: string | null
  onClose: () => void
  onSelect: (id: string) => void
}) {
  if (!game.site || game.view === 'hall') return null
  const view = game.landsideView()
  const rows = [...view.segments].sort((a, b) => {
    if (focus && a.id === focus) return -1
    if (focus && b.id === focus) return 1
    if (a.kind !== b.kind) return a.kind === 'curb' ? -1 : 1
    return b.ratio - a.ratio
  })
  return (
    <aside className="landside-panel" data-testid="landside-flow">
      <header>
        <h2>Traffic</h2>
        <button type="button" className="ghost" data-testid="landside-flow-close" onClick={onClose}>
          Close
        </button>
      </header>
      <p
        className="landside-summary"
        data-testid="landside-summary"
        title="Inputs: arrivals per minute, road flow against lane capacity, curb stalls in use, the vehicle queue, delay past free-flow, and missed check-ins."
      >
        <LiveText
          testId="landside-summary-live"
          read={() => {
            const live = game.landsideView()
            const missed = game.missedCheckIns
            const withheld = Math.round(missed * game.fees.paxFee)
            return `Arrivals ${one(live.arrivalsPerMin)}/min · road ${one(live.roadFlowPerMin)}/${one(live.laneFlowPerMin)} per min · curb load ${one(live.curbBusy)}/${live.curbStalls} · queue ${one(live.queue)} · ${live.delaySec > 1 ? `${Math.round(live.delaySec)}s late` : 'on time'} · missed check-ins ${missed}${missed > 0 ? ` · $${withheld.toLocaleString('en-US')} passenger fees not collected` : ''}`
          }}
        />
      </p>
      <dl className="landside-modes">
        <div title={MODE_WHY.car}>
          <dt>Car</dt>
          <dd>{one(view.modes.car)}/min</dd>
        </div>
        <div title={MODE_WHY.taxi}>
          <dt>Taxi</dt>
          <dd>{one(view.modes.taxi)}/min</dd>
        </div>
        <div title={MODE_WHY.bus}>
          <dt>Bus</dt>
          <dd>{view.busBays ? `${one(view.modes.bus)}/min` : 'no bay'}</dd>
        </div>
        <div title={MODE_WHY.rail}>
          <dt>Rail</dt>
          <dd>{view.rail ? `${one(view.modes.rail)}/min` : 'later'}</dd>
        </div>
      </dl>
      <p
        className="landside-meta"
        title="Inputs: approach lanes, bus bays, curb lanes, taxi ranks, parking stalls, and pressure (the tighter of the lane and the curb)."
      >
        {view.lanes} lane{view.lanes === 1 ? '' : 's'} · {view.busBays} bus bay{view.busBays === 1 ? '' : 's'} ·{' '}
        {view.curbLanes} curb lane{view.curbLanes === 1 ? '' : 's'} · {view.taxiRanks} taxi rank
        {view.taxiRanks === 1 ? '' : 's'} · {view.parkSpaces} parking stalls · pressure {pct(view.pressure)}
      </p>
      <ul className="landside-fixes">
        {view.fixes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ul className="landside-segments">
        {rows.slice(0, 8).map((segment) => (
          <li key={segment.id} data-focused={segment.id === focus ? 'true' : 'false'}>
            <button type="button" title={segmentWhy(segment)} onClick={() => onSelect(segment.id)}>
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
  )
}
