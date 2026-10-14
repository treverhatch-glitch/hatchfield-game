import type { Game } from '../game/sim.ts'
import type { DeliveryRead } from '../fuel/index.ts'
import { coverLabel, daysOfCover } from '../info/model.ts'
import { FUEL } from '../fuel/config.ts'
import { tankDef } from '../scale/logic.ts'
import { LiveText } from './LiveText.tsx'

function litres(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

function queueLine(row: DeliveryRead, price: number): string {
  const name = row.mode === 'pipeline' ? 'Pipeline' : 'Tanker'
  const where = row.state === 'road' ? 'on the road' : row.state === 'wait_cash' ? 'waiting on cash' : 'docked'
  const bill = row.mode === 'tanker' && price > 0 ? ` · $${Math.round(row.litres * price).toLocaleString('en-US')}` : ''
  return `${name} · ${litres(row.litres)} L · ${where}${bill}`
}

/**
 * Click-open numbers for the Fuel info view.
 * Farm level is the sim tank (`tankLitres` and the tank tier), not the logistics ledger.
 */
export function FuelPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  if (!game.site || game.view === 'hall') return null
  const view = game.fuelView()
  return (
    <aside className="fuel-panel" data-testid="fuel-farm">
      <header>
        <h2>Fuel</h2>
        <button type="button" className="ghost" data-testid="fuel-farm-close" onClick={onClose}>
          Close
        </button>
      </header>
      <p
        className="fuel-summary"
        data-testid="fuel-summary"
        title="Inputs: tankLitres on the fuel farm and the tank tier capacity."
      >
        <LiveText
          testId="fuel-summary-live"
          read={() => {
            const live = game.fuelView()
            const stock = game.tankLitres
            const cap = tankDef(game.tankTier).capacityLitres
            const cover = daysOfCover(stock, live.truckDrawPerMin, live.hydrantDrawPerMin, FUEL.minutesPerDay)
            return `${litres(stock)} L of ${litres(cap)} L · cover ${coverLabel(cover)}`
          }}
        />
      </p>
      <dl className="fuel-draw">
        <div title="Inputs: litres per minute the bowsers take from tankLitres.">
          <dt>Trucks</dt>
          <dd>{litres(view.truckDrawPerMin)} L/min</dd>
        </div>
        <div title="Inputs: litres per minute the hydrant takes from tankLitres.">
          <dt>Hydrant</dt>
          <dd>{litres(view.hydrantDrawPerMin)} L/min</dd>
        </div>
        <div title="Inputs: departures the farm cannot fuel.">
          <dt>Grounded</dt>
          <dd>{view.groundedIds.length}</dd>
        </div>
      </dl>
      <p className="fuel-meta" title="Inputs: fuel-chain deliveries whose state is road.">
        Trucks out {view.queue.filter((row) => row.state === 'road').length}
      </p>
      <p className="fuel-meta">Delivery queue</p>
      <ul className="fuel-queue" data-testid="fuel-queue">
        {view.queue.length === 0 ? <li className="empty">No delivery on the road.</li> : null}
        {view.queue.map((row) => (
          <li key={row.id} title={`Inputs: delivery mode ${row.mode}, litres ${Math.round(row.litres)}, and state ${row.state}.`}>
            {queueLine(row, view.wholesalePerLitre)}
          </li>
        ))}
      </ul>
    </aside>
  )
}
