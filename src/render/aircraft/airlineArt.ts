/**
 * Picks the paint a flight actually wears.
 * A photographed plate wins when the manifest lists that carrier and the
 * airframe is one it flies. Anything else stays on the procedural roster paint.
 */
import { jpegLiveryFits, listedLivery } from './liveryFiles'
import { LIVERY_KEY_SEP, applyRosterLivery } from './procLivery'
import type { Livery } from './specs'

export function selectLivery(paint: Livery, modelId: string): Livery {
  const raw = paint.airline ?? ''
  const id = raw.split(LIVERY_KEY_SEP)[0]
  if (id && listedLivery(id) && jpegLiveryFits(id, modelId)) {
    return raw === id ? paint : { ...paint, airline: id }
  }
  const base = raw.includes(LIVERY_KEY_SEP) ? { ...paint, airline: id || undefined } : paint
  const next = applyRosterLivery(base, modelId)
  if (next.airline && !next.airline.includes(LIVERY_KEY_SEP) && !jpegLiveryFits(next.airline, modelId)) {
    const rest = { ...next }
    delete rest.airline
    return rest
  }
  return next
}
