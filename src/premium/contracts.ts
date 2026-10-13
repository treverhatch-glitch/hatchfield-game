import type { ServiceKind } from '../contracts/types.ts'
import type { AirlineServiceProfile } from './types.ts'

/** Optional contract services a tier 4–5 or luxury passenger airline may require. */
export const PREMIUM_CONTRACT_SERVICES = ['fast_track', 'premium_checkin'] as const
export type PremiumContractService = (typeof PREMIUM_CONTRACT_SERVICES)[number]

export function airlineMayRequirePremium(airline: AirlineServiceProfile): boolean {
  if (airline.kind === 'cargo') return false
  if (airline.persona === 'luxury') return true
  return (airline.tier ?? 0) >= 4
}

/** Both services are optional. Qualifying airlines may require either, neither, or both. */
export function optionalPremiumServices(airline: AirlineServiceProfile): PremiumContractService[] {
  if (!airlineMayRequirePremium(airline)) return []
  return ['fast_track', 'premium_checkin']
}

export function attachOptionalServices(
  services: readonly ServiceKind[],
  airline: AirlineServiceProfile,
  want: { fastTrack?: boolean; premiumCheckin?: boolean } = {},
): ServiceKind[] {
  const allowed = new Set<ServiceKind>(optionalPremiumServices(airline))
  const next = services.filter(
    (service) => (service !== 'fast_track' && service !== 'premium_checkin') || allowed.has(service),
  )
  if (want.fastTrack && allowed.has('fast_track') && !next.includes('fast_track')) next.push('fast_track')
  if (want.premiumCheckin && allowed.has('premium_checkin') && !next.includes('premium_checkin')) {
    next.push('premium_checkin')
  }
  return next
}
