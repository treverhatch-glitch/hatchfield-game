import type { GateLevel, GateRequirement } from './data';
import { LEVEL_GATES } from './data';

export interface GateStats {
  profitStreakDays: number;
  morale: number;
  connectingBanks: number;
  a380ContractDays: number;
  rating: number;
  transferShare: number;
  paxPerDay: number;
  mishandledRate: number;
  majorDisruptionsSurvived: number;
  specializationBadges: number;
  marketsBeatingRival: number;
}

export interface MissingRequirement {
  key: string;
  have: number;
  need: number;
}

export interface GateCheckResult {
  ok: boolean;
  missing: MissingRequirement[];
}

function isRequirementMet(have: number, req: GateRequirement): boolean {
  if (typeof have !== 'number' || Number.isNaN(have)) {
    return false;
  }
  if (req.comparison === 'gte') {
    return have >= req.need;
  }
  if (req.comparison === 'lt') {
    return have < req.need;
  }
  return false;
}

export function checkGate(level: GateLevel, s: GateStats): GateCheckResult {
  const reqs = LEVEL_GATES[level];
  if (!reqs) {
    return { ok: false, missing: [] };
  }

  const missing: MissingRequirement[] = [];

  for (const req of reqs) {
    const have = s[req.key];
    if (!isRequirementMet(have, req)) {
      missing.push({
        key: req.key,
        have,
        need: req.need,
      });
    }
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}
