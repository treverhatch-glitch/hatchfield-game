import { useState } from 'react'
import {
  DEFAULT_FEE_SCHEDULE,
  FEE_FIELDS,
  editFee,
  scheduleElasticity,
  type FeeSchedule,
} from '../commercial/index.ts'

function feeText(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n !== 0 && Math.abs(n) < 1) return n.toFixed(3)
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Cities: Skylines-style side dock. It sits on the edge of the apron and does not
 * cover the field or block a click outside the panel.
 */
export function FeesPanel({ onClose }: { onClose: () => void }) {
  const [fees, setFees] = useState<FeeSchedule>(DEFAULT_FEE_SCHEDULE)
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
        Contracts pay these prices times the deposit tier and any discount. Walk-in traffic pays the
        list price. Prices never block a signature.
      </p>
      <p className="fees-readout" data-tone={curve.demand < 1 ? 'hot' : curve.demand > 1 ? 'cheap' : 'ok'}>
        Walk-in demand ×{curve.demand.toFixed(2)}
        {curve.standingDelta < 0 ? ` · Standing ${curve.standingDelta.toFixed(1)}` : ''}
        <span>Price index {curve.priceIndex.toFixed(2)}× · penalty starts above 1.30×</span>
      </p>
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
                onChange={(event) => {
                  setFees((cur) => editFee(cur, field.key, Number(event.target.value)))
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </aside>
  )
}
