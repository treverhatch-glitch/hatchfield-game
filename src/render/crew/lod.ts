import { CREW_LOD } from '../../ramp/crewConfig.ts'

export type CrewTier = 'full' | 'dot' | 'hide'

export interface LodPoint {
  id: string
  x: number
  y: number
  z: number
}

export interface LodPick {
  id: string
  tier: CrewTier
  distance: number
}

/**
 * Full figures near the camera, dots in the middle band, nothing past that.
 * The closest figures keep the limbs when more than `fullCap` are in range.
 * `lite` (5×) never spends a full figure.
 */
export function assignCrewLod(
  items: LodPoint[],
  cam: { x: number; y: number; z: number },
  lite = false,
  limits: { fullDistance: number; dotDistance: number; fullCap: number; dotCap: number } = CREW_LOD,
): LodPick[] {
  const ranked: LodPick[] = items.map((item) => {
    const distance = Math.hypot(item.x - cam.x, item.y - cam.y, item.z - cam.z)
    let tier: CrewTier = 'hide'
    if (distance <= limits.dotDistance) tier = 'dot'
    if (!lite && distance <= limits.fullDistance) tier = 'full'
    return { id: item.id, tier, distance }
  })
  const full = ranked.filter((row) => row.tier === 'full').sort((a, b) => a.distance - b.distance)
  for (let i = limits.fullCap; i < full.length; i++) full[i].tier = 'dot'
  const dots = ranked.filter((row) => row.tier === 'dot').sort((a, b) => a.distance - b.distance)
  for (let i = limits.dotCap; i < dots.length; i++) dots[i].tier = 'hide'
  return ranked
}
