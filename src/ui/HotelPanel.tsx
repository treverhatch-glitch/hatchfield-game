import { money } from '../game/catalog.ts'
import type { Game } from '../game/sim.ts'
import { RATE_MAX, RATE_MIN, RATE_STEP } from '../hotels/config.ts'

const LINK_LABEL: Record<string, string> = {
  inside: 'airside',
  walkway: 'walkway',
  shuttle: 'shuttle',
  none: 'no link',
}

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.round(n)))
}

/** Airport hotels: rooms, rates, last night's occupancy and revenue. */
export function HotelPanel({ game }: { game: Game }) {
  const view = game.hotelPanel()
  const last = view.last
  const tonight = view.tonight
  const rate = (side: 'landside' | 'airside', dir: 1 | -1) =>
    game.setHotelRate(side, view.rates[side] + dir * RATE_STEP)

  return (
    <section data-testid="hotel-panel">
      <h3>Hotels</h3>
      <p className="muted" data-testid="hotel-headline">
        {last
          ? `Last night ${last.occupied}/${last.rooms} rooms (${Math.round(last.occupancy * 100)}%) · ${money(last.revenue)}`
          : 'No night booked yet.'}
      </p>
      {view.rows.length ? (
        <ul className="airlines" data-testid="hotel-rows">
          {view.rows.map((row) => (
            <li key={row.id}>
              <b>
                {row.name} <span className="muted">{stars(row.stars)}</span>
              </b>
              <span className="muted">
                {row.rooms} rooms · {money(row.rate)}/night · {LINK_LABEL[row.link] ?? row.link} ·{' '}
                {Math.round(row.occupancy * 100)}% · {money(row.revenue)} · upkeep {money(row.upkeep)}/day
              </span>
              <button type="button" onClick={() => game.focusConnections(row.cell)}>
                Show
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Build an airport inn, business hotel or resort landside, or airside day rooms in the terminal for a
          transit hotel.
        </p>
      )}
      {(['landside', 'airside'] as const).map((side) => (
        <div className="row" key={side}>
          <span>{side === 'landside' ? 'Landside rate' : 'Transit rate'}</span>
          <button
            type="button"
            aria-label={`Lower ${side} rate`}
            disabled={view.rates[side] <= RATE_MIN + 1e-9}
            onClick={() => rate(side, -1)}
          >
            −
          </button>
          <b data-testid={`hotel-rate-${side}`}>{Math.round(view.rates[side] * 100)}%</b>
          <button
            type="button"
            aria-label={`Raise ${side} rate`}
            disabled={view.rates[side] >= RATE_MAX - 1e-9}
            onClick={() => rate(side, 1)}
          >
            +
          </button>
        </div>
      ))}
      <p className="muted" data-testid="hotel-tonight">
        Tonight so far: {tonight.layoverAirside + tonight.layoverLandside} layover ·{' '}
        {tonight.voucherAirline + tonight.voucherAirport} vouchers · {Math.round(tonight.crew)} crew · {tonight.local}{' '}
        local
      </p>
      {last && Object.values(last.overflow).some((n) => n > 0) ? (
        <p className="muted">
          Turned away last night: {Object.values(last.overflow).reduce((a, b) => a + b, 0)} guests
          {last.outsideVoucherCost > 0 ? ` · outside vouchers ${money(last.outsideVoucherCost)}` : ''}
        </p>
      ) : null}
    </section>
  )
}
