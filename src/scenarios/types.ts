export type ScenarioGoalKind =
  | 'transfer_share'
  | 'net_zero'
  | 'profit_days'
  | 'night_revenue'
  | 'pax_per_day';

export interface ScenarioConstraints {
  noLandPlots?: boolean;
  maxRunwayM?: number;
  curfew?: boolean;
  snow?: boolean;
  nightRevenueShare?: number;
  startDebt?: number;
  netZeroByDay?: number;
  militaryApron?: boolean;
}

export interface ScenarioGoal {
  kind: ScenarioGoalKind;
  target: number;
  byDay: number;
}

export interface Scenario {
  id: string;
  name: string;
  blurb: string;
  constraints: ScenarioConstraints;
  goal: ScenarioGoal;
}
