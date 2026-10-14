import { DEFAULT_VOUCHER_TERMS, MEAL_VOUCHER, REBOOK_HANDLING } from './config.ts'
import type {
  RebookDeparture,
  RebookResult,
  StrandCause,
  StrandedGroup,
  VoucherPayer,
  VoucherTerms,
} from './types.ts'

/** Contract term wins; otherwise airline-caused disruption is the airline's bill. */
export function voucherPayer(cause: StrandCause, terms?: Partial<VoucherTerms> | null): VoucherPayer {
  return terms?.[cause] ?? DEFAULT_VOUCHER_TERMS[cause]
}

/**
 * Rebook stranded groups onto later departures of the same airline, earliest
 * first, until seats run out or the night cutoff passes. Anyone left over
 * stays the night and needs a hotel voucher. Seat counts are consumed, so
 * two groups never share the same empty seat.
 */
export function rebookStranded(
  groups: readonly StrandedGroup[],
  departures: readonly RebookDeparture[],
  opts: { cutoff: number; terms?: (airlineId: string) => Partial<VoucherTerms> | null | undefined },
): RebookResult[] {
  const seats = new Map<string, number>()
  for (const dep of departures) seats.set(dep.id, Math.max(0, Math.floor(dep.seatsFree)))
  const sorted = [...departures]
    .filter((d) => Number.isFinite(d.at))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const results: RebookResult[] = []
  const ordered = [...groups].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  for (const group of ordered) {
    let left = Number.isFinite(group.pax) ? Math.max(0, Math.floor(group.pax)) : 0
    const total = left
    const flights: string[] = []
    const taken: Record<string, number> = {}
    for (const dep of sorted) {
      if (left <= 0) break
      if (dep.airlineId !== group.airlineId || dep.at <= group.at || dep.at > opts.cutoff) continue
      const free = seats.get(dep.id) ?? 0
      if (free <= 0) continue
      const take = Math.min(free, left)
      seats.set(dep.id, free - take)
      left -= take
      flights.push(dep.id)
      taken[dep.id] = take
    }
    const sameDay = total - left
    results.push({
      groupId: group.id,
      airlineId: group.airlineId,
      cause: group.cause,
      payer: voucherPayer(group.cause, opts.terms?.(group.airlineId)),
      sameDay,
      overnight: left,
      flights,
      taken,
      handling: total * REBOOK_HANDLING + sameDay * MEAL_VOUCHER,
    })
  }
  return results
}
