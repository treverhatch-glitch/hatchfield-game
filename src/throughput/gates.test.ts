import { describe, expect, it } from 'vitest';
import type { AircraftClass } from './data';
import { allocateGates, getClassRank, type Flight, type Gate } from './gates';

// Simple deterministic seeded PRNG (Linear Congruential Generator)
function createSeededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('allocateGates', () => {
  it('correctly orders aircraft class ranks', () => {
    expect(getClassRank('small')).toBe(1);
    expect(getClassRank('regional')).toBe(2);
    expect(getClassRank('narrowbody')).toBe(3);
    expect(getClassRank('widebody')).toBe(4);
    expect(getClassRank('jumbo')).toBe(5);
    expect(getClassRank('small')).toBeLessThan(getClassRank('narrowbody'));
  });

  it('selects smallest fitting gate first', () => {
    const flights: Flight[] = [{ id: 'F1', cls: 'regional', arr: 0, dep: 60 }];
    const gates: Gate[] = [
      { id: 'G-wide', maxCls: 'widebody' },
      { id: 'G-reg', maxCls: 'regional' },
      { id: 'G-jumbo', maxCls: 'jumbo' },
    ];

    const res = allocateGates(flights, gates, 20);

    expect(res.assignments).toHaveLength(1);
    expect(res.assignments[0].gateId).toBe('G-reg');
    expect(res.unassigned).toHaveLength(0);
  });

  it('does not assign flight to a gate that is too small', () => {
    const flights: Flight[] = [{ id: 'F1', cls: 'widebody', arr: 0, dep: 60 }];
    const gates: Gate[] = [{ id: 'G-small', maxCls: 'small' }];

    const res = allocateGates(flights, gates, 20);

    expect(res.assignments).toHaveLength(0);
    expect(res.unassigned).toEqual(['F1']);
  });

  it('handles 30 random flights from a seeded RNG with no overlaps including buffer', () => {
    const rng = createSeededRng(42);
    const classes: AircraftClass[] = ['small', 'regional', 'narrowbody', 'widebody', 'jumbo'];

    // Generate 30 random flights
    const flights: Flight[] = Array.from({ length: 30 }, (_, i) => {
      const cls = classes[Math.floor(rng() * classes.length)];
      const arr = Math.floor(rng() * 1200); // 0 to 1200 minutes
      const turnaround = 30 + Math.floor(rng() * 60); // 30 to 90 min
      return {
        id: `FL-${i + 1}`,
        cls,
        arr,
        dep: arr + turnaround,
      };
    });

    const gates: Gate[] = [
      { id: 'G1', maxCls: 'small' },
      { id: 'G2', maxCls: 'regional' },
      { id: 'G3', maxCls: 'narrowbody' },
      { id: 'G4', maxCls: 'narrowbody' },
      { id: 'G5', maxCls: 'widebody' },
      { id: 'G6', maxCls: 'jumbo' },
    ];

    const bufferMin = 20;
    const res1 = allocateGates(flights, gates, bufferMin);
    const res2 = allocateGates(flights, gates, bufferMin);

    // 1. Determinism assertion
    expect(res1).toEqual(res2);

    // 2. Check no NaN in numeric properties
    for (const assign of res1.assignments) {
      expect(Number.isNaN(assign.arr)).toBe(false);
      expect(Number.isNaN(assign.dep)).toBe(false);
    }

    // 3. Verify gate capacity constraints
    const gateMap = new Map(gates.map((g) => [g.id, g]));
    const flightMap = new Map(flights.map((f) => [f.id, f]));

    for (const assign of res1.assignments) {
      const flight = flightMap.get(assign.flightId)!;
      const gate = gateMap.get(assign.gateId)!;
      expect(getClassRank(gate.maxCls)).toBeGreaterThanOrEqual(getClassRank(flight.cls));
    }

    // 4. Verify ZERO overlaps on any gate including buffer
    const assignmentsByGate = new Map<string, typeof res1.assignments>();
    for (const assign of res1.assignments) {
      const list = assignmentsByGate.get(assign.gateId) ?? [];
      list.push(assign);
      assignmentsByGate.set(assign.gateId, list);
    }

    for (const [, gateAssigns] of assignmentsByGate) {
      // Sort by arrival time
      gateAssigns.sort((a, b) => a.arr - b.arr);

      for (let i = 0; i < gateAssigns.length - 1; i++) {
        const current = gateAssigns[i];
        const next = gateAssigns[i + 1];

        // Next flight arrival must be at or after current departure + buffer
        const minAllowedArrival = current.dep + bufferMin;
        expect(next.arr).toBeGreaterThanOrEqual(minAllowedArrival);
      }
    }
  });
});
