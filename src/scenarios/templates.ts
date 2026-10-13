import type { Scenario, ScenarioGoalKind } from './types.js';

export const SCENARIOS: Scenario[] = [
  {
    id: 'island-hop',
    name: 'Island Hop',
    blurb: 'Manage an isolated island airfield with strictly limited expansion options.',
    constraints: {
      noLandPlots: true,
    },
    goal: {
      kind: 'pax_per_day',
      target: 500,
      byDay: 15,
    },
  },
  {
    id: 'mountain-gateway',
    name: 'Mountain Gateway',
    blurb: 'Surrounded by steep terrain, runway length is capped and mountain weather brings snow.',
    constraints: {
      maxRunwayM: 1800,
      snow: true,
    },
    goal: {
      kind: 'pax_per_day',
      target: 800,
      byDay: 20,
    },
  },
  {
    id: 'cramped-city',
    name: 'Cramped City',
    blurb: 'Urban noise restrictions force strict night curfews on flight operations.',
    constraints: {
      curfew: true,
      noLandPlots: true,
    },
    goal: {
      kind: 'profit_days',
      target: 5,
      byDay: 15,
    },
  },
  {
    id: 'cargo-night-owl',
    name: 'Cargo Night Owl',
    blurb: 'Focus on late-night freight logistics to achieve high night revenue share.',
    constraints: {
      nightRevenueShare: 0.5,
    },
    goal: {
      kind: 'night_revenue',
      target: 10000,
      byDay: 25,
    },
  },
  {
    id: 'mega-hub',
    name: 'Mega-Hub',
    blurb: 'Build a major international transit hub connecting high volumes of connecting passenger traffic.',
    constraints: {},
    goal: {
      kind: 'transfer_share',
      target: 0.25,
      byDay: 20,
    },
  },
  {
    id: 'military-host',
    name: 'Military Host',
    blurb: 'Accommodate military apron operations alongside commercial flights.',
    constraints: {
      militaryApron: true,
    },
    goal: {
      kind: 'profit_days',
      target: 10,
      byDay: 30,
    },
  },
  {
    id: 'green-pioneer',
    name: 'Green Pioneer',
    blurb: 'Achieve net-zero carbon operations before deadline.',
    constraints: {
      netZeroByDay: 40,
    },
    goal: {
      kind: 'net_zero',
      target: 1,
      byDay: 40,
    },
  },
  {
    id: 'rescue-failing-airport',
    name: 'Rescue a Failing Airport',
    blurb: 'Turn around a heavily burdened airport starting with $250k of debt.',
    constraints: {
      startDebt: 250000,
    },
    goal: {
      kind: 'profit_days',
      target: 7,
      byDay: 30,
    },
  },
];

const VALID_GOAL_KINDS: readonly ScenarioGoalKind[] = [
  'transfer_share',
  'net_zero',
  'profit_days',
  'night_revenue',
  'pax_per_day',
];

export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = [];

  if (!scenario || typeof scenario !== 'object') {
    return ['Scenario must be a valid object'];
  }

  if (!scenario.id || typeof scenario.id !== 'string' || scenario.id.trim() === '') {
    errors.push('Scenario id must be a non-empty string');
  }

  if (!scenario.name || typeof scenario.name !== 'string' || scenario.name.trim() === '') {
    errors.push('Scenario name must be a non-empty string');
  }

  if (!scenario.blurb || typeof scenario.blurb !== 'string' || scenario.blurb.trim() === '') {
    errors.push('Scenario blurb must be a non-empty string');
  }

  const { goal, constraints } = scenario;

  if (!goal || typeof goal !== 'object') {
    errors.push('Scenario goal must be an object');
  } else {
    if (!VALID_GOAL_KINDS.includes(goal.kind)) {
      errors.push(`Invalid goal kind: ${String(goal.kind)}`);
    }

    if (typeof goal.byDay !== 'number' || !Number.isFinite(goal.byDay) || goal.byDay <= 0) {
      errors.push('Goal byDay must be a finite number > 0');
    }

    if (typeof goal.target !== 'number' || !Number.isFinite(goal.target) || goal.target < 0) {
      errors.push('Goal target must be a finite number >= 0');
    }

    if (goal.kind === 'transfer_share' && typeof goal.target === 'number' && Number.isFinite(goal.target)) {
      if (goal.target < 0 || goal.target > 1) {
        errors.push('Goal target for transfer_share must be between 0 and 1');
      }
    }
  }

  if (constraints && typeof constraints === 'object') {
    if (
      constraints.nightRevenueShare !== undefined &&
      (typeof constraints.nightRevenueShare !== 'number' ||
        !Number.isFinite(constraints.nightRevenueShare) ||
        constraints.nightRevenueShare < 0 ||
        constraints.nightRevenueShare > 1)
    ) {
      errors.push('nightRevenueShare must be a number between 0 and 1');
    }

    if (
      constraints.startDebt !== undefined &&
      (typeof constraints.startDebt !== 'number' ||
        !Number.isFinite(constraints.startDebt) ||
        constraints.startDebt < 0)
    ) {
      errors.push('startDebt must be a finite number >= 0');
    }

    if (
      constraints.maxRunwayM !== undefined &&
      (typeof constraints.maxRunwayM !== 'number' ||
        !Number.isFinite(constraints.maxRunwayM) ||
        constraints.maxRunwayM <= 0)
    ) {
      errors.push('maxRunwayM must be a finite number > 0');
    }

    if (
      constraints.netZeroByDay !== undefined &&
      (typeof constraints.netZeroByDay !== 'number' ||
        !Number.isFinite(constraints.netZeroByDay) ||
        constraints.netZeroByDay <= 0)
    ) {
      errors.push('netZeroByDay must be a finite number > 0');
    }
  }

  return errors;
}

export function validateScenarios(scenarios: Scenario[]): string[] {
  if (!Array.isArray(scenarios)) {
    return ['Scenarios input must be an array'];
  }

  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const scenario of scenarios) {
    if (scenario && typeof scenario.id === 'string' && scenario.id.trim() !== '') {
      if (seenIds.has(scenario.id)) {
        errors.push(`Duplicate scenario id: ${scenario.id}`);
      } else {
        seenIds.add(scenario.id);
      }
    }
    const scenarioErrors = validateScenario(scenario);
    errors.push(...scenarioErrors);
  }

  return errors;
}
