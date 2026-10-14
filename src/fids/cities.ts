/** Fictional cities used when a movement has no published destination. */
export const CITIES = [
  'PORT MERIDIAN',
  'KITE HARBOR',
  'NORTHGLASS',
  'REDWICK',
  'SOLACE BAY',
  'VELLUM',
  'GLASSMERE',
  'HARROWFORD',
  'CINDER REACH',
  'LUMEN CAY',
  'BRIGHTLOW',
  'OSTER REACH',
] as const

export function cityFor(id: string): string {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return CITIES[(hash >>> 0) % CITIES.length] ?? CITIES[0]
}
