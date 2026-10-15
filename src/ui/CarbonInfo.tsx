import { offsetCost, type CarbonView } from '../sustainability/carbon.ts'

/** Carbon book and Green Pioneer controls. Lives in the info view, not a modal. */
export function CarbonInfoView({
  view,
  onStart,
  onOffset,
}: {
  view: CarbonView
  onStart(): void
  onOffset(): void
}) {
  const flights = view.currentFlights.length ? view.currentFlights : (view.latestDay?.flights ?? [])
  const buildings = view.buildings
  const goal = view.greenPioneer
  return (
    <section data-testid="carbon-info-view">
      <strong>Carbon</strong>
      <div>{view.totalEmissionsTonnes.toFixed(2)} t tracked emissions</div>
      <div>{view.offsetsTonnes.toFixed(2)} t offsets</div>
      <div>{view.netTonnes.toFixed(2)} t net</div>
      <div className="muted">{view.daysTracked} operating days tracked</div>
      <h4>Flights {view.currentFlights.length ? 'today' : 'latest day'}</h4>
      {flights.length ? (
        flights.map((flight) => (
          <div key={flight.id} data-testid={`carbon-flight-${flight.id}`}>
            {flight.flightNo} · {flight.aircraft} · {(flight.kg / 1000).toFixed(2)} t
            {flight.safBlend > 0 ? ` · SAF ${(flight.safBlend * 100).toFixed(0)}%` : ''}
          </div>
        ))
      ) : (
        <div className="muted">No completed flights in the book.</div>
      )}
      <h4>Buildings today</h4>
      {buildings.length ? (
        buildings.map((building) => (
          <div key={building.id} data-testid={`carbon-building-${building.id}`}>
            {building.label} · {(building.kg / 1000).toFixed(2)} t/day
          </div>
        ))
      ) : (
        <div className="muted">No emitting buildings open.</div>
      )}
      <h4>Green Pioneer</h4>
      {goal ? (
        <div data-testid="green-pioneer-status">
          {goal.status} · day {goal.startedDay}–{goal.deadlineDay}
        </div>
      ) : (
        <button type="button" data-testid="start-green-pioneer" onClick={onStart}>
          Start 40-day net-zero goal
        </button>
      )}
      {view.outstandingTonnes > 0 ? (
        <button type="button" data-testid="buy-carbon-offsets" onClick={onOffset}>
          Offset {view.outstandingTonnes.toFixed(2)} t · $
          {Math.ceil(offsetCost(view.outstandingTonnes)).toLocaleString('en-US')}
        </button>
      ) : null}
    </section>
  )
}
