import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, OVERLAY_PALETTES, SETTINGS_KEY, SettingsStore, applyPreset, frameIntervalMs, motionScale, overlayPalette, sanitizeSettings, setGraphics, toggleOverlay, type SettingsStorage } from './settings.ts'

const mem = (): SettingsStorage & { m: Map<string, string> } => {
  const m = new Map<string, string>()
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) } }
}

describe('settings', () => {
  it('pathfinding overlay is off by default', () => {
    expect(DEFAULT_SETTINGS.overlays.pathfinding).toBe(false)
  })
  it('sanitizes junk into valid settings', () => {
    const s = sanitizeSettings({ fpsCap: 77, uiScale: 9, colorBlind: 'x', graphics: { preset: 'nope' }, overlays: { pathfinding: 'yes' }, masterVolume: -2 })
    expect(s.fpsCap).toBe(60)
    expect(s.uiScale).toBe(1.5)
    expect(s.colorBlind).toBe('none')
    expect(s.graphics.preset).toBe('high')
    expect(s.overlays.pathfinding).toBe(false)
    expect(s.masterVolume).toBe(0)
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })
  it('presets and custom graphics', () => {
    const low = applyPreset(DEFAULT_SETTINGS, 'low')
    expect(low.graphics.shadows).toBe('off')
    const c = setGraphics(low, { lodBias: 5 })
    expect(c.graphics.preset).toBe('custom')
    expect(c.graphics.lodBias).toBe(2)
    expect(c.graphics.shadows).toBe('off')
  })
  it('overlays, fps and motion helpers', () => {
    const s = toggleOverlay(DEFAULT_SETTINGS, 'pathfinding')
    expect(s.overlays.pathfinding).toBe(true)
    expect(toggleOverlay(s, 'pathfinding', true).overlays.pathfinding).toBe(true)
    expect(frameIntervalMs({ ...s, fpsCap: 0 })).toBe(0)
    expect(frameIntervalMs({ ...s, fpsCap: 30 })).toBeCloseTo(33.33, 1)
    expect(motionScale({ ...s, reducedMotion: true })).toBe(0)
    expect(overlayPalette({ ...s, colorBlind: 'deuteranopia' })).toBe(OVERLAY_PALETTES.deuteranopia)
  })
  it('every palette has 5 distinct colours', () => {
    for (const p of Object.values(OVERLAY_PALETTES)) expect(new Set(Object.values(p)).size).toBe(5)
  })
  it('persists, reloads, notifies and survives corrupt storage', () => {
    const st = mem()
    const a = new SettingsStore(st)
    const seen: number[] = []
    const off = a.subscribe((s) => seen.push(s.uiScale))
    a.update((s) => ({ ...s, uiScale: 1.25, fpsCap: 144 }))
    off()
    a.update((s) => ({ ...s, reducedMotion: true }))
    expect(seen).toEqual([1.25])
    const b = new SettingsStore(st)
    expect(b.get().fpsCap).toBe(144)
    expect(b.get().reducedMotion).toBe(true)
    st.m.set(SETTINGS_KEY, '{broken')
    expect(new SettingsStore(st).get()).toEqual(DEFAULT_SETTINGS)
    expect(new SettingsStore(undefined).reset()).toEqual(DEFAULT_SETTINGS)
  })
})
