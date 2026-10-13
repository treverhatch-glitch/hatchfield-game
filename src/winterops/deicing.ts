import type {
  Departure,
  Pad,
  WeatherState,
  DeicingAssignment,
  ScheduleDeicingResult,
  AircraftClass,
} from './types';
import {
  DEICE_TEMP_THRESHOLD_C,
  DEICE_MINUTES_PER_CLASS,
  GLYCOL_LITRES_PER_CLASS,
  CLASS_HIERARCHY,
} from './data';
import type { GlycolStock } from './glycol';

export function needsDeicing(w?: WeatherState | null): boolean {
  if (!w || typeof w.tempC !== 'number' || Number.isNaN(w.tempC)) {
    return false;
  }
  if (w.precip === 'none' || !w.precip) {
    return false;
  }
  return w.tempC <= DEICE_TEMP_THRESHOLD_C;
}

function canPadFitClass(padMaxCls: AircraftClass, aircraftCls: AircraftClass): boolean {
  const padRank = CLASS_HIERARCHY[padMaxCls] ?? 0;
  const aircraftRank = CLASS_HIERARCHY[aircraftCls] ?? Infinity;
  return padRank >= aircraftRank;
}

export function scheduleDeicing(
  now: number,
  departures: Departure[],
  pads: Pad[],
  glycol: GlycolStock | number
): ScheduleDeicingResult {
  const safeNow = typeof now === 'number' && !Number.isNaN(now) ? now : 0;
  const assignments: DeicingAssignment[] = [];
  const waiting: string[] = [];
  let glycolUsed = 0;

  if (!departures || departures.length === 0) {
    return { assignments, waiting, glycolUsed };
  }

  if (!pads || pads.length === 0) {
    return {
      assignments,
      waiting: departures.map((d) => d.flightId),
      glycolUsed: 0,
    };
  }

  // Track pad busy end times
  const padNextAvailable = new Map<string, number>();
  for (const pad of pads) {
    const safeBusyUntil = typeof pad.busyUntil === 'number' && !Number.isNaN(pad.busyUntil)
      ? pad.busyUntil
      : safeNow;
    padNextAvailable.set(pad.id, Math.max(safeNow, safeBusyUntil));
  }

  // Helper to check available glycol without consuming
  const getAvailableGlycol = (): number => {
    if (typeof glycol === 'number') {
      return Number.isNaN(glycol) ? 0 : Math.max(0, glycol - glycolUsed);
    }
    if (glycol && typeof glycol.litres === 'number') {
      return Number.isNaN(glycol.litres) ? 0 : glycol.litres;
    }
    return 0;
  };

  // Helper to consume glycol
  const consumeGlycol = (amount: number): boolean => {
    if (typeof glycol === 'number') {
      const available = getAvailableGlycol();
      if (available >= amount) {
        glycolUsed += amount;
        return true;
      }
      return false;
    } else if (glycol && typeof glycol.consume === 'function') {
      const success = glycol.consume(amount);
      if (success) {
        glycolUsed += amount;
      }
      return success;
    }
    return false;
  };

  // Process departures in readyAt order (stable sort)
  const sortedDepartures = [...departures].sort((a, b) => {
    const readyA = typeof a.readyAt === 'number' && !Number.isNaN(a.readyAt) ? a.readyAt : safeNow;
    const readyB = typeof b.readyAt === 'number' && !Number.isNaN(b.readyAt) ? b.readyAt : safeNow;
    return readyA - readyB;
  });

  for (const dep of sortedDepartures) {
    const safeReadyAt = typeof dep.readyAt === 'number' && !Number.isNaN(dep.readyAt)
      ? dep.readyAt
      : safeNow;

    const duration = DEICE_MINUTES_PER_CLASS[dep.cls] ?? 10;
    const neededGlycol = GLYCOL_LITRES_PER_CLASS[dep.cls] ?? 400;

    // Check available glycol first
    if (getAvailableGlycol() < neededGlycol) {
      waiting.push(dep.flightId);
      continue;
    }

    // Filter candidate pads that fit departure class
    const candidatePads = pads.filter((p) => canPadFitClass(p.maxCls, dep.cls));
    if (candidatePads.length === 0) {
      waiting.push(dep.flightId);
      continue;
    }

    // Find best pad (earliest start time, tiebreak by earliest pad availability, then pad list order)
    let bestPad: Pad | null = null;
    let bestStart = Infinity;

    for (const pad of candidatePads) {
      const padAvail = padNextAvailable.get(pad.id) ?? safeNow;
      const possibleStart = Math.max(padAvail, safeReadyAt, safeNow);

      if (possibleStart < bestStart) {
        bestStart = possibleStart;
        bestPad = pad;
      } else if (possibleStart === bestStart && bestPad) {
        const bestPadAvail = padNextAvailable.get(bestPad.id) ?? safeNow;
        if (padAvail < bestPadAvail) {
          bestPad = pad;
        }
      }
    }

    if (!bestPad) {
      waiting.push(dep.flightId);
      continue;
    }

    // Consume glycol for assignment
    if (!consumeGlycol(neededGlycol)) {
      waiting.push(dep.flightId);
      continue;
    }

    const start = bestStart;
    const end = start + duration;
    padNextAvailable.set(bestPad.id, end);

    assignments.push({
      flightId: dep.flightId,
      padId: bestPad.id,
      start,
      end,
    });
  }

  return { assignments, waiting, glycolUsed };
}
