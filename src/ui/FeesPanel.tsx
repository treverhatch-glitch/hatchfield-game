import {
  FEE_FIELDS,
  scheduleElasticity,
  type DepositTier,
  type FeeSchedule,
} from '../commercial/index.ts'

function feeText(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n !== 0 && Math.abs(n) < 1) return n.toFixed(3)
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

const TIERS: { id: DepositTier; label: string }[] = [
  { id: 'big', label: 'Big' },
  { id: 'standard', label: 'Standard' },
  { id: 'small', label: 'Small' },
  { id: 'none', label: 'None' },
]

/**
 * Cities: Skylines-style side dock. It sits on the edge of the apron and does not
 * cover the field or block a click outside the panel.
 */
export function FeesPanel({
  fees,
  depositTier,
  onFee,
  onTier,
  onClose,
}: {
  fees: FeeSchedule
  depositTier: DepositTier
  onFee: (key: keyof FeeSchedule, value: number) => void
  onTier: (tier: DepositTier) => void
  onClose: () => void
}) {
  const curve = scheduleElasticity(fees)

  return (
    <aside className="fees-dock" data-testid="fees-panel" aria-label="Fees">
      <div className="fees-head">
        <h2>Fees</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">
        Contracts pay these prices times the deposit tier. Walk-in traffic pays the list price.
        Prices never block a signature.
      </p>
      <p className="fees-readout" data-tone={curve.demand < 1 ? 'hot' : curve.demand > 1 ? 'cheap' : 'ok'}>
        Walk-in demand ×{curve.demand.toFixed(2)}
        {curve.standingDelta < 0 ? ` · Standing ${curve.standingDelta.toFixed(1)}` : ''}
        <span>Price index {curve.priceIndex.toFixed(2)}× · penalty starts above 1.30×</span>
      </p>
      <p className="fees-tier-label">Deposit on the next signature</p>
      <div className="fees-tier" role="group" aria-label="Deposit tier">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className={depositTier === tier.id ? 'on' : ''}
            data-testid={`deposit-${tier.id}`}
            aria-pressed={depositTier === tier.id}
            onClick={() => onTier(tier.id)}
          >
            {tier.label}
          </button>
        ))}
      </div>
      <ul className="budgets fees-sliders">
        {FEE_FIELDS.map((field) => (
          <li key={field.key}>
            <label>
              <span>
                {field.label}
                <strong>
                  {feeText(fees[field.key])} {field.unit}
                </strong>
              </span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={fees[field.key]}
                data-testid={`fee-${field.key}`}
                aria-label={field.label}
                onChange={(event) => onFee(field.key, Number(event.target.value))}
              />
            </label>
          </li>
        ))}
      </ul>
    </aside>
  )
}
