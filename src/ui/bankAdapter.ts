/**
 * Stand-in for `src/core/bank.ts` (PR #11, cursor/economy-tech-tree-8c87).
 * When that branch merges, replace this file with a re-export of
 * MONEY_CATEGORIES, MoneyCategory, and moneyDirection.
 * Amounts are never parsed out of news text.
 */

export const MONEY_CATEGORIES = [
  'landing_fees',
  'passenger_fees',
  'baggage_fees',
  'fuel_sales',
  'catering_fees',
  'retail_sales',
  'cargo_fees',
  'landside_fees',
  'parking_fees',
  'host_fees',
  'contract_fees',
  'maintenance_income',
  'task_rewards',
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'refunds',
  'construction',
  'contract_signing',
  'payroll',
  'building_upkeep',
  'vehicle_upkeep',
  'fuel_purchase',
  'meal_production',
  'loan_interest',
  'loan_repayment',
  'penalties',
  'city_levy',
  'share_purchases',
  'staff_hiring',
] as const

export type MoneyCategory = (typeof MONEY_CATEGORIES)[number]

const INCOME_CATEGORIES = new Set<MoneyCategory>([
  'landing_fees',
  'passenger_fees',
  'baggage_fees',
  'fuel_sales',
  'catering_fees',
  'retail_sales',
  'cargo_fees',
  'landside_fees',
  'parking_fees',
  'host_fees',
  'contract_fees',
  'maintenance_income',
  'task_rewards',
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'refunds',
])

const LABELS: Record<MoneyCategory, string> = {
  landing_fees: 'Landings',
  passenger_fees: 'Passengers',
  baggage_fees: 'Bags',
  fuel_sales: 'Fuel',
  catering_fees: 'Catering',
  retail_sales: 'Retail',
  cargo_fees: 'Cargo',
  landside_fees: 'Landside',
  parking_fees: 'Parking',
  host_fees: 'Host',
  contract_fees: 'Contracts',
  maintenance_income: 'Maintenance',
  task_rewards: 'Bonuses',
  loan_proceeds: 'Loans',
  ipo_proceeds: 'IPO',
  share_sales: 'Shares',
  refunds: 'Refunds',
  construction: 'Construction',
  contract_signing: 'Signing',
  payroll: 'Payroll',
  building_upkeep: 'Upkeep',
  vehicle_upkeep: 'Vehicles',
  fuel_purchase: 'Fuel buy',
  meal_production: 'Meals',
  loan_interest: 'Interest',
  loan_repayment: 'Repayment',
  penalties: 'Penalties',
  city_levy: 'City levy',
  share_purchases: 'Share buys',
  staff_hiring: 'Hiring',
}

/** Phrase → category. First match wins. Checked against earn() labels, not news prose. */
const EARN_RULES: readonly [string, MoneyCategory][] = [
  ['airtanker', 'host_fees'],
  ['divert', 'host_fees'],
  ['host', 'host_fees'],
  ['bag', 'baggage_fees'],
  ['cater', 'catering_fees'],
  ['de-ice', 'maintenance_income'],
  ['deice', 'maintenance_income'],
  ['fuel', 'fuel_sales'],
  ['park', 'parking_fees'],
  ['hangar', 'maintenance_income'],
  ['mx', 'maintenance_income'],
  ['clean', 'maintenance_income'],
  ['cargo', 'cargo_fees'],
  ['layover', 'contract_fees'],
  ['volume', 'contract_fees'],
  ['contract', 'contract_fees'],
  ['landing', 'landing_fees'],
  ['pad fee', 'landing_fees'],
  ['bonus', 'task_rewards'],
  ['mission', 'task_rewards'],
  ['ask done', 'task_rewards'],
]

export function moneyDirection(category: MoneyCategory): 'income' | 'expense' {
  return INCOME_CATEGORIES.has(category) ? 'income' : 'expense'
}

export function categoryLabel(category: MoneyCategory): string {
  return LABELS[category]
}

/** Map a sim earn() label onto a bank category. Unknown operating income is retail. */
export function categoryForEarnLabel(label: string): MoneyCategory {
  const text = label.toLowerCase()
  for (const [needle, category] of EARN_RULES) {
    if (text.includes(needle)) return category
  }
  return 'retail_sales'
}
