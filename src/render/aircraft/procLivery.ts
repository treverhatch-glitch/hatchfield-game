/**
 * Procedural liveries for the roster.
 *
 * Colours come from the roster (sampled from the Gemini refs). Each airline and
 * model pair gets a spec (fuselage, belly, cheatline, tail colour and motif,
 * nacelles, wordmark) and, in the browser, three canvas plates that follow the
 * UV layout in liveryUv.ts. Specs and textures are cached per airline and model.
 * High-res is the default; only the texture-quality setting scales the plates down.
 *
 * Callers pass `airline: "<rosterId>@<modelId>"` on the Livery. The aircraft
 * builder does that when the airline is on the roster and the model is in its fleet.
 */
import * as THREE from 'three'
import { rosterAirline, type RosterAirline, type TailMotif } from '../../airlines/roster'
import { FIN_UV, LIVERY_ART, finChordAt } from './liveryUv'
import { DEFAULT_TEXTURE_QUALITY, type TextureQuality } from './liveryFiles'
import type { AirlineLiveryTex } from './liveryTex'
import { MODEL_SPECS, DERIVED_SPECS, type Livery } from './specs'
import { titleKeepoutsX } from './stands'

export const LIVERY_KEY_SEP = '@'

/** Plate size relative to the base layout in LIVERY_ART. High is 2x. */
export const PLATE_SCALE: Record<TextureQuality, number> = { low: 0.5, med: 1, high: 2 }

const WHITE = '#f2f4f6'
const BELLY_SHADE = 0.58
const POLISHED_BELLY = '#d3d8de'
const NACELLE_RING = 0.08

export interface ProcLivery {
  airlineId: string
  modelId: string
  /** Upper fuselage colour. White on twotone airframes, the primary on solid ones. */
  fuselage: string
  belly: string
  cheatline: string
  tail: string
  motif: TailMotif
  nacelle: string
  wordmark: string
  scheme: 'twotone' | 'solid'
  helicopter: boolean
  /** Roof band. Omitted when it matches the fuselage colour. */
  crown: string
}

function shade(hex: string, factor: number): string {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}

/** Polished alloy-grey belly, tinted 10% toward the airline colour. */
export function polishedBelly(primary: string): string {
  const c = new THREE.Color(POLISHED_BELLY).lerp(new THREE.Color(primary), 0.1)
  return `#${c.getHexString()}`
}

