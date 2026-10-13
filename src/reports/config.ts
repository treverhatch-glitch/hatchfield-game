/**
 * Tunables for the playtest year-end card.
 * Year length matches the tycoon year in PR #63 (`DAYS_PER_YEAR` = 12 game days).
 * Score scales and excluded financing categories match that report so the two
 * cards agree when both are on the field.
 */

export const PLAYTEST_YEAR_DAYS = 12

/** Scores for best / worst. Same bars as the tycoon year report. */
export const YEAR_REVENUE_GOOD = 40_000
export const YEAR_COST_HEAVY = 80_000
export const YEAR_PAX_GOOD = 500

/**
 * Financing is not operating revenue. Same set the tycoon year close ignores.
 */
export const YEAR_EXCLUDED_CATEGORIES = [
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'share_purchases',
  'refunds',
] as const

/**
 * Labels for PR #71 disruption ids. Unknown kinds still render from the id.
 */
export const DISRUPTION_LABELS: Readonly<Record<string, string>> = {
  'volcanic-ash': 'Volcanic ash',
  'state-visit': 'State visit',
  'software-outage': 'Software outage',
  'strike-day': 'Strike day',
  'hub-meltdown': 'Hub meltdown',
  'health-screening': 'Health-screening scare',
  'rival-price-war': 'Rival price war',
}

/**
 * One-line reasons for PR #63 award ids.
 * A caller-supplied `reason` wins; anything else falls back to the award name.
 */
export const AWARD_REASONS: Readonly<Record<string, string>> = {
  best_regional:
    'Passengers and satisfaction cleared the regional bar, and the year finished in the black.',
  cleanest_terminal: 'The terminal stayed clean and satisfaction stayed high.',
  leased_concourse: 'Every unit was leased, and average quality cleared the bar.',
}
