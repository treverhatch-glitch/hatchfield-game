/**
 * Crops for the Gemini signage sheets. The JPEGs stay full size in
 * public/art/textures/signage. The loader trims these rectangles and can
 * downscale; it never mirrors a panel.
 * Pixel origin is the top-left of the file.
 */

export const SIGNAGE_DIR = 'art/textures/signage'

/** Longest side after hatchfield-texture-quality. High stays near 2K. */
export const SIGNAGE_LONG_SIDE = { low: 768, med: 1280, high: 2048 } as const

export interface SignCrop {
  x: number
  y: number
  w: number
  h: number
}

export interface SignSheet {
  file: string
  w: number
  h: number
  /** Flat colour drawn until the JPEG arrives. */
  fill: string
}

export const DESK_HEADER_SHEET: SignSheet = {
  file: 'checkin_desk_header_1-6.jpg',
  w: 4128,
  h: 1024,
  fill: '#f7f8f6',
}

/** Six equal lightbox panels, left to right, numbers 1 through 6. */
export const DESK_HEADER_CROPS: readonly SignCrop[] = [0, 1, 2, 3, 4, 5].map((i) => ({
  x: i * 688 + 24,
  y: 40,
  w: 640,
  h: 944,
}))

export const WAYFINDING_SHEET: SignSheet = {
  file: 'wayfinding_sign_sheet.jpg',
  w: 2048,
  h: 2048,
  fill: '#0e2230',
}

/** Two columns, four rows, as laid out on the sheet. */
export const WAYFINDING_CROPS = {
  gates: { x: 83, y: 75, w: 897, h: 416 },
  checkin: { x: 83, y: 568, w: 897, h: 415 },
  security: { x: 83, y: 1059, w: 897, h: 407 },
  baggage: { x: 83, y: 1547, w: 897, h: 418 },
  arrivals: { x: 1068, y: 75, w: 897, h: 417 },
  departures: { x: 1068, y: 568, w: 897, h: 412 },
  toilets: { x: 1069, y: 1059, w: 896, h: 407 },
  exit: { x: 1068, y: 1547, w: 897, h: 418 },
} as const satisfies Record<string, SignCrop>

export type WayfindingPanel = keyof typeof WAYFINDING_CROPS

/**
 * Batch 11 banners. These replace the matching crop on the old sheet.
 * Arrivals, departures, and exit stay on WAYFINDING_SHEET: there is no
 * banner for them in the store.
 */
export const DEDICATED_WAYFINDING: Partial<Record<WayfindingPanel, SignSheet>> = {
  gates: { file: 'wayfinding_gates.jpg', w: 3168, h: 1344, fill: '#2a2f36' },
  checkin: { file: 'wayfinding_checkin.jpg', w: 3168, h: 1344, fill: '#2a2f36' },
  security: { file: 'wayfinding_security.jpg', w: 3584, h: 1184, fill: '#2a2f36' },
  baggage: { file: 'wayfinding_baggage.jpg', w: 3584, h: 1184, fill: '#2a2f36' },
  toilets: { file: 'wayfinding_restrooms.jpg', w: 3168, h: 1344, fill: '#2a2f36' },
}

export function fullBleed(sheet: SignSheet): SignCrop {
  return { x: 0, y: 0, w: sheet.w, h: sheet.h }
}

export const FIDS_SHEET: SignSheet = {
  file: 'fids_departures_board.jpg',
  w: 2752,
  h: 1536,
  fill: '#071422',
}

/** Drops the black margin on the right and along the bottom. */
export const FIDS_CROP: SignCrop = { x: 64, y: 32, w: 2624, h: 1380 }

export function cropInside(sheet: SignSheet, crop: SignCrop): boolean {
  return crop.x >= 0 && crop.y >= 0 && crop.w > 0 && crop.h > 0 && crop.x + crop.w <= sheet.w && crop.y + crop.h <= sheet.h
}
