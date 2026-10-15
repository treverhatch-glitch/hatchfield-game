import type { ReactElement } from 'react'

/**
 * One picture per build stamp. Known tools get a drawn mark. Anything else
 * still gets a picture, hashed from its id, so a new stamp is never blank.
 */

function hash(id: string): number {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 33 + id.charCodeAt(i)) >>> 0
  return n
}

function monogram(id: string) {
  const n = hash(id)
  const letter = (id.replace(/[^a-z]/gi, '')[0] ?? 'B').toUpperCase()
  const shapes = [
    <rect key="s" x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />,
    <circle key="s" cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />,
    <polygon key="s" points="16,6 26,24 6,24" fill="none" stroke="currentColor" strokeWidth="2" />,
    <path key="s" d="M6 22 L16 8 L26 22" fill="none" stroke="currentColor" strokeWidth="2" />,
  ]
  return (
    <>
      {shapes[n % shapes.length]}
      <text x="16" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
        {letter}
      </text>
    </>
  )
}

const KNOWN: Record<string, ReactElement> = {
  runway_short: <rect x="4" y="14" width="16" height="4" rx="1" fill="currentColor" />,
  runway: <rect x="3" y="13" width="26" height="6" rx="1" fill="currentColor" />,
  runway_heavy: <rect x="2" y="11" width="28" height="10" rx="1" fill="currentColor" />,
  helipad: (
    <>
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10 V22 M12 16 H20" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  taxi: <path d="M4 22 H28 M8 22 V14 H22 V22" fill="none" stroke="currentColor" strokeWidth="2" />,
  deice: <path d="M16 6 V26 M8 12 L16 16 L24 12 M8 20 L16 16 L24 20" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand_light: <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand_narrow: <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand: <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand_heavy: <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand_s: <rect x="10" y="10" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand_l: <rect x="6" y="8" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />,
  stand_w: <rect x="4" y="8" width="24" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />,
  tower: (
    <>
      <rect x="13" y="12" width="6" height="12" fill="currentColor" />
      <rect x="8" y="8" width="16" height="5" rx="1" fill="currentColor" />
    </>
  ),
  premade: <rect x="4" y="10" width="24" height="12" rx="1" fill="currentColor" />,
  terminal: <path d="M4 22 H28 V14 H20 V8 H12 V14 H4 Z" fill="currentColor" />,
  prefab_ii: (
    <>
      <rect x="3" y="10" width="16" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="19" y="13" width="10" height="6" fill="currentColor" />
    </>
  ),
  satellite: (
    <>
      <rect x="4" y="12" width="10" height="8" fill="currentColor" />
      <path d="M14 16 H20" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  concourse: <path d="M4 14 H28 V18 H4 Z M8 18 V24 M16 18 V24 M24 18 V24" fill="none" stroke="currentColor" strokeWidth="2" />,
  pier_ii: <path d="M4 12 H20 V20 H4 Z M20 16 H28 M24 12 V20" fill="none" stroke="currentColor" strokeWidth="2" />,
  belt: <path d="M4 16 H28 M8 12 V20 M24 12 V20" fill="none" stroke="currentColor" strokeWidth="2" />,
  snack: <circle cx="16" cy="16" r="7" fill="currentColor" />,
  bags: <rect x="8" y="10" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />,
  fuel: <rect x="7" y="8" width="8" height="16" rx="3" fill="currentColor" />,
  fuel_rail: <path d="M4 20 H28 M8 20 V12 H24 V20 M12 12 V8 H20 V12" fill="none" stroke="currentColor" strokeWidth="2" />,
  oil: <ellipse cx="16" cy="16" rx="8" ry="5" fill="currentColor" />,
  fuel_pipe: <path d="M4 16 H28" stroke="currentColor" strokeWidth="4" />,
  manifold: <path d="M8 10 H24 V22 H8 Z M16 10 V6 M12 22 V26 M20 22 V26" fill="none" stroke="currentColor" strokeWidth="2" />,
  berth: <path d="M6 20 H26 M10 20 V12 H22 V20" fill="none" stroke="currentColor" strokeWidth="2" />,
  saf_blending: <path d="M10 8 H22 L20 24 H12 Z" fill="none" stroke="currentColor" strokeWidth="2" />,
  fire: <path d="M16 6 C20 12 22 14 22 18 a6 6 0 1 1 -12 0 C10 14 12 12 16 6 Z" fill="currentColor" />,
  police: <path d="M16 6 L26 10 V16 C26 22 16 26 16 26 C16 26 6 22 6 16 V10 Z" fill="none" stroke="currentColor" strokeWidth="2" />,
  guard: <rect x="6" y="12" width="20" height="10" fill="none" stroke="currentColor" strokeWidth="2" />,
  cargo: <rect x="6" y="12" width="20" height="10" fill="currentColor" />,
  hangar: <path d="M4 22 L16 8 L28 22 Z" fill="none" stroke="currentColor" strokeWidth="2" />,
  hangar_w: <path d="M3 22 L16 6 L29 22 Z" fill="none" stroke="currentColor" strokeWidth="2" />,
  hangar_j: <path d="M4 22 L16 8 L28 22 H4 Z" fill="currentColor" />,
  mro: <path d="M6 20 H26 V12 H6 Z M12 12 V8 H20 V12" fill="none" stroke="currentColor" strokeWidth="2" />,
  nighthub: <path d="M8 20 a8 8 0 1 1 12 0 Z" fill="currentColor" />,
  kitchen: <path d="M8 18 H24 V22 H8 Z M12 18 V10 H16 V18" fill="currentColor" />,
  depot: <rect x="6" y="10" width="20" height="12" fill="none" stroke="currentColor" strokeWidth="2" />,
  road: <path d="M6 12 H26 M6 20 H26 M16 12 V20" fill="none" stroke="currentColor" strokeWidth="2" />,
  bus: <rect x="6" y="10" width="20" height="10" rx="2" fill="currentColor" />,
  curb_lane: <path d="M4 18 H28 M8 14 H24" fill="none" stroke="currentColor" strokeWidth="2" />,
  taxi_rank: <rect x="8" y="12" width="16" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />,
  park_s: <rect x="10" y="8" width="12" height="16" fill="none" stroke="currentColor" strokeWidth="2" />,
  park_l: <rect x="6" y="6" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" />,
  park_g: <rect x="4" y="8" width="24" height="16" fill="none" stroke="currentColor" strokeWidth="2" />,
  park_u: <path d="M8 24 V8 H24 V24" fill="none" stroke="currentColor" strokeWidth="2" />,
  rail: <path d="M8 10 V22 M24 10 V22 M8 16 H24" fill="none" stroke="currentColor" strokeWidth="2" />,
  rail_link: <path d="M6 16 H26 M16 8 V24" fill="none" stroke="currentColor" strokeWidth="2" />,
  hotel_inn: <rect x="8" y="8" width="16" height="16" fill="currentColor" />,
  hotel_biz: <rect x="10" y="4" width="12" height="22" fill="currentColor" />,
  hotel_resort: <path d="M4 22 L16 8 L28 22 Z" fill="currentColor" />,
  airport_hotel: <rect x="6" y="6" width="20" height="20" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />,
  term_bus: <rect x="5" y="12" width="22" height="8" rx="2" fill="currentColor" />,
  people_mover: <circle cx="10" cy="16" r="3" fill="currentColor" />,
  xfer_bus: <rect x="6" y="12" width="20" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />,
  hub_skywalk: <path d="M4 14 H28 M4 18 H28" fill="none" stroke="currentColor" strokeWidth="2" />,
  skywalk: <path d="M4 16 H28" stroke="currentColor" strokeWidth="3" />,
  travelator: <path d="M6 20 H26 L22 12 H10 Z" fill="currentColor" />,
  mover: <path d="M6 16 H26 M18 10 L26 16 L18 22" fill="none" stroke="currentColor" strokeWidth="2" />,
  clear: <path d="M8 8 L24 24 M24 8 L8 24" stroke="currentColor" strokeWidth="2.4" />,
  checkin: <rect x="6" y="12" width="20" height="8" fill="currentColor" />,
  security: <path d="M16 6 L26 10 V16 C26 22 16 26 16 26 C16 26 6 22 6 16 V10 Z" fill="currentColor" />,
  gates: <path d="M8 8 H24 V24 H8 Z M16 8 V24" fill="none" stroke="currentColor" strokeWidth="2" />,
  foundation: <rect x="4" y="18" width="24" height="6" fill="currentColor" />,
  walls: <path d="M6 26 V8 H26 V26" fill="none" stroke="currentColor" strokeWidth="3" />,
  erase: <path d="M8 22 L14 8 H20 L26 22 Z" fill="none" stroke="currentColor" strokeWidth="2" />,
  door: <path d="M10 6 H22 V26 H10 Z M18 16 H20" fill="none" stroke="currentColor" strokeWidth="2" />,
  zone: <rect x="6" y="6" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />,
  floor: <rect x="6" y="14" width="20" height="10" fill="currentColor" />,
  wallpaper: <path d="M8 6 H24 V26 H8 Z M8 12 H24 M8 18 H24" fill="none" stroke="currentColor" strokeWidth="1.6" />,
}

export function StampIcon({ id, kind }: { id: string; kind?: string }) {
  return (
    <svg className="tray-ico" viewBox="0 0 32 32" aria-hidden data-icon={id} data-kind={kind}>
      {KNOWN[id] ?? monogram(id)}
    </svg>
  )
}
