import type { ConnectionFail } from './types.ts'

/** Running totals for connections judged this session. */
export interface ConnectionTally {
  made: number
  belowMct: number
  paxLate: number
  bagLate: number
  divert: number
  /** Sum of inbound delay, game-minutes, over judged landings. */
  delayMin: number
  /** Sum of minutes between landing and the sold departure. */
  availableMin: number
  /** Sum of bag-transfer minutes. */
  bagMin: number
  judged: number
  /** Delay buckets, game-minutes: 0, 1–60, 61–120, 121–240, more. */
  delayBuckets: [number, number, number, number, number]
}

export type ConnectionMissReason = 'below_mct' | 'pax_late' | 'bag_late' | 'divert'

export interface ConnectionMissDetail {
  reason: ConnectionMissReason
  delayMin: number
  available: number
  needed: number
  mct: number
}

export function emptyConnectionTally(): ConnectionTally {
  return {
    made: 0,
    belowMct: 0,
    paxLate: 0,
    bagLate: 0,
    divert: 0,
    delayMin: 0,
    availableMin: 0,
    bagMin: 0,
    judged: 0,
    delayBuckets: [0, 0, 0, 0, 0],
  }
}

export function connectionAttempts(tally: ConnectionTally): number {
  return tally.made + tally.belowMct + tally.paxLate + tally.bagLate + tally.divert
}

export function connectionMisses(tally: ConnectionTally): number {
  return tally.belowMct + tally.paxLate + tally.bagLate + tally.divert
}

/** Miss share, or null when nothing has been judged. */
export function connectionMissRate(tally: ConnectionTally): number | null {
  const attempts = connectionAttempts(tally)
  if (attempts <= 0) return null
  return connectionMisses(tally) / attempts
}

function bucket(delayMin: number): 0 | 1 | 2 | 3 | 4 {
  if (!(delayMin > 0)) return 0
  if (delayMin <= 60) return 1
  if (delayMin <= 120) return 2
  if (delayMin <= 240) return 3
  return 4
}

/** Record one judged connection. Mutates the tally. */
export function recordConnection(
  tally: ConnectionTally,
  reason: ConnectionFail | 'divert',
  sample?: { delayMin: number; available: number; bagMin: number },
): void {
  if (reason === 'ok') tally.made += 1
  else if (reason === 'below_mct') tally.belowMct += 1
  else if (reason === 'pax_late') tally.paxLate += 1
  else if (reason === 'bag_late') tally.bagLate += 1
  else tally.divert += 1
  if (reason === 'divert' || !sample) return
  tally.judged += 1
  const delay = Number.isFinite(sample.delayMin) ? Math.max(0, sample.delayMin) : 0
  tally.delayMin += delay
  tally.availableMin += Number.isFinite(sample.available) ? sample.available : 0
  tally.bagMin += Number.isFinite(sample.bagMin) ? sample.bagMin : 0
  tally.delayBuckets[bucket(delay)] += 1
}

export function dominantMiss(tally: ConnectionTally): ConnectionMissReason | null {
  const rows: [ConnectionMissReason, number][] = [
    ['below_mct', tally.belowMct],
    ['bag_late', tally.bagLate],
    ['pax_late', tally.paxLate],
    ['divert', tally.divert],
  ]
  rows.sort((a, b) => b[1] - a[1])
  return rows[0] && rows[0][1] > 0 ? rows[0][0] : null
}

export function connectionCauseSentence(detail: ConnectionMissDetail): string {
  const delay = Math.max(0, Math.round(detail.delayMin))
  const available = Math.max(0, Math.round(detail.available))
  const needed = Math.max(0, Math.round(detail.needed))
  if (detail.reason === 'divert') return 'The inbound diverted, so its connectors never reached a gate.'
  if (detail.reason === 'bag_late') {
    return `Bags needed ${needed} min on the belt and the window was ${available} min.`
  }
  if (detail.reason === 'pax_late') {
    return `The walk between gates needed ${needed} min and the window was ${available} min.`
  }
  return `Inbound was ${delay} min late, inside the ${Math.round(detail.mct)} min minimum connection.`
}

export function connectionHint(reason: ConnectionMissReason): string {
  if (reason === 'bag_late') {
    return 'A transfer centre or an RFID bag line shortens the belt. Distant gates need a ride.'
  }
  if (reason === 'pax_late') {
    return 'Gates are too far for this window. A people mover, a transfer bus, or a shorter pier fixes the walk.'
  }
  if (reason === 'divert') return 'A diverted arrival misses every connection on that flight.'
  return 'The bank slipped. Security, the curb, and the runway are what push an inbound inside the minimum.'
}

/** Lines under the connection map. Empty until the first connection is judged. */
export function connectionReportLines(tally: ConnectionTally, last: ConnectionMissDetail | null): string[] {
  const attempts = connectionAttempts(tally)
  if (attempts <= 0) return []
  const missed = connectionMisses(tally)
  const pct = Math.round((100 * missed) / attempts)
  const lines = [
    `Made ${tally.made} of ${attempts} · ${pct}% missed`,
    `Late inbound ${tally.belowMct} · bags ${tally.bagLate} · walk ${tally.paxLate} · diverted ${tally.divert}`,
  ]
  const lead = dominantMiss(tally)
  if (lead && missed > 0) lines.push(connectionHint(lead))
  if (last && missed > 0) lines.push(connectionCauseSentence(last))
  return lines
}
