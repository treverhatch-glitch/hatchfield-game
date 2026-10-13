import {
  AWARD_BEST_REGIONAL,
  AWARD_CLEANEST,
  AWARD_LEASED,
  YEAR_COST_HEAVY,
  YEAR_EXCLUDED_CATEGORIES,
  YEAR_PAX_GOOD,
  YEAR_REVENUE_GOOD,
} from './config.ts'
import type { AwardWin, YearMetric, YearReport } from './types.ts'

const EXCLUDED = new Set<string>(YEAR_EXCLUDED_CATEGORIES)

export interface YearFigures {
  year: number
  fromDay: number
  toDay: number
  revenue: number
  costs: number
  passengers: number
  satisfaction: number
  cleanliness: number
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function operatingTotals(entries: { category: string; amount: number }[]): {
  revenue: number
  costs: number
} {
  let revenue = 0
  let costs = 0
  for (const entry of entries) {
    if (EXCLUDED.has(entry.category)) continue
    if (entry.amount > 0) revenue += entry.amount
    else costs += -entry.amount
  }
  return { revenue, costs }
}

/** Lean years score well. Spending more than you earned does not. */
export function costScore(costs: number, revenue: number): number {
  if (costs <= 0 && revenue <= 0) return 50
  if (revenue > 0) return clampScore(100 - (costs / revenue) * 50)
  return clampScore(100 - (costs / YEAR_COST_HEAVY) * 100)
}

export function scoreYear(figures: YearFigures): { best: YearMetric; worst: YearMetric; metrics: YearMetric[] } {
  const scoredCosts = costScore(figures.costs, figures.revenue)
  const metrics: YearMetric[] = [
    {
      id: 'revenue',
      label: 'Revenue',
      value: Math.round(figures.revenue),
      score: clampScore((figures.revenue / YEAR_REVENUE_GOOD) * 100),
    },
    {
      id: 'costs',
      label: 'Costs',
      value: Math.round(figures.costs),
      score: scoredCosts,
    },
    {
      id: 'passengers',
      label: 'Passengers',
      value: Math.round(figures.passengers),
      score: clampScore((figures.passengers / YEAR_PAX_GOOD) * 100),
    },
    {
      id: 'satisfaction',
      label: 'Satisfaction',
      value: Math.round(figures.satisfaction),
      score: clampScore(figures.satisfaction),
    },
  ]
  const ranked = [...metrics].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return { best: ranked[0], worst: ranked[ranked.length - 1], metrics }
}

export interface AwardContext {
  passengers: number
  satisfaction: number
  cleanliness: number
  net: number
  leased: number
  units: number
  avgQuality: number
}

export function evaluateAwards(ctx: AwardContext, year: number): AwardWin[] {
  const wins: AwardWin[] = []
  if (
    ctx.passengers >= AWARD_BEST_REGIONAL.passengers &&
    ctx.satisfaction >= AWARD_BEST_REGIONAL.satisfaction &&
    ctx.net >= 0
  ) {
    wins.push({
      id: AWARD_BEST_REGIONAL.id,
      name: AWARD_BEST_REGIONAL.name,
      year,
      prestige: AWARD_BEST_REGIONAL.prestige,
      reputation: AWARD_BEST_REGIONAL.reputation,
    })
  }
  if (ctx.cleanliness >= AWARD_CLEANEST.cleanliness && ctx.satisfaction >= AWARD_CLEANEST.satisfaction) {
    wins.push({
      id: AWARD_CLEANEST.id,
      name: AWARD_CLEANEST.name,
      year,
      prestige: AWARD_CLEANEST.prestige,
      reputation: AWARD_CLEANEST.reputation,
    })
  }
  if (ctx.units >= 1 && ctx.leased === ctx.units && ctx.avgQuality >= AWARD_LEASED.minQuality) {
    wins.push({
      id: AWARD_LEASED.id,
      name: AWARD_LEASED.name,
      year,
      prestige: AWARD_LEASED.prestige,
      reputation: AWARD_LEASED.reputation,
    })
  }
  return wins
}

export function buildYearReport(figures: YearFigures, awards: AwardWin[]): YearReport {
  const scored = scoreYear(figures)
  return {
    year: figures.year,
    fromDay: figures.fromDay,
    toDay: figures.toDay,
    revenue: Math.round(figures.revenue),
    costs: Math.round(figures.costs),
    net: Math.round(figures.revenue - figures.costs),
    passengers: Math.round(figures.passengers),
    satisfaction: Math.round(figures.satisfaction),
    cleanliness: Math.round(figures.cleanliness),
    best: scored.best,
    worst: scored.worst,
    awards,
  }
}
