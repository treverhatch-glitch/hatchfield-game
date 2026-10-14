import { useState } from 'react'
import type { Game } from '../game/sim.ts'
import { SIM_MINUTES_PER_GAME_DAY } from '../core/clock.ts'
import { operatingTotals, formatReportMoney } from './yearEnd.ts'
import { moneyDirection, type MoneyCategory, MONEY_CATEGORIES } from '../core/bank.ts'
import { LineChart } from '../ui/LineChart.tsx'

export function FinanceScreen({ game }: { game: Game }) {
  const [period, setPeriod] = useState<'month' | 'last-month' | 'year' | 'all'>('month')

  const currentDay = Math.floor(Math.max(0, game.clock) / 180)
  let startDay = 0
  let endDay = currentDay + 1

  if (period === 'month') {
    startDay = currentDay
  } else if (period === 'last-month') {
    startDay = Math.max(0, currentDay - 1)
    endDay = startDay + 1
  } else if (period === 'year') {
    startDay = Math.max(0, currentDay - 11)
  }

  const entries = game.bank.entriesBetween(startDay * SIM_MINUTES_PER_GAME_DAY, endDay * SIM_MINUTES_PER_GAME_DAY)
  const totals = operatingTotals(entries)

  const revenueByCategory: Partial<Record<MoneyCategory, number>> = {}
  const costsByCategory: Partial<Record<MoneyCategory, number>> = {}

  for (const entry of entries) {
    if (moneyDirection(entry.category) === 'income') {
      revenueByCategory[entry.category] = (revenueByCategory[entry.category] ?? 0) + entry.amount
    } else {
      costsByCategory[entry.category] = (costsByCategory[entry.category] ?? 0) + Math.abs(entry.amount)
    }
  }

  const sortedRevenue = Object.entries(revenueByCategory)
    .sort((a, b) => b[1] - a[1]) as [MoneyCategory, number][]
  const sortedCosts = Object.entries(costsByCategory)
    .sort((a, b) => b[1] - a[1]) as [MoneyCategory, number][]

  // Daily cash flow aggregation
  const cashFlowByDay: number[] = Array(endDay - startDay).fill(0)
  for (const entry of entries) {
    const dayOffset = Math.floor(entry.meta.simMinutes / SIM_MINUTES_PER_GAME_DAY) - startDay
    if (dayOffset >= 0 && dayOffset < cashFlowByDay.length) {
      cashFlowByDay[dayOffset] += entry.amount
    }
  }

  // Calculate cumulative cash flow or just daily? The requirement says "cash flow over time".
  // Let's do daily net.
  const chartSeries = [
    {
      name: 'Daily Net Cash',
      color: '#c9a227',
      values: cashFlowByDay
    }
  ]

  const totalRev = sortedRevenue.reduce((sum, [, amt]) => sum + amt, 0)
  const totalCost = sortedCosts.reduce((sum, [, amt]) => sum + amt, 0)

  // Generate distinct colors for categories
  const categoryColors: Partial<Record<MoneyCategory, string>> = {}
  const palette = ['#c9a227', '#6a9ec8', '#8ee0a8', '#ff9b8f', '#a8a8a8', '#d5dece', '#9eb0a0', '#e7c56a']
  MONEY_CATEGORIES.forEach((cat, i) => {
    categoryColors[cat] = palette[i % palette.length]
  })

  return (
    <section className="finance-screen" data-testid="finance-screen">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')} data-testid="period-month">This month</button>
        <button className={period === 'last-month' ? 'on' : ''} onClick={() => setPeriod('last-month')} data-testid="period-last-month">Last month</button>
        <button className={period === 'year' ? 'on' : ''} onClick={() => setPeriod('year')} data-testid="period-year">Last 12 months</button>
        <button className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')} data-testid="period-all">All time</button>
      </div>

      <div style={{ marginBottom: '16px' }} data-testid="finance-pl">
        <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e7c56a' }}>P&L</h3>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', margin: 0 }}>
          <dt style={{ color: '#9eb0a0' }}>Operating Revenue</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>{formatReportMoney(totals.revenue)}</dd>
          <dt style={{ color: '#9eb0a0' }}>Operating Costs</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>{formatReportMoney(totals.costs)}</dd>
          <dt style={{ color: '#9eb0a0' }}>Net Operating Income</dt>
          <dd style={{ margin: 0, textAlign: 'right', fontWeight: 'bold', color: totals.revenue >= totals.costs ? '#8ee0a8' : '#ff9b8f' }}>
            {formatReportMoney(totals.revenue - totals.costs)}
          </dd>
        </dl>
      </div>

      <div style={{ marginBottom: '16px' }} data-testid="finance-cash-flow">
         <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e7c56a' }}>Cash Flow</h3>
         {cashFlowByDay.length > 1 ? (
           <LineChart title="Daily Net Cash Flow" series={chartSeries} />
         ) : (
           <p className="muted">Not enough data to graph cash flow over time.</p>
         )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} data-testid="finance-sources">
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e7c56a' }}>Revenue by Source</h3>
          <div style={{ display: 'flex', height: '24px', background: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
            {sortedRevenue.map(([cat, amt]) => {
              const width = totalRev > 0 ? (amt / totalRev) * 100 : 0
              return width > 0 ? (
                <div key={cat} style={{ width: `${width}%`, background: categoryColors[cat] }} title={`${cat}: ${formatReportMoney(amt)}`} />
              ) : null
            })}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '11px', color: '#9eb0a0' }}>
            {sortedRevenue.map(([cat, amt]) => (
              <li key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: categoryColors[cat], marginRight: '4px', borderRadius: '2px' }}></span>{cat.replace(/_/g, ' ')}</span>
                <span>{formatReportMoney(amt)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e7c56a' }}>Costs by Source</h3>
          <div style={{ display: 'flex', height: '24px', background: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
            {sortedCosts.map(([cat, amt]) => {
              const width = totalCost > 0 ? (amt / totalCost) * 100 : 0
              return width > 0 ? (
                <div key={cat} style={{ width: `${width}%`, background: categoryColors[cat] }} title={`${cat}: ${formatReportMoney(amt)}`} />
              ) : null
            })}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '11px', color: '#9eb0a0' }}>
            {sortedCosts.map(([cat, amt]) => (
              <li key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: categoryColors[cat], marginRight: '4px', borderRadius: '2px' }}></span>{cat.replace(/_/g, ' ')}</span>
                <span>{formatReportMoney(amt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </section>
  )
}
