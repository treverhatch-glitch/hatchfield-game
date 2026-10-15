import { SECURITY_TECH_RATES, type SecurityTech } from './data';
import { queueWaitMinutes } from './queue';

export interface SecurityLaneConfig {
  tech: SecurityTech;
  open: boolean;
  /** Measured pax/hr for this lane. Replaces the tech's table rate when the live walk knows better. */
  ratePerHr?: number;
}

export interface SecurityPlanResult {
  totalLanes: number;
  openLanes: number;
  capacity: number;
  paxPerHr: number;
  utilisation: number;
  waitMinutes: number;
  bottleneck: boolean;
}

function laneRate(lane: SecurityLaneConfig): number {
  if (typeof lane.ratePerHr === 'number' && Number.isFinite(lane.ratePerHr) && lane.ratePerHr > 0) return lane.ratePerHr;
  return SECURITY_TECH_RATES[lane.tech] ?? 0;
}

/**
 * Calculates security throughput plan including open lane capacity, utilisation, wait time, and bottleneck status.
 *
 * @param lanes List of security lanes with technology and open status
 * @param paxPerHr Total hourly passenger arrival rate
 */
export function securityPlan(
  lanes: SecurityLaneConfig[],
  paxPerHr: number
): SecurityPlanResult {
  const safePax = Number.isFinite(paxPerHr) ? Math.max(0, paxPerHr) : 0;
  const safeLanes = Array.isArray(lanes) ? lanes : [];

  const totalLanes = safeLanes.length;
  const openLanesList = safeLanes.filter((lane) => lane && lane.open);
  const openLanes = openLanesList.length;

  const capacity = openLanesList.reduce((sum, lane) => {
    return sum + laneRate(lane);
  }, 0);

  const utilisation = capacity > 0 ? safePax / capacity : safePax > 0 ? 1 : 0;

  let waitMinutes = 0;
  if (openLanes > 0 && capacity > 0) {
    const avgRatePerLane = capacity / openLanes;
    waitMinutes = queueWaitMinutes(safePax, openLanes, avgRatePerLane);
  } else if (safePax > 0) {
    waitMinutes = 240;
  }

  const bottleneck = utilisation >= 0.85 || waitMinutes >= 15;

  return {
    totalLanes,
    openLanes,
    capacity,
    paxPerHr: safePax,
    utilisation: Number.isFinite(utilisation) ? utilisation : 0,
    waitMinutes: Number.isFinite(waitMinutes) ? waitMinutes : 0,
    bottleneck,
  };
}
