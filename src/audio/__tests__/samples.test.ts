import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AudioEngine } from '../engine'
import {
  CLIP_FILE, CLIP_FILES, REQUIRED_ROLES, aircraftSample, sfxSample, soundSample,
} from '../library'
import { ApronMixer, cellToWorld } from '../stage'
import { CELL } from '../../render/aircraft/specs'
import { MockAudioContext } from './mockAudio'
import { sanitizeSettings } from '../../features/settings/settings'

const root = new URL('../../../public/assets/audio/', import.meta.url)

function makeEngine() {
  const ctx = new MockAudioContext()
  return { ctx, audio: new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: null, minRetriggerSec: 0 }) }
}

function fakeBuffer(seconds = 0.4): AudioBuffer {
  return { duration: seconds, getChannelData: () => new Float32Array(8) } as unknown as AudioBuffer
}

describe('CC0 clips', () => {
  it('ships every required role as a small ogg', () => {
    const onDisk = readdirSync(root).filter((name) => name.endsWith('.ogg')).sort()
    expect(onDisk).toEqual([...CLIP_FILES].sort())
    const credits = readFileSync(new URL('../../../CREDITS.md', import.meta.url), 'utf8')
    let total = 0
    for (const id of REQUIRED_ROLES) {
      const file = CLIP_FILE[id]
      const size = statSync(new URL(file, root)).size
      total += size
      expect(size, file).toBeLessThan(80_000)
      expect(credits).toContain(file)
    }
    expect(total).toBeLessThan(400_000)
    for (const file of CLIP_FILES) {
      const mp3 = file.replace(/\.ogg$/, '.mp3')
      const size = statSync(new URL(mp3, root)).size
      expect(size, mp3).toBeGreaterThan(200)
      expect(size, mp3).toBeLessThan(80_000)
    }
    for (const author of ['Kenney', 'kyles', 'craigsmith', 'papedo', 'wshintani', 'ibirdfilm', 'Disasteradio', 'Kinoton', 'gezortenplotz']) {
      expect(credits).toContain(author)
    }
  })

  it('maps crowd, jets, vehicles, belts, cash, contracts and alerts', () => {
    expect(sfxSample('crowdMurmur')?.clip).toBe('crowd')
    expect(sfxSample('checkinChatter')?.clip).toBe('crowd')
    expect(sfxSample('paAnnouncement')?.clip).toBe('pa')
    expect(sfxSample('boardingChime')?.clip).toBe('pa')
    expect(sfxSample('reversingBeeper')?.clip).toBe('reverse')
    expect(sfxSample('hydrantPump')?.clip).toBe('refuel')
    expect(sfxSample('beltLoader')?.clip).toBe('belt')
    expect(sfxSample('heavyFuelTruck')?.clip).toBe('vehicle')
    expect(sfxSample('cashInTick')?.clip).toBe('cash')
    expect(sfxSample('contractOffer')?.clip).toBe('contract')
    expect(sfxSample('disruptionAlert')?.clip).toBe('alert')
    expect(soundSample('uiClick')?.clip).toBe('click')
    expect(aircraftSample('taxi')?.clip).toBe('jetTaxi')
    expect(aircraftSample('takeoff')?.clip).toBe('jetTakeoff')
    expect(aircraftSample('landing')?.clip).toBe('jetLanding')
    expect(aircraftSample('approach')?.clip).toBe('jetLanding')
  })

  it('plays a decoded clip instead of an oscillator', () => {
    const { ctx, audio: engine } = makeEngine()
    const buf = fakeBuffer(0.2)
    engine.setClip('ui_click.ogg', buf)
    const before = ctx.sources.length
    const handle = engine.play('uiClick')
    expect(handle).not.toBeNull()
    expect(handle!.looping).toBe(false)
    const src = ctx.sources[ctx.sources.length - 1]
    expect(ctx.sources.length).toBe(before + 1)
    expect(src.buffer).toBe(buf)
    expect(src.loop).toBe(false)
    ctx.currentTime = 2
    expect(engine.activeCount()).toBe(0)
  })

  it('keeps a jet loop alive and attenuates it with distance', () => {
    const { ctx, audio: engine } = makeEngine()
    engine.unlock()
    const buses = ctx.gains.length
    const mixer = new ApronMixer(engine)
    const flight = { id: 'f1', airframeId: 'b738', craft: 'jet', phase: 'taxi_out', x: 10, y: 12, z: 0.2 }
    const pos = cellToWorld(flight.x, flight.y, 1.5 + flight.z * CELL * 0.2)
    const right = { x: 1, y: 0, z: 0 }
    mixer.sync(
      { view: 'apron', flights: [flight], trucks: [] },
      { position: pos, right },
    )
    expect(mixer.active()).toBe(1)
    expect(engine.spatialGainAt(pos)).toBeCloseTo(1)
    const voice = ctx.gains[buses]
    expect(voice.gain.value).toBeCloseTo(1)
    mixer.sync(
      { view: 'apron', flights: [flight], trucks: [] },
      { position: { x: pos.x + 5000, y: 0, z: pos.z }, right },
    )
    expect(voice.gain.value).toBe(0)
    mixer.sync(
      { view: 'apron', flights: [{ ...flight, phase: 'parked' }], trucks: [] },
      { position: pos, right },
    )
    expect(mixer.active()).toBe(0)
  })

  it('starts an engine and a reversing beep, and a belt while bags dwell', () => {
    const { audio: engine } = makeEngine()
    const mixer = new ApronMixer(engine)
    const cam = { position: { x: 0, y: 8, z: 0 }, right: { x: 1, y: 0, z: 0 } }
    const path = [{}, {}]
    mixer.sync({
      view: 'apron',
      flights: [],
      trucks: [{ id: 't1', kind: 'fuel', x: 4, y: 4, returning: true, dwell: 0, preDwell: 0, path }],
    }, cam)
    expect(mixer.active()).toBe(1)
    mixer.sync({
      view: 'apron',
      flights: [],
      trucks: [{ id: 't1', kind: 'fuel', x: 4, y: 4, returning: false, dwell: 0, preDwell: 0, path, reversing: true }],
    }, cam)
    expect(mixer.active()).toBe(2)
    mixer.sync({
      view: 'apron',
      flights: [],
      trucks: [{ id: 't1', kind: 'bags', x: 4, y: 4, returning: false, dwell: 3, preDwell: 0, path: [] }],
    }, cam)
    expect(mixer.active()).toBe(1)
    mixer.sync({ view: 'hall', flights: [], trucks: [] }, cam)
    expect(mixer.active()).toBe(0)
  })

  it('settings mute and bus volumes clamp', () => {
    const s = sanitizeSettings({ audioMuted: true, masterVolume: 2, busVolume: { aircraft: 4, ui: -3 } })
    expect(s.audioMuted).toBe(true)
    expect(s.masterVolume).toBe(1)
    expect(s.busVolume.aircraft).toBe(1)
    expect(s.busVolume.ui).toBe(0)
    expect(s.busVolume.vehicles).toBeGreaterThan(0)
    expect(sanitizeSettings(null).audioMuted).toBe(false)
  })
})
