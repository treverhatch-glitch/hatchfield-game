/**
 * Accessibility & performance settings model, persisted to localStorage
 * (or any KeyValueStore). Pure data + validation; the UI and renderer read it.
 */
import { clamp } from '../shared/rng.ts'

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra'
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'
export type OverlayId = 'pathfinding' | 'congestion' | 'zones' | 'noise' | 'utilities' | 'designAdvisor'

/** Same buses as the audio engine categories. */
export const AUDIO_BUSES = ['aircraft', 'vehicles', 'buildings', 'ambient', 'ambience', 'ui', 'sfx'] as const
export type AudioBus = (typeof AUDIO_BUSES)[number]
export type BusVolume = Record<AudioBus, number>

export const DEFAULT_BUS_VOLUME: BusVolume = {
  aircraft: 0.62,
  vehicles: 0.52,
  buildings: 0.55,
  ambient: 0.4,
  ambience: 0.36,
  ui: 0.5,
  sfx: 0.58,
}

export interface GraphicsSettings {
  preset: QualityPreset | 'custom'
  shadows: 'off' | 'low' | 'high'
  shadowMapSize: number
  /** Device pixel ratio cap. */
  pixelRatio: number
  antialias: boolean
  /** Multiplier on LOD switch distances (higher = detail kept further away). */
  lodBias: number
  maxPassengersRendered: number
  postProcessing: boolean
}

export interface Settings {
  version: 1
  /** 0 = uncapped (vsync). */
  fpsCap: 0 | 30 | 60 | 120 | 144
  /** UI scale 0.75..1.5. */
  uiScale: number
  colorBlind: ColorBlindMode
  reducedMotion: boolean
  highContrastUi: boolean
  graphics: GraphicsSettings
  overlays: Record<OverlayId, boolean>
  masterVolume: number
  /** Master mute. Category sliders stay put so unmuting restores the mix. */
  audioMuted: boolean
  busVolume: BusVolume
  /**
   * Day/night cycle. On follows the sim clock (sun, moon, sky, field lights).
   * Off holds the field at late morning. Menus, including the ones being
   * rebuilt elsewhere, bind this field. It persists with the rest of Settings.
   */
  dayNightCycle: boolean
}

export const GRAPHICS_PRESETS: Record<QualityPreset, Omit<GraphicsSettings, 'preset'>> = {
  low: { shadows: 'off', shadowMapSize: 512, pixelRatio: 1, antialias: false, lodBias: 0.6, maxPassengersRendered: 150, postProcessing: false },
  medium: { shadows: 'low', shadowMapSize: 1024, pixelRatio: 1.25, antialias: true, lodBias: 0.85, maxPassengersRendered: 400, postProcessing: false },
  high: { shadows: 'high', shadowMapSize: 2048, pixelRatio: 1.5, antialias: true, lodBias: 1, maxPassengersRendered: 1000, postProcessing: true },
  ultra: { shadows: 'high', shadowMapSize: 4096, pixelRatio: 2, antialias: true, lodBias: 1.4, maxPassengersRendered: 2500, postProcessing: true },
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  fpsCap: 60,
  uiScale: 1,
  colorBlind: 'none',
  reducedMotion: false,
  highContrastUi: false,
  graphics: { preset: 'high', ...GRAPHICS_PRESETS.high },
  // Pathfinding/congestion are off by default (owner rule: layered view opened from settings).
  overlays: { pathfinding: false, congestion: false, zones: false, noise: false, utilities: false, designAdvisor: true },
  masterVolume: 0.75,
  audioMuted: false,
  busVolume: { ...DEFAULT_BUS_VOLUME },
  dayNightCycle: true,
}

