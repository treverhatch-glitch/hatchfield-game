import { describe, expect, it } from 'vitest';
import { SCENARIOS, validateScenario, validateScenarios } from './templates.js';
import type { Scenario } from './types.js';

describe('Scenario Templates and Validator', () => {
  it('contains exactly 8 scenarios in SCENARIOS array', () => {
    expect(SCENARIOS).toHaveLength(8);
  });

  it('validates all 8 default scenarios without any errors', () => {
    const errors = validateScenarios(SCENARIOS);
    expect(errors).toEqual([]);
  });

  it('has unique scenario IDs across all default scenarios', () => {
    const ids = SCENARIOS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(8);
  });

  it('detects duplicate scenario IDs', () => {
    const duplicateScenarios: Scenario[] = [
      SCENARIOS[0],
      {
        ...SCENARIOS[0],
        name: 'Duplicate Scenario',
      },
    ];
    const errors = validateScenarios(duplicateScenarios);
    expect(errors).toContain(`Duplicate scenario id: ${SCENARIOS[0].id}`);
  });

  it('rejects invalid byDay (<= 0 or non-finite)', () => {
    const badByDayScenario: Scenario = {
      ...SCENARIOS[0],
      goal: {
        ...SCENARIOS[0].goal,
        byDay: 0,
      },
    };
    const errors = validateScenario(badByDayScenario);
    expect(errors).toContain('Goal byDay must be a finite number > 0');
  });

  it('rejects invalid target (< 0 or non-finite)', () => {
    const badTargetScenario: Scenario = {
      ...SCENARIOS[0],
      goal: {
        ...SCENARIOS[0].goal,
        target: -10,
      },
    };
    const errors = validateScenario(badTargetScenario);
    expect(errors).toContain('Goal target must be a finite number >= 0');

    const nanTargetScenario: Scenario = {
      ...SCENARIOS[0],
      goal: {
        ...SCENARIOS[0].goal,
        target: NaN,
      },
    };
    expect(validateScenario(nanTargetScenario)).toContain('Goal target must be a finite number >= 0');
  });

  it('rejects transfer_share target outside 0..1', () => {
    const badShareScenario: Scenario = {
      id: 'bad-transfer',
      name: 'Bad Transfer',
      blurb: 'Testing share target out of bounds',
      constraints: {},
      goal: {
        kind: 'transfer_share',
        target: 1.5,
        byDay: 10,
      },
    };
    const errors = validateScenario(badShareScenario);
    expect(errors).toContain('Goal target for transfer_share must be between 0 and 1');
  });

  it('rejects nightRevenueShare constraint outside 0..1', () => {
    const badNightShareScenario: Scenario = {
      id: 'bad-night-share',
      name: 'Bad Night Share',
      blurb: 'Testing night revenue share out of bounds',
      constraints: {
        nightRevenueShare: 1.2,
      },
      goal: {
        kind: 'night_revenue',
        target: 5000,
        byDay: 10,
      },
    };
    const errors = validateScenario(badNightShareScenario);
    expect(errors).toContain('nightRevenueShare must be a number between 0 and 1');
  });

  it('rejects missing or empty string fields', () => {
    const emptyIdScenario: Scenario = {
      id: '',
      name: 'No ID',
      blurb: 'Missing ID string',
      constraints: {},
      goal: {
        kind: 'pax_per_day',
        target: 100,
        byDay: 5,
      },
    };
    const errors = validateScenario(emptyIdScenario);
    expect(errors).toContain('Scenario id must be a non-empty string');
  });

  it('rejects unknown goal kinds', () => {
    const unknownKindScenario = {
      id: 'unknown-kind',
      name: 'Unknown Kind',
      blurb: 'Testing unknown goal kind',
      constraints: {},
      goal: {
        kind: 'fly_to_moon' as unknown as Scenario['goal']['kind'],
        target: 100,
        byDay: 5,
      },
    };
    const errors = validateScenario(unknownKindScenario as Scenario);
    expect(errors).toContain('Invalid goal kind: fly_to_moon');
  });
});
