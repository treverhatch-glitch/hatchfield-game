import { qualityLabel } from './config.ts'
import type { CampaignKind } from './config.ts'
import type { TycoonTab, TycoonView, YearReport } from './types.ts'

function sharePct(share: number): string {
  return `${Math.round(share * 100)}%`
}

export function YearReportCard({
  report,
  formatMoney,
  onDismiss,
}: {
  report: YearReport
  formatMoney: (n: number) => string
  onDismiss: () => void
}) {
  return (
    <div
      className="year-report"
      role="dialog"
      aria-modal="false"
      aria-labelledby="year-report-title"
      data-testid="year-report-modal"
    >
      <YearReportBody report={report} formatMoney={formatMoney} />
      <button type="button" data-testid="year-report-dismiss" onClick={onDismiss}>
        Close report
      </button>
    </div>
  )
}

export function YearReportBody({
  report,
  formatMoney,
}: {
  report: YearReport
  formatMoney: (n: number) => string
}) {
  return (
    <div data-testid="year-report-body">
      <h2 id="year-report-title">Year {report.year}</h2>
      <p className="muted">Days {report.fromDay + 1}–{report.toDay}</p>
      <dl>
        <dt>Revenue</dt>
        <dd>{formatMoney(report.revenue)}</dd>
        <dt>Costs</dt>
        <dd>{formatMoney(report.costs)}</dd>
        <dt>Net</dt>
        <dd>{formatMoney(report.net)}</dd>
        <dt>Passengers</dt>
        <dd>{report.passengers.toLocaleString('en-US')}</dd>
        <dt>Satisfaction</dt>
        <dd>{report.satisfaction}</dd>
      </dl>
      <p className="tycoon-note" data-testid="year-best">
        Best: {report.best.label} ({report.best.score})
      </p>
      <p className="tycoon-note" data-testid="year-worst">
        Worst: {report.worst.label} ({report.worst.score})
      </p>
      {report.awards.length ? (
        <ul className="airlines">
          {report.awards.map((award) => (
            <li key={award.id}>
              {award.name} · prestige +{award.prestige}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No award this year.</p>
      )}
    </div>
  )
}

export function TycoonPanel({
  view,
  cash,
  tab,
  formatMoney,
  onTab,
  onAccept,
  onReroll,
  onCampaign,
  onDismissReport,
}: {
  view: TycoonView
  cash: number
  tab: TycoonTab
  formatMoney: (n: number) => string
  onTab: (tab: TycoonTab) => void
  onAccept: (unitId: string, bidId: string) => void
  onReroll: (unitId: string) => void
  onCampaign: (kind: CampaignKind) => void
  onDismissReport: () => void
}) {
  const tabs: { id: TycoonTab; label: string }[] = [
    { id: 'shops', label: 'Shops' },
    { id: 'ads', label: 'Campaigns' },
    { id: 'awards', label: 'Awards' },
  ]
  if (view.report) tabs.push({ id: 'year', label: 'Year' })
  const demand = view.demandMultiplier
  return (
    <div data-testid="tycoon-panel">
      <div className="tycoon-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'on' : ''}
            data-testid={`tycoon-tab-${item.id}`}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="muted">
        Prestige {view.prestige}
        {demand > 1 ? ` · demand ×${demand.toFixed(2)}` : ''}
        {view.airlineInterest > 0 ? ` · airline interest +${Math.round(view.airlineInterest * 100)}%` : ''}
      </p>
      {tab === 'shops' ? (
        <section>
          <h3>Tenants</h3>
          {view.units.length === 0 ? (
            <p className="muted">Build a food or shop unit. Brands bid when it is empty.</p>
          ) : (
            view.units.map((unit) => (
              <article key={unit.id} className="bid-card" data-testid={`unit-${unit.id}`}>
                <p>
                  <strong>{unit.label}</strong> · {unit.kind === 'food' ? 'Food' : 'Retail'}
                </p>
                {unit.lease ? (
                  <p className="muted">
                    {unit.lease.brand} · {qualityLabel(unit.lease.quality)} · {formatMoney(unit.lease.dailyRent)}
                    /day · {sharePct(unit.lease.revenueShare)} of sales · {unit.daysLeft}d left
                    {unit.lease.renewed ? ` · renewed ${unit.lease.renewed}` : ''}
                  </p>
                ) : (
                  <>
                    {unit.bids.map((bid) => (
                      <p key={bid.id}>
                        <button
                          type="button"
                          data-testid={`accept-${bid.id}`}
                          onClick={() => onAccept(unit.id, bid.id)}
                        >
                          {bid.brand}
                        </button>{' '}
                        <span className="muted">
                          {qualityLabel(bid.quality)} · {formatMoney(bid.dailyRent)}/day · {sharePct(bid.revenueShare)}{' '}
                          share
                        </span>
                      </p>
                    ))}
                    <button type="button" className="ghost" onClick={() => onReroll(unit.id)}>
                      New bids
                    </button>
                  </>
                )}
              </article>
            ))
          )}
        </section>
      ) : null}
      {tab === 'ads' ? (
        <section>
          <h3>Campaigns</h3>
          <p className="muted">One at a time. Cash leaves the ledger the day you start it.</p>
          {view.campaigns.map((card) => {
            const running = (card.activeDaysLeft ?? 0) > 0
            const disabled = running || card.blocked || cash < card.cost
            return (
              <article key={card.kind} className="bid-card">
                <p>
                  <button
                    type="button"
                    data-testid={`campaign-${card.kind}`}
                    disabled={disabled}
                    onClick={() => onCampaign(card.kind)}
                  >
                    {card.label} · {formatMoney(card.cost)}
                  </button>
                </p>
                <p className="muted">
                  {card.blurb} {card.days} days.
                  {running ? ` ${card.activeDaysLeft}d left.` : ''}
                  {card.blocked ? ' Another campaign is up.' : ''}
                </p>
              </article>
            )
          })}
        </section>
      ) : null}
      {tab === 'awards' ? (
        <section>
          <h3>Awards</h3>
          <p className="muted">Judged once a year. Prestige stacks. Reputation moves with the award.</p>
          {view.awards.length === 0 ? (
            <p className="muted">None yet. Best Regional Airport and Cleanest Terminal are on the table.</p>
          ) : (
            <ul className="airlines">
              {view.awards.map((award) => (
                <li key={`${award.id}-${award.year}`}>
                  Year {award.year} · {award.name} · prestige +{award.prestige}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {tab === 'year' && view.report ? (
        <section>
          <YearReportBody report={view.report} formatMoney={formatMoney} />
          <button type="button" data-testid="year-report-dismiss-panel" onClick={onDismissReport}>
            Close report
          </button>
        </section>
      ) : null}
    </div>
  )
}
