import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine, CATEGORIES } from '../engine'
import { applyAudioSettings } from '../prefs'
import { clipUrls, installGestureUnlock, isAudioPayload, preloadAudioClips } from '../boot'
import { CLIP_FILES } from '../library'
import { claimAmbience, ambienceTargets, isOwnedLoop, releaseAmbience } from '../ambience'
import { ApronMixer, releaseApronAudio, syncApronAudio } from '../stage'
import { AUDIO_BUSES, sanitizeSettings } from '../../features/settings/settings'
import { MockAudioContext } from './mockAudio'

function make(state: MockAudioContext['state'] = 'running') {
  const ctx = new MockAudioContext()
  ctx.state = state
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: null, minRetriggerSec: 0 })
  return { ctx, engine }
}

const cam = { position: { x: 0, y: 8, z: 0 }, right: { x: 1, y: 0, z: 0 } }
const flight = { id: 'f1', airframeId: 'b738', craft: 'jet', phase: 'taxi_out', x: 4, y: 4, z: 0 }

afterEach(() => {
  releaseApronAudio()
  releaseAmbience()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('gesture unlock', () => {
  it('stays suspended until a pointer or key, including events that did not hit a button', () => {
    const { ctx, engine } = make('suspended')
    const target = new EventTarget()
    const stop = installGestureUnlock(target, engine)
    expect(engine.context).toBeNull()
    engine.play('uiClick')
    expect(engine.context).toBe(ctx)
    expect(ctx.state).toBe('suspended')
    target.dispatchEvent(new Event('pointerdown'))
    expect(ctx.state).toBe('running')
    ctx.state = 'suspended'
    target.dispatchEvent(new Event('keydown'))
    expect(ctx.state).toBe('running')
    stop()
    ctx.state = 'suspended'
    target.dispatchEvent(new Event('pointerdown'))
    expect(ctx.state).toBe('suspended')
  })
})

describe('clip load', () => {
  it('builds ogg then mp3 urls under the site base', () => {
    expect(clipUrls('crowd.ogg', '/')).toEqual(['/assets/audio/crowd.ogg', '/assets/audio/crowd.mp3'])
    expect(clipUrls('ui_click.ogg', './')).toEqual(['./assets/audio/ui_click.ogg', './assets/audio/ui_click.mp3'])
  })

  it('rejects an HTML shell and accepts ogg and mp3 bytes', () => {
    expect(isAudioPayload(new Uint8Array([0x3c, 0x21, 0x64, 0x6f]), 'text/html')).toBe(false)
    expect(isAudioPayload(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0]), 'application/octet-stream')).toBe(true)
    expect(isAudioPayload(new Uint8Array([0x49, 0x44, 0x33, 0x04]), 'audio/mpeg')).toBe(true)
    expect(isAudioPayload(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), '')).toBe(true)
  })

  it('warns when a clip 404s and decodes the mp3 fallback after unlock', async () => {
    const { engine } = make('running')
    const warns: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => { warns.push(args.join(' ')) })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const name = String(url)
      if (name.endsWith('.ogg')) return new Response('missing', { status: 404 })
      const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0])
      return new Response(bytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }))
    expect(await preloadAudioClips(engine, '/')).toBe(0)
    expect(engine.context).toBeNull()
    expect(warns.some((line) => line.includes('crowd.ogg') && line.includes('HTTP 404'))).toBe(true)
    engine.unlock()
    expect(await preloadAudioClips(engine, '/')).toBe(CLIP_FILES.length)
    expect(engine.hasClip('ui_click.ogg')).toBe(true)
  })

  it('warns when the response is the Pages HTML shell', async () => {
    const { engine } = make('running')
    engine.unlock()
    const warns: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => { warns.push(args.join(' ')) })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })))
    expect(await preloadAudioClips(engine, '/')).toBe(0)
    expect(warns.some((line) => line.includes('not an audio file'))).toBe(true)
    expect(warns.some((line) => line.includes('unavailable'))).toBe(true)
    expect(engine.hasClip('crowd.ogg')).toBe(false)
  })
})

