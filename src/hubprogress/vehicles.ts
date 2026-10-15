/**
 * Dedicated turnaround vehicles. A lease takes one unit out of the common
 * pool. The truck is one the player already fields. Upkeep stays on the spec.
 */
import { HUB_TIERS, VEHICLE_NEED, VEHICLE_ROLES, type HubArchetype, type HubOfferTier, type HubTier, type VehicleRole } from './config.ts'

export const VEHICLE_ROLE_TYPES: Record<VehicleRole, readonly string[]> = {
  tug: ['pushback_tug', 'heavy_tug'],
  belt: ['belt_loader', 'uld_loader', 'main_deck_loader'],
  catering: ['catering_truck', 'highlift_catering'],
  fuelTruck: ['fuel_truck', 'heavy_fuel_truck', 'hydrant_dispenser'],
}

export const VEHICLE_ROLE_LABEL: Record<VehicleRole, string> = {
  tug: 'tug',
  belt: 'belt loader',
  catering: 'catering truck',
  fuelTruck: 'fuel truck',
}

export interface VehicleLease {
  id: string
  role: VehicleRole
  type: string
  airlineId: string
  primary: string
  secondary: string
}

export function isVehicleRole(value: unknown): value is VehicleRole {
  return typeof value === 'string' && (VEHICLE_ROLES as readonly string[]).includes(value)
}

export function vehicleLeaseId(type: string, index: number): string {
  return `veh:${type}:${index}`
}

/** Ground-sim id for the same unit. Logistics numbers trucks `type-n`. */
export function groundVehicleId(type: string, index: number): string {
  return `${type}-${index}`
}

export function parseGroundVehicleId(id: string): { type: string; index: number } | null {
  const cut = id.lastIndexOf('-')
  if (cut <= 0) return null
  const type = id.slice(0, cut)
  const index = Number(id.slice(cut + 1))
  if (!type || !Number.isInteger(index) || index < 1) return null
  return { type, index }
}

export function roleOfType(type: string): VehicleRole | null {
  for (const role of VEHICLE_ROLES) {
    if ((VEHICLE_ROLE_TYPES[role] as readonly string[]).includes(type)) return role
  }
  return null
}

export function vehicleNeedFor(type: HubArchetype, tier: HubOfferTier): Partial<Record<VehicleRole, number>> {
  const out: Partial<Record<VehicleRole, number>> = {}
  const ceiling = HUB_TIERS.indexOf(tier)
  for (const step of ['focus', 'base', 'hub', 'primary'] as const) {
    if (HUB_TIERS.indexOf(step) > ceiling) break
    const row = VEHICLE_NEED[type]?.[step]
    if (!row) continue
    for (const role of VEHICLE_ROLES) {
      const need = row[role] ?? 0
      if (need > (out[role] ?? 0)) out[role] = need
    }
  }
  return out
}

export function vehicleCounts(leases: readonly VehicleLease[]): Partial<Record<VehicleRole, number>> {
  const out: Partial<Record<VehicleRole, number>> = {}
  for (const lease of leases) out[lease.role] = (out[lease.role] ?? 0) + 1
  return out
}

export function spareIndex(type: string, owned: number, leases: readonly VehicleLease[]): number | null {
  const taken = new Set(leases.filter((lease) => lease.type === type).map((lease) => lease.id))
  const count = Number.isFinite(owned) ? Math.max(0, Math.floor(owned)) : 0
  for (let index = 1; index <= count; index++) {
    if (!taken.has(vehicleLeaseId(type, index))) return index
  }
  return null
}

export function firstSpare(
  role: VehicleRole,
  fleet: Readonly<Record<string, number>>,
  leases: readonly VehicleLease[],
): { type: string; index: number } | null {
  for (const type of VEHICLE_ROLE_TYPES[role]) {
    const index = spareIndex(type, fleet[type] ?? 0, leases)
    if (index != null) return { type, index }
  }
  return null
}

export function liveVehicleLeases(leases: readonly VehicleLease[], fleet: Readonly<Record<string, number>>): VehicleLease[] {
  return leases.filter((lease) => {
    const index = Number(lease.id.split(':')[2])
    return Number.isFinite(index) && index >= 1 && index <= Math.floor(fleet[lease.type] ?? 0)
  })
}

export function vehicleAskMet(
  type: HubArchetype,
  tier: HubTier,
  counts: Partial<Record<VehicleRole, number>>,
): boolean {
  if (tier === 'station') return true
  const ask = vehicleNeedFor(type, tier)
  return VEHICLE_ROLES.every((role) => (counts[role] ?? 0) >= (ask[role] ?? 0))
}

export function vehicleReleaseBreaks(
  type: HubArchetype,
  tier: HubTier,
  role: VehicleRole,
  haveAfter: number,
): boolean {
  if (tier === 'station') return false
  const need = vehicleNeedFor(type, tier)[role] ?? 0
  return need > 0 && haveAfter < need
}

export function dedicateVehicleLabel(role: VehicleRole): string {
  return `Dedicate a ${VEHICLE_ROLE_LABEL[role]}`
}

export function vehicleBlock(role: VehicleRole, spare: boolean): string | null {
  if (spare) return null
  return `No spare ${VEHICLE_ROLE_LABEL[role]}`
}

export function releaseVehicleLabel(role: VehicleRole): string {
  return `Release the ${VEHICLE_ROLE_LABEL[role]}`
}
