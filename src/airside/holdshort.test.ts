import { describe, it, expect } from 'vitest';
import { detectConflicts } from './holdshort';

describe('Hold-Short Conflicts', () => {
  it('detects overlapping taxiway crossings at the same hold-short location', () => {
    const events = [
      { aircraftId: 'AC101', crossing: 'HS-27L-A', t0: 10, t1: 20 },
      { aircraftId: 'AC102', crossing: 'HS-27L-A', t0: 15, t1: 25 },
    ];

    const conflicts = detectConflicts(events);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'crossing-crossing',
      aircraftId1: 'AC101',
      aircraftId2: 'AC102',
      crossing: 'HS-27L-A',
      overlapStart: 15,
      overlapEnd: 20,
    });
  });

  it('handles edge-touching intervals without false positive conflicts', () => {
    const events = [
      { aircraftId: 'AC101', crossing: 'HS-27L-A', t0: 10, t1: 20 },
      { aircraftId: 'AC102', crossing: 'HS-27L-A', t0: 20, t1: 30 },
    ];

    const conflicts = detectConflicts(events);
    expect(conflicts).toHaveLength(0);
  });

  it('does not detect conflicts for crossings at different hold-short locations', () => {
    const events = [
      { aircraftId: 'AC101', crossing: 'HS-27L-A', t0: 10, t1: 20 },
      { aircraftId: 'AC102', crossing: 'HS-27L-B', t0: 15, t1: 25 },
    ];

    const conflicts = detectConflicts(events);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflicts between aircraft crossing and runway occupancy', () => {
    const events = [
      { aircraftId: 'AC101', crossing: 'HS-09R-C', t0: 10, t1: 30 },
    ];
    const runwayOcc = [
      { runwayId: 'RWY-09R', t0: 20, t1: 40 },
    ];

    const conflicts = detectConflicts(events, runwayOcc);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'crossing-runway',
      aircraftId1: 'AC101',
      crossing: 'HS-09R-C',
      runwayId: 'RWY-09R',
      overlapStart: 20,
      overlapEnd: 30,
    });
  });

  it('handles multiple overlapping events and edge cases safely without NaN', () => {
    const events = [
      { aircraftId: 'AC1', crossing: 'A', t0: 0, t1: 10 },
      { aircraftId: 'AC2', crossing: 'A', t0: 5, t1: 15 },
      { aircraftId: 'AC3', crossing: 'A', t0: 8, t1: 12 },
      { aircraftId: 'AC4', crossing: 'A', t0: NaN as any, t1: 5 },
    ];

    const conflicts = detectConflicts(events);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.every(c => !Number.isNaN(c.overlapStart) && !Number.isNaN(c.overlapEnd))).toBe(true);
  });
});