describe('saved mix', () => {
  it('applies mute and every category before the context exists, then on the buses', () => {
    const { ctx, engine } = make()
    const mix = sanitizeSettings({
      audioMuted: true,
      masterVolume: 0.4,
      busVolume: { aircraft: 0.1, vehicles: 0.2, buildings: 0.3, ambient: 0.4, ambience: 0.5, ui: 0.6, sfx: 0.7 },
    })
    applyAudioSettings(mix, engine)
    expect(engine.context).toBeNull()
    expect(engine.isMuted()).toBe(true)
    engine.unlock()
    expect(ctx.gains[0].gain.value).toBe(0)
    applyAudioSettings({ ...mix, audioMuted: false }, engine)
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.4)
    for (const bus of AUDIO_BUSES) {
      expect(CATEGORIES).toContain(bus)
      expect(ctx.gains[1 + CATEGORIES.indexOf(bus)].gain.value).toBeCloseTo(mix.busVolume[bus])
    }
    applyAudioSettings({ ...mix, audioMuted: false, busVolume: { ...mix.busVolume, buildings: 0.05 } }, engine)
    expect(ctx.gains[1 + CATEGORIES.indexOf('buildings')].gain.value).toBeCloseTo(0.05)
    expect(ctx.gains[1 + CATEGORIES.indexOf('aircraft')].gain.value).toBeCloseTo(0.1)
  })
})

describe('single loop owner', () => {
  it('reuses a slotted loop instead of stacking it', () => {
    const { engine } = make()
    const first = engine.play('crowd', { slot: 'bed:crowd', intensity: 0.2 })
    const second = engine.play('crowd', { slot: 'bed:crowd', intensity: 0.9 })
    expect(second).toBe(first)
    expect(engine.activeCount()).toBe(1)
    first!.stop()
    expect(engine.activeCount()).toBe(0)
  })

  it('keeps one apron voice across syncs and drops it on release', () => {
    const { engine } = make()
    const snap = { view: 'apron' as const, flights: [flight], trucks: [] }
    syncApronAudio(snap, cam, engine)
    syncApronAudio(snap, cam, engine)
    expect(engine.activeCount()).toBe(1)
    releaseApronAudio()
    expect(engine.activeCount()).toBe(0)
    syncApronAudio(snap, cam, engine)
    expect(engine.activeCount()).toBe(1)
  })

  it('two apron mixers share the jet slot', () => {
    const { engine } = make()
    const snap = { view: 'apron' as const, flights: [flight], trucks: [] }
    new ApronMixer(engine).sync(snap, cam)
    new ApronMixer(engine).sync(snap, cam)
    expect(engine.activeCount()).toBe(1)
  })

  it('claims one ambience mixer and stops it on release', () => {
    const { engine } = make()
    const sink = { playSfx: (id: Parameters<typeof engine.playSfx>[0], options?: Parameters<typeof engine.playSfx>[1]) => engine.playSfx(id, options) }
    const first = claimAmbience(sink, () => 0)
    const second = claimAmbience(sink, () => 1)
    expect(second).toBe(first)
    first.update({ checkinOccupancy: 1 }, 0.1)
    first.update({ checkinOccupancy: 1 }, 0.1)
    expect(first.activeLayers()).toEqual(['checkinChatter'])
    expect(engine.activeCount()).toBe(1)
    releaseAmbience()
    expect(first.activeLayers()).toEqual([])
    expect(engine.activeCount()).toBe(0)
    expect(isOwnedLoop('beltLoader')).toBe(true)
    expect(isOwnedLoop('uiClick')).toBe(false)
  })

  it('gives belt and fuel to the apron mixer while that view is up', () => {
    const apron = ambienceTargets({ fuelPumpsRunning: 4, beltLoadersRunning: 4, apusRunning: 2, serviceOwner: 'apron', outdoorMix: 1 })
    expect(apron.fuelPump).toBe(0)
    expect(apron.beltLoader).toBe(0)
    expect(apron.apuHum).toBeGreaterThan(0)
    const hall = ambienceTargets({ fuelPumpsRunning: 4, beltLoadersRunning: 4, serviceOwner: 'ambience', outdoorMix: 0 })
    expect(hall.fuelPump).toBeGreaterThan(0)
    expect(hall.beltLoader).toBeGreaterThan(0)
  })
})