/** Overlay palettes: good -> warn -> bad -> path -> highlight, chosen to stay distinct per mode. */
export type OverlayPalette = { good: string; warn: string; bad: string; path: string; highlight: string }
export const OVERLAY_PALETTES: Record<ColorBlindMode, OverlayPalette> = {
  none: { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', path: '#38bdf8', highlight: '#e879f9' },
  protanopia: { good: '#0072b2', warn: '#f0e442', bad: '#d55e00', path: '#56b4e9', highlight: '#cc79a7' },
  deuteranopia: { good: '#0072b2', warn: '#e69f00', bad: '#d55e00', path: '#56b4e9', highlight: '#cc79a7' },
  tritanopia: { good: '#009e73', warn: '#f4a6c0', bad: '#d55e00', path: '#000000', highlight: '#cc79a7' },
  achromatopsia: { good: '#f5f5f5', warn: '#a3a3a3', bad: '#262626', path: '#737373', highlight: '#ffffff' },
}

export function overlayPalette(s: Settings): OverlayPalette { return OVERLAY_PALETTES[s.colorBlind] }

const FPS: Settings['fpsCap'][] = [0, 30, 60, 120, 144]
const CB: ColorBlindMode[] = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']
const PRESETS: QualityPreset[] = ['low', 'medium', 'high', 'ultra']

/** Coerces anything (old/corrupt/partial JSON) into valid Settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings> & { graphics?: Partial<GraphicsSettings>; overlays?: Partial<Record<OverlayId, boolean>>; busVolume?: Partial<BusVolume> }
  const num = (v: unknown, def: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def)
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
  const g: Partial<GraphicsSettings> = r.graphics ?? {}
  const preset = g.preset === 'custom' || PRESETS.includes(g.preset as QualityPreset) ? (g.preset as GraphicsSettings['preset']) : d.graphics.preset
  const base = preset === 'custom' ? d.graphics : { preset, ...GRAPHICS_PRESETS[preset] }
  const graphics: GraphicsSettings = preset === 'custom'
    ? {
      preset,
      shadows: g.shadows === 'off' || g.shadows === 'low' || g.shadows === 'high' ? g.shadows : base.shadows,
      shadowMapSize: [512, 1024, 2048, 4096].includes(g.shadowMapSize as number) ? (g.shadowMapSize as number) : base.shadowMapSize,
      pixelRatio: num(g.pixelRatio, base.pixelRatio, 0.5, 3),
      antialias: bool(g.antialias, base.antialias),
      lodBias: num(g.lodBias, base.lodBias, 0.25, 2),
      maxPassengersRendered: Math.round(num(g.maxPassengersRendered, base.maxPassengersRendered, 0, 5000)),
      postProcessing: bool(g.postProcessing, base.postProcessing),
    }
    : base
  const overlays = { ...d.overlays }
  for (const k of Object.keys(overlays) as OverlayId[]) overlays[k] = bool(r.overlays?.[k], d.overlays[k])
  const busVolume = { ...d.busVolume }
  for (const k of AUDIO_BUSES) busVolume[k] = num(r.busVolume?.[k], d.busVolume[k], 0, 1)
  return {
    version: 1,
    fpsCap: FPS.includes(r.fpsCap as Settings['fpsCap']) ? (r.fpsCap as Settings['fpsCap']) : d.fpsCap,
    uiScale: Math.round(num(r.uiScale, d.uiScale, 0.75, 1.5) * 100) / 100,
    colorBlind: CB.includes(r.colorBlind as ColorBlindMode) ? (r.colorBlind as ColorBlindMode) : d.colorBlind,
    reducedMotion: bool(r.reducedMotion, d.reducedMotion),
    highContrastUi: bool(r.highContrastUi, d.highContrastUi),
    graphics,
    overlays,
    masterVolume: num(r.masterVolume, d.masterVolume, 0, 1),
    audioMuted: bool(r.audioMuted, d.audioMuted),
    busVolume,
    dayNightCycle: bool(r.dayNightCycle, d.dayNightCycle),
  }
}

let shared: SettingsStore | undefined

/** One store for the pause menu, the audio mix, and the lighting rig. */
export function sharedSettings(): SettingsStore {
  return (shared ??= new SettingsStore())
}

export function applyPreset(s: Settings, preset: QualityPreset): Settings {
  return { ...s, graphics: { preset, ...GRAPHICS_PRESETS[preset] } }
}

/** Changing any individual graphics field flips the preset to 'custom'. */
export function setGraphics(s: Settings, patch: Partial<Omit<GraphicsSettings, 'preset'>>): Settings {
  return sanitizeSettings({ ...s, graphics: { ...s.graphics, ...patch, preset: 'custom' } })
}

export function toggleOverlay(s: Settings, id: OverlayId, on?: boolean): Settings {
  return { ...s, overlays: { ...s.overlays, [id]: on ?? !s.overlays[id] } }
}

/** Frame budget in ms for a render loop limiter; 0 means uncapped. */
export function frameIntervalMs(s: Settings): number {
  return s.fpsCap === 0 ? 0 : 1000 / s.fpsCap
}

/** Animation-duration multiplier the UI should use (0 when reduced motion). */
export function motionScale(s: Settings): number {
  return s.reducedMotion ? 0 : 1
}

export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const SETTINGS_KEY = 'hatchfield.settings.v1'

/** Returns window.localStorage when available (browser), else undefined. */
export function browserStorage(): SettingsStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export type SettingsListener = (s: Settings) => void

export class SettingsStore {
  private current: Settings
  private listeners: SettingsListener[] = []
  private readonly storage: SettingsStorage | undefined
  constructor(storage: SettingsStorage | undefined = browserStorage()) {
    this.storage = storage
    let raw: unknown
    try { raw = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null') } catch { raw = null }
    this.current = sanitizeSettings(raw)
  }
  get(): Settings { return this.current }
  update(fn: (s: Settings) => Settings): Settings {
    this.current = sanitizeSettings(fn(this.current))
    try { this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.current)) } catch { /* quota/private mode: keep in memory */ }
    for (const l of this.listeners) l(this.current)
    return this.current
  }
  reset(): Settings { return this.update(() => DEFAULT_SETTINGS) }
  subscribe(fn: SettingsListener): () => void {
    this.listeners.push(fn)
    return () => { this.listeners = this.listeners.filter((l) => l !== fn) }
  }
}

export function readDayNightCycle(store: SettingsStore = sharedSettings()): boolean {
  return store.get().dayNightCycle
}