function luma(hex: string): number {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

/** Freighters and helicopters wear the primary all over; passenger jets are white over a coloured belly. */
function schemeFor(airline: RosterAirline, modelId: string): 'twotone' | 'solid' {
  const helo = MODEL_SPECS[modelId]?.family === 'helo'
  return helo || airline.type === 'cargo' || airline.type === 'heli' ? 'solid' : 'twotone'
}

const specCache = new Map<string, ProcLivery>()

export function procLiveryKey(airlineId: string, modelId: string): string {
  return `${airlineId}${LIVERY_KEY_SEP}${modelId}`
}

export function parseProcLiveryKey(key: string | undefined): { airlineId: string; modelId: string } | null {
  if (!key) return null
  const at = key.indexOf(LIVERY_KEY_SEP)
  if (at <= 0) return null
  return { airlineId: key.slice(0, at), modelId: key.slice(at + 1) }
}

/** Cached per airline and model. Undefined outside the roster, or for a type that airline does not fly. */
export function procLiverySpec(airlineId: string, modelId: string): ProcLivery | undefined {
  const key = procLiveryKey(airlineId, modelId)
  const hit = specCache.get(key)
  if (hit) return hit
  const airline = rosterAirline(airlineId)
  if (!airline || !airline.fleet.includes(modelId)) return undefined
  const scheme = schemeFor(airline, modelId)
  const lightPrimary = luma(airline.primary) > 0.75
  const fuselage = airline.fuselage ?? (scheme === 'solid' ? airline.primary : WHITE)
  const made: ProcLivery = {
    airlineId,
    modelId,
    fuselage,
    // Passenger jets: polished light-grey belly with a hint of the brand. Solid schemes keep the darker primary.
    belly: airline.belly ?? (scheme === 'solid' ? shade(airline.primary, BELLY_SHADE) : polishedBelly(airline.primary)),
    cheatline:
      airline.cheatline ??
      (scheme === 'solid' ? airline.secondary : lightPrimary ? airline.accent : airline.secondary),
    tail: airline.tail ?? airline.primary,
    motif: airline.motif,
    nacelle: scheme === 'solid' ? shade(airline.fuselage ?? airline.primary, 0.85) : airline.primary,
    wordmark: airline.name.toUpperCase(),
    scheme,
    helicopter: MODEL_SPECS[modelId]?.family === 'helo',
    crown: airline.crown ?? fuselage,
  }
  specCache.set(key, made)
  return made
}

/** Flat colours for the vertex-painted shell, so far LODs match the plates. */
export function rosterLivery(airlineId: string, modelId: string): Livery | undefined {
  const spec = procLiverySpec(airlineId, modelId)
  const airline = rosterAirline(airlineId)
  if (!spec || !airline) return undefined
  return {
    body: airline.primary,
    stripe: spec.cheatline,
    tail: spec.tail,
    mark: airline.code.slice(0, 2),
    scheme: spec.scheme,
    airline: procLiveryKey(airlineId, modelId),
    crown: spec.crown,
    wing: airline.wing,
  }
}

/** Swap a catalog-style Livery for the roster's when its airline is on the roster. */
export function applyRosterLivery(livery: Livery, modelId: string): Livery {
  if (!livery.airline || livery.airline.includes(LIVERY_KEY_SEP)) return livery
  const roster = rosterLivery(livery.airline, modelId)
  // Wear is per aircraft, not per livery: carry it across.
  return roster ? (livery.wear === undefined ? roster : { ...roster, wear: livery.wear }) : livery
}

/** Dev preview: every live aircraft wears this roster airline. `null` leaves flights alone. */
let rosterPreviewId: string | null = null

export function setRosterPreview(id: string | null) {
  rosterPreviewId = id
}

export function rosterPreviewLivery(modelId: string): Livery | undefined {
  return rosterPreviewId ? rosterLivery(rosterPreviewId, modelId) : undefined
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __rosterPreview?: typeof setRosterPreview }).__rosterPreview = setRosterPreview
}

type Ctx = CanvasRenderingContext2D

/** Fuselage plate: U nose to tail, V belly (bottom of image) to crown (top). */
export function drawFuselagePlate(ctx: Ctx, w: number, h: number, p: ProcLivery) {
  ctx.fillStyle = p.fuselage
  ctx.fillRect(0, 0, w, h)
  if (p.crown.toLowerCase() !== p.fuselage.toLowerCase()) {
    ctx.fillStyle = p.crown
    ctx.fillRect(0, 0, w, h * 0.28)
  }
  // Belly sits below the window line. Solid airframes keep one colour with a darker keel.
  ctx.fillStyle = p.belly
  ctx.fillRect(0, h * 0.62, w, h * 0.38)
  // Cheatline at window height, sweeping up toward the tail.
  ctx.fillStyle = p.cheatline
  const y = h * 0.5
  const t = h * 0.07
  ctx.beginPath()
  ctx.moveTo(w * 0.04, y)
  ctx.lineTo(w * 0.78, y)
  ctx.lineTo(w, y - h * 0.2)
  ctx.lineTo(w, y - h * 0.2 + t)
  ctx.lineTo(w * 0.78, y + t)
  ctx.lineTo(w * 0.04, y + t)
  ctx.closePath()
  ctx.fill()
  drawWordmark(ctx, w, h, p)
}

