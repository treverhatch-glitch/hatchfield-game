/**
 * Calculates average queue wait time in minutes using an M/M/c queuing model approximation.
 * When utilization >= 1, uses a stable fallback function capped at 240 minutes.
 * Guarantees a non-negative, finite number (never NaN).
 *
 * @param arrivalsPerHr Passenger or bag arrival rate per hour
 * @param servers Number of active servers/lanes/desks
 * @param ratePerServerHr Processing capacity per server per hour
 */
export function queueWaitMinutes(
  arrivalsPerHr: number,
  servers: number,
  ratePerServerHr: number
): number {
  if (!Number.isFinite(arrivalsPerHr) || arrivalsPerHr <= 0) {
    return 0;
  }

  const safeServers = Number.isFinite(servers) ? Math.max(0, servers) : 0;
  const safeRate = Number.isFinite(ratePerServerHr) ? Math.max(0, ratePerServerHr) : 0;

  if (safeServers <= 0 || safeRate <= 0) {
    return 240;
  }

  const c = Math.max(1, Math.floor(safeServers));
  const mu = safeRate;
  const lambda = arrivalsPerHr;
  const totalCapacity = c * mu;
  const rho = lambda / totalCapacity;

  if (rho >= 0.98) {
    // Saturated or near-saturated fallback calculation
    // Scale smoothly from ~30 min at rho=0.98 up to 240 min cap
    const baseWait = 30;
    const overflowWait = (rho - 0.98) * 150;
    const totalWait = baseWait + overflowWait;
    return Math.min(240, Math.max(0, Number.isFinite(totalWait) ? totalWait : 240));
  }

  // M/M/c Erlang-C calculation for unsaturated system (rho < 0.98)
  const r = lambda / mu; // Traffic intensity in Erlangs

  // Calculate sum_{k=0}^{c-1} (r^k / k!)
  let sum = 0;
  let term = 1; // r^0 / 0!
  sum += term;

  for (let k = 1; k < c; k++) {
    term = (term * r) / k;
    sum += term;
  }

  // Term for k = c: (r^c / c!)
  const termC = (term * r) / c;

  // Erlang C formula: P_C = (termC / (1 - rho)) / (sum + termC / (1 - rho))
  const geomSum = termC / (1 - rho);
  const p0 = 1 / (sum + geomSum);
  const pC = geomSum * p0;

  // W_q in hours = pC / (c * mu - lambda)
  const waitHours = pC / (totalCapacity - lambda);
  const waitMinutes = waitHours * 60;

  if (!Number.isFinite(waitMinutes) || waitMinutes < 0) {
    return 0;
  }

  return Math.min(240, Math.max(0, waitMinutes));
}
