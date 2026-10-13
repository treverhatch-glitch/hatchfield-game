import { AIRCRAFT_CLASS_RANK, DEFAULT_GATE_BUFFER_MIN, type AircraftClass } from './data';

export interface Flight {
  id: string;
  cls: AircraftClass | string;
  arr: number;
  dep: number;
}

export interface Gate {
  id: string;
  maxCls: AircraftClass | string;
}

export interface GateAssignment {
  flightId: string;
  gateId: string;
  arr: number;
  dep: number;
}

export interface GateAllocationResult {
  assignments: GateAssignment[];
  unassigned: string[];
}

/**
 * Gets the numeric rank for an aircraft class.
 * Higher rank means larger aircraft.
 */
export function getClassRank(cls: AircraftClass | string): number {
  if (typeof cls === 'string' && cls in AIRCRAFT_CLASS_RANK) {
    return AIRCRAFT_CLASS_RANK[cls as AircraftClass];
  }
  if (typeof cls === 'number') {
    return cls;
  }
  const parsed = Number.parseInt(String(cls), 10);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return 1;
}

/**
 * Allocates gates to flights greedily by arrival time, assigning the smallest fitting gate first.
 * Ensures flights do not overlap at any gate, accounting for the turnaround buffer.
 *
 * @param flights List of flights with arrival, departure, and aircraft class
 * @param gates List of available gates with maximum supported aircraft class
 * @param bufferMin Turnaround buffer in minutes (default 20 min)
 */
export function allocateGates(
  flights: Flight[],
  gates: Gate[],
  bufferMin: number = DEFAULT_GATE_BUFFER_MIN
): GateAllocationResult {
  const safeBuffer = Number.isFinite(bufferMin) ? Math.max(0, bufferMin) : DEFAULT_GATE_BUFFER_MIN;
  const safeFlights = Array.isArray(flights) ? [...flights] : [];
  const safeGates = Array.isArray(gates) ? [...gates] : [];

  if (safeFlights.length === 0 || safeGates.length === 0) {
    return {
      assignments: [],
      unassigned: safeFlights.map((f) => f.id),
    };
  }

  // Sort flights greedily by arrival time, with deterministic tie-breakers
  sortedFlightsAscending(safeFlights);

  // Track assigned intervals for each gate: gateId -> list of [arr, dep + buffer]
  const gateSchedules = new Map<string, { arr: number; depWithBuffer: number }[]>();
  for (const gate of safeGates) {
    gateSchedules.set(gate.id, []);
  }

  const assignments: GateAssignment[] = [];
  const unassigned: string[] = [];

  for (const flight of safeFlights) {
    const flightRank = getClassRank(flight.cls);
    const flightArr = Number.isFinite(flight.arr) ? flight.arr : 0;
    const flightDep = Number.isFinite(flight.dep) ? flight.dep : flightArr;
    const flightDepWithBuffer = flightDep + safeBuffer;

    // Filter gates that can fit the flight's size class
    const fittingGates = safeGates.filter((gate) => getClassRank(gate.maxCls) >= flightRank);

    // Filter fitting gates that are free during [flightArr, flightDepWithBuffer)
    const availableGates = fittingGates.filter((gate) => {
      const schedule = gateSchedules.get(gate.id) ?? [];
      for (const existing of schedule) {
        // Overlap condition: max(arr1, arr2) < min(dep1, dep2)
        const maxArr = Math.max(flightArr, existing.arr);
        const minDep = Math.min(flightDepWithBuffer, existing.depWithBuffer);
        if (maxArr < minDep) {
          return false; // Overlaps!
        }
      }
      return true;
    });

    if (availableGates.length === 0) {
      unassigned.push(flight.id);
      continue;
    }

    // Select the smallest fitting gate (lowest maxCls rank, preserving list order on tie)
    availableGates.sort((a, b) => {
      const rankA = getClassRank(a.maxCls);
      const rankB = getClassRank(b.maxCls);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      // Preserve original gate list index for deterministic tie-breaking
      return safeGates.indexOf(a) - safeGates.indexOf(b);
    });

    const chosenGate = availableGates[0];

    // Record assignment
    assignments.push({
      flightId: flight.id,
      gateId: chosenGate.id,
      arr: flightArr,
      dep: flightDep,
    });

    // Update gate schedule
    const schedule = gateSchedules.get(chosenGate.id) ?? [];
    schedule.push({ arr: flightArr, depWithBuffer: flightDepWithBuffer });
    gateSchedules.set(chosenGate.id, schedule);
  }

  return { assignments, unassigned };
}

function sortedFlightsAscending(flights: Flight[]): void {
  flights.sort((a, b) => {
    const arrA = Number.isFinite(a.arr) ? a.arr : 0;
    const arrB = Number.isFinite(b.arr) ? b.arr : 0;
    if (arrA !== arrB) {
      return arrA - arrB;
    }
    const depA = Number.isFinite(a.dep) ? a.dep : 0;
    const depB = Number.isFinite(b.dep) ? b.dep : 0;
    if (depA !== depB) {
      return depA - depB;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}
