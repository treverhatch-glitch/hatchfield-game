import { useSyncExternalStore } from 'react'
import { AIRFRAMES } from '../../game/airframes.ts'
import { money } from '../../game/catalog.ts'
import type { Flight } from '../../game/types.ts'
import type { Game } from '../../game/sim.ts'
import {
  FLIGHT_CARD_BOTTOM,
  FLIGHT_CARD_WIDTH,
  closeFlightCard,
  flightCardFlightId,
  flightCardSnapshot,
  flightConnectionSummary,
  flightDelaySummary,
  labelPhase,
  serviceProgress,
  subscribeFlightCard,
} from './flightCard.ts'
import { liveRevWhen, subscribeLiveWhen } from './live.ts'

function titleColor(flight: Flight, airlineColor: string): string {
  if (flight.kind === 'military') return '#8a9a6a'
  if (flight.kind === 'air_ambulance' || flight.kind === 'helo_med') return '#b33a2a'
  if (flight.kind === 'freighter') return '#c97816'
  return airlineColor
}

function namedAirline(flight: Flight): boolean {
  return (
    flight.kind !== 'military' &&
    flight.kind !== 'helo_med' &&
    flight.kind !== 'air_ambulance' &&
    flight.kind !== 'helo_exec'
  )
}

/** Status lines for one flight. Shared by the apron card and Operations → Planner. */
export function FlightCard({ game, flight }: { game: Game; flight: Flight }) {
  const airline = game.airline(flight.airline)
  const grade = game.liveTurnGrade(flight)
  const hold = game.cartServiceHold(flight.id)
  const services = serviceProgress(flight, hold)
  const cartCause = game.cartCause(flight.id)
  const cartHint = cartCause ? game.cartDepotHint() : ''
  const delay = flightDelaySummary(flight, game.schedule)
  const connections = flightConnectionSummary(flight, game.hallGuests, game.flights)
  const aircraft = flight.airframeName || game.aircraftLabel(flight.kind)
  const stand = (flight.craft ?? 'jet') === 'jet' ? game.gateLabel(flight.stand) : 'Helipad'
  const airlineName = flight.ga ? 'Independent GA' : airline.name
  const checkin = game.checkinLine(flight)
  return (
    <div className="flight">
      <p className="fn" style={{ color: titleColor(flight, airline.color) }}>
        {game.roleLabel(flight.kind)}
        {namedAirline(flight) ? ` · ${airline.name}` : ''} {flight.flightNo}
      </p>
      <dl className="flight-facts">
        <div>
          <dt>Airline</dt>
          <dd data-testid="flight-airline">{airlineName}</dd>
        </div>
        <div>
          <dt>Aircraft</dt>
          <dd data-testid="flight-aircraft">{aircraft}</dd>
        </div>
        <div>
          <dt>Stand</dt>
          <dd data-testid="flight-stand">{stand}</dd>
        </div>
        <div>
          <dt>Delay</dt>
          <dd data-testid="flight-delay">{delay}</dd>
        </div>
        <div>
          <dt>Connections</dt>
          <dd data-testid="flight-connections">{connections}</dd>
        </div>
        {checkin ? (
          <div>
            <dt>Check-in</dt>
            <dd data-testid="flight-checkin">{checkin}</dd>
          </div>
        ) : null}
      </dl>
      {grade ? (
        <p className="phase" data-testid="turn-grade">
          Turnaround {grade.grade}
          {grade.note ? ` — ${grade.note}` : ''}
        </p>
      ) : null}
      <p className="phase" data-testid="flight-phase">
        {aircraft} · {labelPhase(flight.phase, flight.craft)}
        {flight.pax > 0 ? ` · ${flight.pax} pax` : flight.cargo ? ' · freight' : ''}
        {(flight.craft ?? 'jet') === 'jet' ? ` · ${stand}` : ' · helipad'}
        {flight.ga && flight.phase === 'parked'
          ? flight.parkLeaveRequestedAt && flight.parkLeaveBy
            ? ` · LEAVE WINDOW ${Math.max(0, Math.round(flight.parkLeaveBy - game.clock))}s`
            : ` · parked ${Math.round(flight.phaseTime)}s / ask ~${flight.parkStaySec ?? '?'}s`
          : ''}
      </p>
      {flight.ga && flight.phase === 'parked' ? (
        <button type="button" className="wide" onClick={() => game.releaseGa(flight.id)}>
          {flight.parkLeaveRequestedAt ? 'Release (manual departure)' : 'Release early'}
        </button>
      ) : null}
      <p className="muted">
        Needs {flight.craft === 'helo' ? 'helipad' : `${AIRFRAMES[flight.airframeId]?.minRunway ?? '?'}c strip`}
        {' · '}
        size ×{(AIRFRAMES[flight.airframeId]?.scale ?? 1).toFixed(2)} · field {game.stripCapabilityLine()}
        {flight.waitingOn.deice ? ' · waiting de-ice' : flight.posted.deiced ? ' · de-iced' : ''}
      </p>
      {cartCause ? (
        <p className="phase" data-testid="flight-cart-cause">
          {cartCause}
          {cartHint ? ` · ${cartHint}` : ''}
        </p>
      ) : null}
      <ul className="flight-services" data-testid="flight-services">
        {services.map((row) => (
          <li key={row.id} data-service={row.id} data-state={row.state}>
            {row.label} · {row.detail}
          </li>
        ))}
      </ul>
      <ul className="ledger">
        {flight.ledger.length === 0 ? (
          <li>Nothing posted yet — wait until the picture earns it.</li>
        ) : (
          flight.ledger.map((row, i) => (
            <li key={i}>
              {row.label}
              <b>{money(row.amount)}</b>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

/** Right-edge inspector. Planner stays closed; dismissing does not clear the selection. */
export function ApronFlightCard({ game }: { game: Game }) {
  const snap = useSyncExternalStore(subscribeFlightCard, flightCardSnapshot, flightCardSnapshot)
  useSyncExternalStore(subscribeLiveWhen(Boolean(snap)), liveRevWhen(Boolean(snap)), () => 0)
  if (!snap || game.view !== 'apron') return null
  const id = flightCardFlightId()
  const flight = game.flights.find((row) => row.id === id && row.id === game.selectedFlight)
  if (!flight) return null
  return (
    <aside
      className="flight-card"
      data-testid="flight-card"
      style={{ width: FLIGHT_CARD_WIDTH, bottom: FLIGHT_CARD_BOTTOM }}
    >
      <header className="flight-card-head">
        <h3>Selected flight</h3>
        <button type="button" data-testid="flight-card-close" onClick={() => closeFlightCard()}>
          Close
        </button>
      </header>
      <div className="flight-card-body">
        <FlightCard game={game} flight={flight} />
      </div>
    </aside>
  )
}
