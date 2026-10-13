// Late-game content types. Pure data + logic; no DOM/Three/React imports.
export type Specialization = 'hub' | 'lowcost' | 'cargo' | 'luxury' | 'green' | 'military';
export type FieldLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface LateBuilding {
  id: string;
  name: string;
  category: string;
  tier: 'III' | 'Prestige';
  unlockFL: FieldLevel;
  /** Tech node that must be researched first (if any). */
  requiresTech?: string;
  cost: number;
  /** Upkeep per in-game day (owner rule: upkeep is priced daily). */
  upkeepPerDay: number;
  powerMW: number;
  staff: number;
  buff: string;
  downside: string;
  spec?: Specialization;
}

export interface TechNode {
  id: string;
  branch: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  rp: number;
  unlockFL: FieldLevel;
  requires: string[];
  effect: string;
}

export interface FieldLevelGoal {
  level: FieldLevel;
  xp: number;
  goals: string[];
  grantCash: number;
  grantRP: number;
}

export interface PrestigeStar {
  star: 1 | 2 | 3 | 4 | 5;
  xp: number;
  challenge: string;
  /** Machine-checkable requirements against a PrestigeSnapshot. */
  req: Partial<PrestigeSnapshot>;
  reward: string;
}

export interface PrestigeSnapshot {
  fieldLevel: number;
  paxPerDay: number;
  ratingPct: number;
  onTimePct: number;
  mishandledBagPct: number; // lower is better
  transferPaxPct: number;
  rivalSharePct: number; // rival's share of regional market; lower is better
  specializationsMastered: number;
  awardsWon: number;
}
