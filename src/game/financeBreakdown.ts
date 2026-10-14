import { MONEY_CATEGORIES, type BankLedger, type MoneyCategory } from '../core/bank.ts'

export interface FinanceLine {
  category: MoneyCategory
  label: string
  /** Signed. Income is positive, a charge is negative. */
  amount: number
  /** Hover text: why this line moved. */
  why: string
  /** The debt floor (or a short payroll or loan tick) skipped this bill. Cash did not move. */
  unpaid?: boolean
}

const COPY: Record<MoneyCategory, { label: string; why: string }> = {
  landing_fees: {
    label: 'Landing',
    why: 'Posted when a turnaround books the landing. The flight ledger and this line use the same fee.',
  },
  passenger_fees: {
    label: 'Passengers',
    why: 'Per passenger on the turn, plus fast-track. Only passengers who were processed are billed.',
  },
  baggage_fees: {
    label: 'Bags',
    why: 'Bag handling for work the hall actually did. A general-aviation turn with no bags posts nothing.',
  },
  fuel_sales: {
    label: 'Fuel sales',
    why: 'Litres pumped at the signed markup. The sale posts when the bowser finishes, not when the truck rolls out.',
  },
  catering_fees: {
    label: 'Catering',
    why: 'Galley bill for the turn. A $0 airline rate still sells a share of a cart, so a commuter is not free.',
  },
  retail_sales: {
    label: 'Food and shops',
    why: 'Cash a guest actually paid at a counter. An empty shelf records lost spend and does not post a sale.',
  },
  cargo_fees: {
    label: 'Cargo',
    why: 'Freight handling when the load finishes. The fee follows the units that moved.',
  },
  landside_fees: {
    label: 'Landside',
    why: 'Hotel, parking, bus, and rail earn only when a guest uses them. An idle stamp does not.',
  },
  parking_fees: {
    label: 'Aircraft parking',
    why: 'Ramp parking after the free hours. The first hours on the fee card are not billed.',
  },
  host_fees: {
    label: 'Host fees',
    why: 'Divert, military, and emergency host fees. Refusing a host does not collect this line.',
  },
  diplomacy_income: {
    label: 'Diplomacy receipts',
    why: 'An airline co-funding an endeavor, or part of the cost back when they decline. This is not a host fee.',
  },
  contract_fees: {
    label: 'Contracts',
    why: 'Signed-contract charges and tenant rent. The amount is the deal that was accepted.',
  },
  deposits: {
    label: 'Deposits',
    why: 'Cash held for a deposit tier. It is not operating income and payroll ignores it.',
  },
  maintenance_income: {
    label: 'Maintenance income',
    why: 'Airline MX the hangar billed for work that was done.',
  },
  task_rewards: {
    label: 'Task rewards',
    why: 'Field-ask and mission bonuses. They post once, when the ask is met.',
  },
  level_reward: {
    label: 'Level reward',
    why: 'Cash paid once when the field reaches a new level. It is not operating income, so payroll ignores it.',
  },
  loan_proceeds: {
    label: 'Loan proceeds',
    why: 'Principal the bank wired. The fee is added to what you owe and is not cash in the drawer.',
  },
  ipo_proceeds: {
    label: 'IPO',
    why: 'Cash raised when HATCH lists. The listing fee is a separate charge.',
  },
  share_sales: {
    label: 'Shares sold',
    why: 'Founder shares sold at the ticker. The cash in is this line.',
  },
  refunds: {
    label: 'Refunds',
    why: 'Partial refund on a cancel or a bulldoze. The same refund leaves the project and enters cash.',
  },
  construction: {
    label: 'Construction',
    why: 'Land, the starter kit, stamps, and hall items. Cash leaves when you commit the build.',
  },
  contract_signing: {
    label: 'Signing fees',
    why: 'Vendor contracts and the IPO listing fee. Signing is not free.',
  },
  deposit_refunds: {
    label: 'Deposits returned',
    why: 'A held deposit paid back to the airline.',
  },
  advertising: {
    label: 'Advertising',
    why: 'Campaigns and counter-promotions. The price on the button is the amount posted.',
  },
  payroll: {
    label: 'Payroll',
    why: 'Once per game day: the staffing floor, or the share of that day’s operating income, whichever is higher. A short day pays what cash allows.',
  },
  building_upkeep: {
    label: 'Upkeep',
    why: 'Day-close upkeep of the hall, buildings, links, and housing. Land tax and insurance are the land holding line. Idle lanes still bill.',
  },
  land_holding: {
    label: 'Land holding',
    why: 'Plot tax, insurance, utilities, and licences. Plot upkeep itself is only part of this bill. Idle land still costs money.',
  },
  vehicle_upkeep: {
    label: 'Vehicle upkeep',
    why: 'Trucks and ground equipment. Wear is a cost, not a warning.',
  },
  fuel_purchase: {
    label: 'Fuel purchase',
    why: 'Fuel bought onto the farm, including a SAF premium when that plant is open.',
  },
  meal_production: {
    label: 'Meal production',
    why: 'Meals cooked for the galley. A turn that sells catering still pays to produce the food.',
  },
  loan_interest: {
    label: 'Loan interest',
    why: 'Interest taken on the loan clock. Interest cash could not cover is added to the balance, and the owe figure is that balance.',
  },
  loan_repayment: {
    label: 'Loan principal',
    why: 'Principal paid down. Pay loan takes the balance currently owed, not the original principal.',
  },
  penalties: {
    label: 'Penalties',
    why: 'Other fines: abandon, overstay, fire, and breaches that are not a named shock, task, refuse, inbound, connection, cargo miss, or crash.',
  },
  diplomacy: {
    label: 'Diplomacy',
    why: 'Endeavors, incentives, apologies, mediation, and hub contracts. The price on the action is the amount posted.',
  },
  legal: {
    label: 'Legal',
    why: 'Lawsuit fees, damages, and settlements.',
  },
  security_shock: {
    label: 'Security shocks',
    why: 'A security failure, or another fine booked on that same shock. Private hard and soft fines differ; a public field is higher.',
  },
  task_miss: {
    label: 'Task misses',
    why: 'An airline field ask expired unmet.',
  },
  emergency_refuse: {
    label: 'Refused emergencies',
    why: 'A divert or tanker the field refused or let time out. A host the field could not take is not this fine.',
  },
  inbound_fine: {
    label: 'Inbound fines',
    why: 'An inbound ask that was refused. An expired toast is not billed.',
  },
  missed_connection: {
    label: 'Missed connections',
    why: 'A missed connection: the rebook fee, or a hotel night when the field has beds.',
  },
  cargo_miss: {
    label: 'Cargo misses',
    why: 'A cargo volume window closed short of the target.',
  },
  crash_fine: {
    label: 'Crash fine',
    why: 'The crash write-off, capped. A missing ambulance is a separate penalty.',
  },
  city_levy: {
    label: 'City levy',
    why: 'Half a percent of cash above the protected floor, once per game day, after payroll.',
  },
  share_purchases: {
    label: 'Shares bought',
    why: 'Shares bought back at the ticker.',
  },
  staff_hiring: {
    label: 'Hiring',
    why: 'One-time hire cost. Daily wages stay on the payroll line.',
  },
}

