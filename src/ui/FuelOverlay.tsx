import type { Game } from '../game/sim.ts'
import { openFuelFarm, type DeliveryRead } from '../fuel/index.ts'
import { LiveText } from './LiveText.tsx'

function litres(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

function cover(days: number): string {
  if (!Number.isFinite(days)) return 'no uplift'
  if (days >= 10) return `${days.toFixed(0)} days`
  if (days >= 1) return `${days.toFixed(1)} days`
  const hours = days * 24
  if (hours >= 1) return `${hours.toFixed(1)} hours`
  return 'under an hour'
}

function queueLine(row: DeliveryRead, price: number): string {
  const name = row.mode === 'pipeline' ? 'Pipeline' : 'Tanker'
  const where = row.state === 'road' ? 'on the road' : row.state === 'wait_cash' ? 'waiting on cash' : 'docked'
  const bill = row.mode === 'tanker' && price > 0 ? ` · $${Math.round(row.litres * price).toLocaleString('en-US')}` : ''
  return `${name} · ${litres(row.litres)} L · ${where}${bill}`
}

/**
 * Side panel for the fuel farm: stock, days of cover, and the delivery queue.
 * Opens from the Fuel farm button or a click on the farm.
 */
export function FuelOverlay({ game }: { game: Game }) {
  if (!game.site || game.view === 'hall') return null
  const open = game.fuelOpen
  const view = game.fuelView()
  return (
    <div className="fuel-dock">
      <button
        type="button"
        className={open ? 'on' : ''}
        data-testid="fuel-farm-toggle"
        aria-expanded={open}
        onClick={() => openFuelFarm(game)}
      >
        Fuel farm
      </button>
      {open ? (
        <aside className="fuel-panel" data-testid="fuel-farm">
          <header>
            <h2>Fuel farm</h2>
            <button type="button" className="ghost" data-testid="fuel-farm-close" onClick={() => game.closeFuelFarm()}>
              Close
            </button>
          </header>
          <p className="fuel-summary" data-testid="fuel-summary">
            <LiveText
              testId="fuel-summary-live"
              read={() => {
                const live = game.fuelView()
                return `${litres(live.litres)} L of ${litres(live.capacityLitres)} L · cover ${cover(live.daysCover)}`
              }}
            />
          </p>
          <dl className="fuel-draw">
            <div>
              <dt>Trucks</dt>
              <dd>{litres(view.truckDrawPerMin)} L/min</dd>
            </div>
            <div>
              <dt>Hydrant</dt>
              <dd>{litres(view.hydrantDrawPerMin)} L/min</dd>
            </div>
            <div>
              <dt>Grounded</dt>
              <dd>{view.groundedIds.length}</dd>
            </div>
          </dl>
          <p className="fuel-meta">Delivery queue</p>
          <ul className="fuel-queue" data-testid="fuel-queue">
            {view.queue.length === 0 ? <li className="empty">No delivery on the road.</li> : null}
            {view.queue.map((row) => (
              <li key={row.id}>{queueLine(row, view.wholesalePerLitre)}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
