export type AirlineKind = 'regional' | 'flag' | 'lowcost'
export type AirlineDeposit = 'big' | 'standard' | 'small'

export interface AirlineDef {
  id: string
  name: string
  /** 2 uppercase letters, unique across all airlines */
  iata: string
  kind: AirlineKind
  /** Tier 1-5 */
  tier: number
  /** Airframe IDs from AIRFRAMES in src/game/airframes.ts */
  fleet: string[]
  /** Fee tolerance range: 0.8 to 1.4 */
  feeTolerance: number
  deposit: AirlineDeposit
  leadDays: number
  minFL: number
  /** Required services such as fast_track, premium_checkin, catering, deicing */
  needs: string[]
  blurb: string
}

export function validateAirline(
  a: AirlineDef,
  airframeIds?: string[] | Set<string> | Record<string, unknown>,
): string[] {
  const errors: string[] = []

  if (!a.id || typeof a.id !== 'string') {
    errors.push('id must be a non-empty string')
  }
  if (!a.name || typeof a.name !== 'string') {
    errors.push('name must be a non-empty string')
  }
  if (!a.iata || typeof a.iata !== 'string' || !/^[A-Z]{2}$/.test(a.iata)) {
    errors.push('iata must be a 2-letter uppercase string')
  }
  if (!['regional', 'flag', 'lowcost'].includes(a.kind)) {
    errors.push('kind must be "regional", "flag", or "lowcost"')
  }
  if (typeof a.tier !== 'number' || a.tier < 1 || a.tier > 5 || !Number.isInteger(a.tier)) {
    errors.push('tier must be an integer between 1 and 5')
  }
  if (!Array.isArray(a.fleet) || a.fleet.length === 0) {
    errors.push('fleet must be a non-empty array of strings')
  } else if (airframeIds) {
    let validIds: Set<string>
    if (airframeIds instanceof Set) {
      validIds = airframeIds
    } else if (Array.isArray(airframeIds)) {
      validIds = new Set(airframeIds)
    } else {
      validIds = new Set(Object.keys(airframeIds))
    }
    for (const f of a.fleet) {
      if (!validIds.has(f)) {
        errors.push(`fleet contains unknown airframe id: "${f}"`)
      }
    }
  }
  if (typeof a.feeTolerance !== 'number' || a.feeTolerance < 0.8 || a.feeTolerance > 1.4) {
    errors.push('feeTolerance must be a number between 0.8 and 1.4')
  }
  if (!['big', 'standard', 'small'].includes(a.deposit)) {
    errors.push('deposit must be "big", "standard", or "small"')
  }
  if (typeof a.leadDays !== 'number' || a.leadDays < 0) {
    errors.push('leadDays must be a non-negative number')
  }
  if (typeof a.minFL !== 'number' || a.minFL < 0) {
    errors.push('minFL must be a non-negative number')
  }
  if (!Array.isArray(a.needs)) {
    errors.push('needs must be an array of strings')
  }
  if (!a.blurb || typeof a.blurb !== 'string') {
    errors.push('blurb must be a non-empty string')
  }

  return errors
}