/** Non-zero ledger categories, in the canonical order, each with a why tooltip. */
export function financeBreakdown(ledger: BankLedger): FinanceLine[] {
  const lines: FinanceLine[] = []
  for (const category of MONEY_CATEGORIES) {
    const amount = ledger.byCategory[category] ?? 0
    if (!amount) continue
    const copy = COPY[category]
    lines.push({ category, label: copy.label, amount, why: copy.why })
  }
  const skipped: Partial<Record<MoneyCategory, number>> = {}
  for (const entry of ledger.entries) {
    if (!entry.meta.unpaid || !entry.amount) continue
    skipped[entry.category] = (skipped[entry.category] ?? 0) + entry.amount
  }
  for (const category of MONEY_CATEGORIES) {
    const amount = skipped[category] ?? 0
    if (!amount) continue
    const copy = COPY[category]
    lines.push({
      category,
      label: `${copy.label} unpaid`,
      amount,
      why: `Not taken from cash. ${copy.why}`,
      unpaid: true,
    })
  }
  return lines
}

/** Category lines plus the opening cash equal the ledger balance. */
export function ledgerBalances(ledger: BankLedger): boolean {
  let signed = ledger.openingBalance
  for (const category of MONEY_CATEGORIES) signed += ledger.byCategory[category] ?? 0
  return Math.abs(signed - ledger.balance) < 0.5
}
