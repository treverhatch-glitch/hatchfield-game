/**
 * Graphics quality for Settings and the apron.
 * Saved in `hatchfield-gfx`. A fresh visit uses the GPU guess from `suggestQuality`.
 */
import { parseQuality, QUALITY_LABEL, suggestQuality, type QualityLevel } from './world/quality'

export { QUALITY_LABEL, type QualityLevel }

const KEY = 'hatchfield-gfx'

type Listener = (level: QualityLevel) => void
const listeners = new Set<Listener>()

export interface GraphicsReason {
  level: QualityLevel
  reason: string
}

export function explainGraphics(info: {
  renderer?: string
  deviceMemory?: number
  hardwareConcurrency?: number
}): GraphicsReason {
  const level = suggestQuality(info)
  const r = (info.renderer ?? '').toLowerCase()
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software')) {
    return { level, reason: 'software graphics' }
  }
  if ((info.deviceMemory ?? 8) <= 2 || (info.hardwareConcurrency ?? 8) <= 2) {
    return { level, reason: 'a small device' }
  }
  if (level === 'ultra') return { level, reason: 'a desktop graphics card' }
  if (level === 'high') return { level, reason: 'a strong machine' }
  return { level, reason: 'this machine' }
}

let gpuName: string | null = null

function probeGpu(): string {
  if (gpuName != null) return gpuName
  try {
    if (typeof document === 'undefined') {
      gpuName = ''
      return gpuName
    }
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) {
      gpuName = ''
      return gpuName
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    gpuName = ''
  }
  return gpuName
}

function deviceProfile() {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number })
  return {
    renderer: probeGpu(),
    deviceMemory: nav?.deviceMemory,
    hardwareConcurrency: nav?.hardwareConcurrency,
  }
}

let autoCache: GraphicsReason | null = null

/** What a fresh visit would pick on this device, ignoring a saved choice. */
export function graphicsAuto(): GraphicsReason {
  if (!autoCache) autoCache = explainGraphics(deviceProfile())
  return autoCache
}

/** Saved choice, otherwise the GPU guess. */
export function graphicsQuality(): QualityLevel {
  let saved: string | null = null
  try {
    saved = globalThis.localStorage?.getItem(KEY) ?? null
  } catch {
    saved = null
  }
  if (saved) return parseQuality(saved)
  return graphicsAuto().level
}

export function chooseGraphicsQuality(level: QualityLevel | 'medium') {
  const next = parseQuality(level)
  try {
    globalThis.localStorage?.setItem(KEY, next)
  } catch {
    // Storage is unavailable in some private windows.
  }
  for (const fn of [...listeners]) fn(next)
}

export function subscribeGraphicsQuality(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function graphicsNote(current: QualityLevel, auto: GraphicsReason): string {
  const using = QUALITY_LABEL[current]
  const start = QUALITY_LABEL[auto.level]
  const detail =
    current === 'low'
      ? 'Soft shadows, contact shadows, and the wider light bloom stay off, so a busy airport keeps its pace.'
      : current === 'med'
        ? 'Soft shadows follow the camera, with contact shadows, a colour grade, and a light bloom on the field lights.'
        : current === 'high'
          ? 'Sharper shadows, a wider light bloom, and the same contact shadows and colour grade.'
          : 'High, plus 4096 shadows, 16× texture filtering, full-resolution rendering, longer detail distances and denser grass and trees. Needs a desktop graphics card.'
  const picked =
    current === auto.level
      ? `This device starts on ${start} (${auto.reason}).`
      : `Saved on ${using}. A fresh visit on this device starts on ${start} (${auto.reason}).`
  return `${using}. ${detail} ${picked}`
}

// ---------- building surface detail (per-pixel material effects) ----------
const FX_KEY = 'hatchfield-matfx'
export type MaterialFxPref = 'auto' | 'on' | 'off'
const fxListeners = new Set<(p: MaterialFxPref) => void>()

/** Saved override for building weathering + reflections; 'auto' follows the preset (on for High). */
export function materialFxPref(): MaterialFxPref {
  try {
    const v = globalThis.localStorage?.getItem(FX_KEY)
    return v === 'on' || v === 'off' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function chooseMaterialFx(p: MaterialFxPref): void {
  try {
    if (p === 'auto') globalThis.localStorage?.removeItem(FX_KEY)
    else globalThis.localStorage?.setItem(FX_KEY, p)
  } catch {
    // Storage is unavailable in some private windows.
  }
  for (const fn of [...fxListeners]) fn(p)
}

export function subscribeMaterialFx(fn: (p: MaterialFxPref) => void): () => void {
  fxListeners.add(fn)
  return () => fxListeners.delete(fn)
}

/** Resolve the pref against a preset default. */
export function materialFxOn(p: MaterialFxPref, presetDefault: boolean): boolean {
  return p === 'auto' ? presetDefault : p === 'on'
}
