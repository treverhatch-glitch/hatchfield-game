export interface CrossingEvent {
  aircraftId: string;
  crossing: string;
  t0: number;
  t1: number;
}

export interface RunwayOccupancy {
  t0: number;
  t1: number;
  runwayId?: string;
}

export interface CrossingConflict {
  type: 'crossing-crossing' | 'crossing-runway';
  aircraftId1: string;
  aircraftId2?: string;
  crossing: string;
  runwayId?: string;
  overlapStart: number;
  overlapEnd: number;
}

function sanitizeTime(t: number): number {
  return typeof t === 'number' && !Number.isNaN(t) ? t : 0;
}

export function detectConflicts(
  events: CrossingEvent[] = [],
  runwayOcc: RunwayOccupancy[] = []
): CrossingConflict[] {
  const conflicts: CrossingConflict[] = [];

  if (!Array.isArray(events) || events.length === 0) {
    return conflicts;
  }

  // 1. Check crossing vs crossing conflicts
  for (let i = 0; i < events.length; i++) {
    const e1 = events[i];
    if (!e1) continue;
    const t0_1 = sanitizeTime(e1.t0);
    const t1_1 = sanitizeTime(e1.t1);
    if (t1_1 <= t0_1) continue; // Invalid or point interval (edge-touching with 0 length)

    for (let j = i + 1; j < events.length; j++) {
      const e2 = events[j];
      if (!e2) continue;

      // Only conflicts if crossing the same point / taxiway crossing
      if (e1.crossing !== e2.crossing) continue;

      const t0_2 = sanitizeTime(e2.t0);
      const t1_2 = sanitizeTime(e2.t1);
      if (t1_2 <= t0_2) continue;

      // Check strict interior overlap: max(t0_1, t0_2) < min(t1_1, t1_2)
      const overlapStart = Math.max(t0_1, t0_2);
      const overlapEnd = Math.min(t1_1, t1_2);

      if (overlapStart < overlapEnd) {
        conflicts.push({
          type: 'crossing-crossing',
          aircraftId1: e1.aircraftId,
          aircraftId2: e2.aircraftId,
          crossing: e1.crossing,
          overlapStart,
          overlapEnd,
        });
      }
    }
  }

  // 2. Check crossing vs runway occupancy conflicts
  if (Array.isArray(runwayOcc) && runwayOcc.length > 0) {
    for (const e of events) {
      if (!e) continue;
      const t0_e = sanitizeTime(e.t0);
      const t1_e = sanitizeTime(e.t1);
      if (t1_e <= t0_e) continue;

      for (const r of runwayOcc) {
        if (!r) continue;
        const t0_r = sanitizeTime(r.t0);
        const t1_r = sanitizeTime(r.t1);
        if (t1_r <= t0_r) continue;

        const overlapStart = Math.max(t0_e, t0_r);
        const overlapEnd = Math.min(t1_e, t1_r);

        if (overlapStart < overlapEnd) {
          conflicts.push({
            type: 'crossing-runway',
            aircraftId1: e.aircraftId,
            crossing: e.crossing,
            runwayId: r.runwayId,
            overlapStart,
            overlapEnd,
          });
        }
      }
    }
  }

  return conflicts;
}
