/**
 * Spot tanker and term-band tunables.
 * The sim tank (`tankLitres`) is the only stock these numbers fill.
 */

export const SPOT_OFFER = {
  supplier: 'Apex rack',
  /** Dollars per litre. Higher than every term. */
  perLitre: 0.03,
  tankerLitres: 36_000,
  /** Game minutes from accept to the farm gate. */
  leadMinutes: 90,
  /** Sim seconds the phone card stays up. Long enough to read at 1×. */
  deadlineSeconds: 60,
  /** Sim seconds before the next card after a decline or an expiry. */
  coolSeconds: 20,
  /** Untaken term litres are billed at this share of the term price. */
  shortfallFraction: 0.4,
} as const

/** Daily litres a signed term promises. Shortfall is the gap at midnight. */
export const TERM_BANDS: Record<string, number> = {
  apex_local: 80_000,
  kiln_regional: 200_000,
  trunk_wide: 600_000,
  mega_jumbo: 1_600_000,
}

export interface SpotOffer {
  flightNo: string
  flightId: string
  /** Sim clock when the card closes. */
  expiresAt: number
  /** Supplier who called. Missing on older saves; the Apex rack is the fallback. */
  supplierId?: string
  supplier?: string
  /** Frozen $/L, including the index and that supplier's differential. */
  perLitre?: number
}

export interface SpotInbound {
  litres: number
  perLitre: number
  /** Game minutes still to the farm. Zero means it is at the gate. */
  minutesLeft: number
  waitNoted: boolean
  /** Who called. Missing on older saves. */
  supplier?: string
}

/** The wing bill still reads a brand. Trunk and Mega use the Kiln pump table. */
export function brandForContract(id: string): 'apex' | 'kiln' | null {
  if (id === 'apex_local') return 'apex'
  if (id === 'kiln_regional' || id === 'trunk_wide' || id === 'mega_jumbo') return 'kiln'
  return null
}

export function termBandLitres(id: string | null | undefined): number {
  if (!id) return 0
  return TERM_BANDS[id] ?? 0
}
