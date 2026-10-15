import type { Game } from '../game/sim.ts'
import type { DeliveryRead } from '../fuel/index.ts'
import { SPOT_OFFER, termBandLitres } from '../fuel/offerData.ts'
import { coverLabel, daysOfCover } from '../info/model.ts'
import { FUEL } from '../fuel/config.ts'
import { FUEL_CONTRACTS } from '../scale/data.ts'
import { canSignContract, contractById, tankDef } from '../scale/logic.ts'
import { LiveText } from './LiveText.tsx'

function litres(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

function dollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function queueLine(row: DeliveryRead, price: number): string {
  const name = row.mode === 'pipeline' ? 'Pipeline' : 'Tanker'
  const where = row.state === 'road' ? 'on the road' : row.state === 'wait_cash' ? 'waiting on cash' : 'docked'
  const bill = row.mode === 'tanker' && price > 0 ? ` · ${dollars(row.litres * price)}` : ''
  return `${name} · ${litres(row.litres)} L · ${where}${bill}`
}

function supplierLine(game: Game): string {
  const contract = contractById(game.contractId)
  if (contract) return `${contract.name} · $${game.termUnitPrice(contract.id).toFixed(3)}/L`
  if (game.spotInbound) {
    return `Spot · ${game.spotInbound.supplier ?? SPOT_OFFER.supplier} · $${game.spotInbound.perLitre.toFixed(3)}/L`
  }
  const quote = game.quoteSpot()
  return `Spot · ${quote.supplier} · $${quote.perLitre.toFixed(3)}/L`
}

function nextBill(game: Game): string {
  const inbound = game.spotInbound
  if (inbound) return `${dollars(inbound.litres * inbound.perLitre)} when the tanker docks`
  const contract = contractById(game.contractId)
  if (contract) return `${dollars(contract.tankerLitres * game.termUnitPrice(contract.id))} for the next road tanker`
  const quote = game.quoteSpot()
  return `${dollars(SPOT_OFFER.tankerLitres * quote.perLitre)} for one spot tanker`
}

function bandLine(game: Game): string {
  const contract = contractById(game.contractId)
  if (!contract) return 'No term. Untaken litres are not billed until you sign.'
  const band = termBandLitres(contract.id)
  const drawn = Math.max(0, game.termUpliftLitres)
  const gap = Math.max(0, band - drawn)
  const short = gap * game.termUnitPrice(contract.id) * SPOT_OFFER.shortfallFraction
  return `Drawn today ${litres(drawn)} L · promised ${litres(band)} L · shortfall ${litres(gap)} L (${dollars(short)}) if the day ended now`
}

function standingLine(game: Game): string {
  const meters = FUEL_CONTRACTS.map((c) => `${c.name} ${game.supplierStanding[c.id] ?? 0}`).join(' · ')
  const index = Math.round(game.fuelIndex * 100)
  return `Standing ${meters}. Spot index ${index > 0 ? '+' : ''}${index}%.`
}

/**
 * Click-open numbers for the Fuel info view.
 * Farm level is the sim tank (`tankLitres` and the tank tier), not the logistics ledger.
 */
export function FuelPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  if (!game.site || game.view === 'hall') return null
  const view = game.fuelView()
  const offer = game.spotOffer
  return (
    <aside className="fuel-panel" data-testid="fuel-farm">
      <header>
        <h2>Fuel</h2>
        <button type="button" className="ghost" data-testid="fuel-farm-close" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="fuel-summary" data-testid="fuel-supplier">
        {supplierLine(game)}
      </p>
      <p className="fuel-meta" data-testid="fuel-next-bill">
        Next bill · {nextBill(game)}
      </p>
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
      <p className="fuel-meta" data-testid="fuel-band">
        {bandLine(game)}
      </p>
      <p className="fuel-meta" data-testid="fuel-standing">
        {standingLine(game)}
      </p>
      {offer ? (
        <div className="fuel-actions" data-testid="fuel-spot-offer">
          <p className="fuel-meta">
            {offer.supplier ?? SPOT_OFFER.supplier} · {litres(SPOT_OFFER.tankerLitres)} L at $
            {(offer.perLitre ?? SPOT_OFFER.perLitre).toFixed(3)}/L · {offer.flightNo}
          </p>
          <button type="button" data-testid="fuel-spot-accept" onClick={() => game.acceptSpot()}>
            Order tanker · {dollars(SPOT_OFFER.tankerLitres * (offer.perLitre ?? SPOT_OFFER.perLitre))}
          </button>
          <button type="button" data-testid="fuel-spot-decline" onClick={() => game.declineSpot()}>
            Decline
          </button>
        </div>
      ) : null}
      <p className="fuel-meta">Terms</p>
      <ul className="fuel-queue" data-testid="fuel-terms">
        {FUEL_CONTRACTS.map((c) => {
          const gate = canSignContract(c.id, game.fieldLevel(), game.researchGrants())
          const band = termBandLitres(c.id)
          const signed = game.contractId === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                data-testid={`fuel-term-${c.id}`}
                disabled={!gate.ok || signed}
                title={gate.ok ? '' : gate.why}
                onClick={() => game.signScaleContract(c.id)}
              >
                {signed ? 'Signed · ' : ''}
                {c.name} {dollars(c.sign)} · ${game.termUnitPrice(c.id).toFixed(3)}/L · {litres(band)} L/day
              </button>
              {!gate.ok ? <span className="muted"> {gate.why}</span> : null}
            </li>
          )
        })}
      </ul>
      {game.contractId ? (
        <button type="button" data-testid="fuel-drop-term" onClick={() => game.dropFuelTerm()}>
          Drop back to spot
        </button>
      ) : null}
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