function drawWordmark(ctx: Ctx, w: number, h: number, p: ProcLivery) {
  const lengthM = MODEL_SPECS[p.modelId]?.lengthM ?? 40
  // Longer airframes carry a smaller share of the strip per letter.
  const high = !p.helicopter && (MODEL_SPECS[p.modelId] ?? DERIVED_SPECS[p.modelId])?.wingHigh === true
  // High-wing types carry their titles above the window line, clear of the wing and windows.
  let size = Math.round(h * (p.helicopter ? 0.16 : high ? 0.17 : lengthM > 60 ? 0.2 : 0.24))
  ctx.font = `bold ${size}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = luma(p.fuselage) < 0.55 ? WHITE : p.scheme === 'solid' ? WHITE : p.tail
  const [u0, u1] = titleSpan(p.modelId, p.helicopter)
  const span = w * (u1 - u0)
  // A short clear band shrinks the lettering evenly instead of squashing it sideways.
  const natural = ctx.measureText?.(p.wordmark)?.width ?? 0
  if (natural > span && natural > 0) {
    size = Math.max(Math.round(h * 0.1), Math.floor(size * (span / natural)))
    ctx.font = `bold ${size}px sans-serif`
  }
  ctx.fillText(p.wordmark, w * u0, h * (high ? 0.19 : 0.33), span)
}

/**
 * Plate U span for the fuselage titles. Port reads the plate nose→tail and starboard tail→nose
 * (outwardUv), so on high-wing types the span must miss the wing chord on BOTH sides: it goes
 * in the clear band beyond the wing and its mirror, forward of the wing on one side and aft of
 * it on the other, never under it. Turboprops also keep the lettering clear of the nacelles and
 * the propeller arc (stands.titleKeepoutsX), so a blade or cowling never cuts across the name.
 */
export function titleSpan(modelId: string, helicopter = false): [number, number] {
  if (helicopter) return [0.2, 0.7]
  const spec = MODEL_SPECS[modelId] ?? DERIVED_SPECS[modelId]
  if (!spec || !spec.wingHigh) return [0.2, 0.62]
  const half = spec.rootChord / 2 / spec.lengthM
  let le = Math.max(0, spec.wingAt - half - 0.07)
  let te = Math.min(1, spec.wingAt + half + 0.07)
  // Grow the blocked band over any nacelle or prop arc that touches it (fractions from the nose).
  const nose = spec.lengthM / 2
  for (const [x0, x1] of titleKeepoutsX(spec)) {
    const a = (nose - x1) / spec.lengthM
    const b = (nose - x0) / spec.lengthM
    if (b >= le - 0.02 && a <= te + 0.02) {
      le = Math.max(0, Math.min(le, a - 0.01))
      te = Math.min(1, Math.max(te, b + 0.01))
    }
  }
  // Exclude [le, te] and its mirror [1 - te, 1 - le].
  const lo = Math.min(le, 1 - te)
  const hi = Math.max(te, 1 - le)
  const front: [number, number] = [0.14, lo]
  const back: [number, number] = [hi, 0.9]
  return front[1] - front[0] >= back[1] - back[0] ? front : back
}

/** Tail plate: U leading edge to trailing edge, V root (bottom) to tip (top). */
export function drawTailPlate(ctx: Ctx, w: number, h: number, p: ProcLivery, accent: string, secondary: string) {
  ctx.fillStyle = p.tail
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = secondary
  ctx.strokeStyle = secondary
  // Centre the mark on the fin's own mid-chord at mid-span (the swept outline, FIN_UV), not on
  // the plate square, so the swept leading edge never clips it.
  const [le, te] = finChordAt(0.5)
  const cx = w * ((le + te) / 2)
  const cy = h * 0.5
  const r = Math.min(w, h) * 0.26
  switch (p.motif) {
    case 'none':
      break
    case 'bar':
      ctx.fillRect(w * 0.18, cy - r * 0.35, w * 0.64, r * 0.7)
      break
    case 'swoosh':
      ctx.beginPath()
      ctx.moveTo(w * 0.1, h * 0.8)
      ctx.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.9, h * 0.2)
      ctx.quadraticCurveTo(w * 0.55, h * 0.5, w * 0.1, h * 0.8)
      ctx.fill()
      break
    case 'chevron':
      ctx.beginPath()
      ctx.moveTo(w * 0.15, h * 0.7)
      ctx.lineTo(cx, h * 0.3)
      ctx.lineTo(w * 0.85, h * 0.7)
      ctx.lineTo(w * 0.85, h * 0.85)
      ctx.lineTo(cx, h * 0.45)
      ctx.lineTo(w * 0.15, h * 0.85)
      ctx.closePath()
      ctx.fill()
      break
    case 'star':
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rad = i % 2 === 0 ? r : r * 0.42
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
      }
      ctx.closePath()
      ctx.fill()
      break
    case 'wave':
      ctx.lineWidth = h * 0.05
      for (let k = 0; k < 3; k++) {
        const y = h * (0.36 + k * 0.14)
        ctx.beginPath()
        ctx.moveTo(w * 0.1, y)
        ctx.quadraticCurveTo(w * 0.3, y - h * 0.08, cx, y)
        ctx.quadraticCurveTo(w * 0.7, y + h * 0.08, w * 0.9, y)
        ctx.stroke()
      }
      break
    case 'circle':
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(cx, cy - r * 1.3)
      ctx.lineTo(cx + r, cy)
      ctx.lineTo(cx, cy + r * 1.3)
      ctx.lineTo(cx - r, cy)
      ctx.closePath()
      ctx.fill()
      break
    case 'stripes':
      for (let k = 0; k < 3; k++) ctx.fillRect(w * 0.1, h * (0.3 + k * 0.16), w * 0.8, h * 0.08)
      break
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(cx, cy - r * 1.2)
      ctx.lineTo(cx + r * 1.1, cy + r)
      ctx.lineTo(cx - r * 1.1, cy + r)
      ctx.closePath()
      ctx.fill()
      break
    case 'crescent':
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = p.tail
      ctx.beginPath()
      ctx.arc(cx + r * 0.45, cy - r * 0.1, r * 0.85, 0, Math.PI * 2)
      ctx.fill()
      break
  }
  // Accent band along the swept trailing edge (root U 1 → tip U FIN_UV.tipTrail), carried past
  // the edge to the plate border so filtering never pulls fin colour onto it.
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(w * 0.94, h)
  ctx.lineTo(w, h)
  ctx.lineTo(w, 0)
  ctx.lineTo(w * (FIN_UV.tipTrail - 0.06), 0)
  ctx.closePath()
  ctx.fill()
}

/** Engine plate: U wraps the barrel, V intake (bottom) to exhaust (top). */
export function drawEnginePlate(ctx: Ctx, w: number, h: number, p: ProcLivery, ring: string) {
  ctx.fillStyle = p.nacelle
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = ring
  ctx.fillRect(0, h * (1 - NACELLE_RING * 2), w, h * NACELLE_RING)
}

export type CanvasFactory = (w: number, h: number) => { getContext(type: '2d'): Ctx | null } | null

const defaultCanvas: CanvasFactory = (w, h) => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas as unknown as ReturnType<CanvasFactory>
}

let canvasFactory: CanvasFactory = defaultCanvas

/** Tests inject a recording canvas; the browser uses the DOM. */
export function setProcLiveryCanvasFactory(factory: CanvasFactory | null) {
  canvasFactory = factory ?? defaultCanvas
}

const texCache = new Map<string, AirlineLiveryTex>()
let builds = 0

/** How many texture sets have been drawn. The cache test reads this. */
export function procLiveryBuildCount(): number {
  return builds
}

function plate(w: number, h: number, paint: (ctx: Ctx, w: number, h: number) => void): THREE.Texture | null {
  const canvas = canvasFactory(w, h)
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return null
  paint(ctx, w, h)
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 16
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  return tex
}

/** Canvas plates for one airline on one model, cached per airline, model and quality. */
export function procLiveryTextures(
  key: string,
  quality: TextureQuality = DEFAULT_TEXTURE_QUALITY,
): AirlineLiveryTex | undefined {
  const parsed = parseProcLiveryKey(key)
  if (!parsed) return undefined
  const cacheKey = `${key}|${quality}`
  const hit = texCache.get(cacheKey)
  if (hit) return hit
  const p = procLiverySpec(parsed.airlineId, parsed.modelId)
  const airline = rosterAirline(parsed.airlineId)
  if (!p || !airline) return undefined
  const s = PLATE_SCALE[quality]
  const fuselage = plate(LIVERY_ART.fuselage.w * s, LIVERY_ART.fuselage.h * s, (c, w, h) => drawFuselagePlate(c, w, h, p))
  const tail = plate(LIVERY_ART.tail.w * s, LIVERY_ART.tail.h * s, (c, w, h) =>
    drawTailPlate(c, w, h, p, airline.accent, airline.secondary),
  )
  const engine = plate(LIVERY_ART.engine.w * s, LIVERY_ART.engine.h * s, (c, w, h) =>
    drawEnginePlate(c, w, h, p, airline.secondary),
  )
  if (!fuselage || !tail || !engine) return undefined
  builds += 1
  const made = { fuselage, tail, engine }
  texCache.set(cacheKey, made)
  return made
}

export function disposeProcLiveries() {
  for (const set of texCache.values()) {
    set.fuselage.dispose()
    set.tail.dispose()
    set.engine.dispose()
  }
  texCache.clear()
  specCache.clear()
  builds = 0
}
