import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Game } from '../../game/sim'
import { lerpHex, lightsFactor, simClockToHour, skyState, sunDirection } from './daylight'
import { fitShadow, groundFocus, pickLod, stepFade } from './lod'
import { parseQuality, QUALITY, suggestQuality } from './quality'
import { GROUND_LOOK } from '../look'
import { fbm, paintAsphalt, paintConcrete, paintGrass, paintRoad, Raster, tileNoise } from './raster'

describe('day / night', () => {
  it('sim night matches lights-on hours', () => {
    const g = new Game()
    for (let clock = 0; clock < 360; clock += 3) {
      g.clock = clock
      const hour = simClockToHour(clock)
      if (g.isNight()) expect(hour >= 19 || hour < 8).toBe(true)
      else expect(hour >= 8 && hour < 19.01).toBe(true)
    }
    expect(simClockToHour(0)).toBe(8)
  })

  it('noon is bright with the sun high, midnight is lit by the field', () => {
    const noon = skyState(12)
    const night = skyState(0)
    expect(noon.sunDir.y).toBeGreaterThan(0.7)
    expect(noon.sunIntensity).toBeGreaterThan(night.sunIntensity * 4)
    expect(noon.lights).toBe(0)
    expect(night.lights).toBe(1)
    expect(lightsFactor(19.5)).toBeGreaterThan(0.9)
    expect(lightsFactor(7)).toBe(1)
    expect(Math.hypot(sunDirection(9).x, sunDirection(9).y, sunDirection(9).z)).toBeCloseTo(1)
    // Morning sun in the east (+x), evening in the west.
    expect(sunDirection(8).x).toBeGreaterThan(0)
    expect(sunDirection(18).x).toBeLessThan(0)
  })

  it('weather darkens, fogs, wets, and lights the field', () => {
    const clear = skyState(12, 'clear')
    const storm = skyState(12, 'storm')
    const fog = skyState(12, 'fog')
    expect(storm.sunIntensity).toBeLessThan(clear.sunIntensity * 0.5)
    expect(storm.precip).toBe(1)
    expect(storm.lightning).toBe(true)
    expect(storm.wet).toBe(1)
    expect(fog.fogFar).toBeLessThan(clear.fogFar / 2)
    expect(fog.lights).toBeGreaterThan(0)
    expect(lerpHex(0x000000, 0xffffff, 0.5)).toBe(0x808080)
  })
})

describe('LOD + shadows', () => {
  it('switches with hysteresis', () => {
    const t = [50, 100]
    expect(pickLod(0, 10, t)).toBe(0)
    expect(pickLod(0, 52, t)).toBe(0)
    expect(pickLod(0, 60, t)).toBe(1)
    expect(pickLod(1, 48, t)).toBe(1)
    expect(pickLod(1, 40, t)).toBe(0)
    expect(pickLod(0, 300, t)).toBe(2)
    expect(pickLod(2, 20, t)).toBe(0)
  })

  it('fades toward a target at a fixed rate', () => {
    expect(stepFade(0, 1, 0.1, 4)).toBeCloseTo(0.4)
    expect(stepFade(0.9, 1, 1, 4)).toBe(1)
    expect(stepFade(1, 0, 0.125, 4)).toBeCloseTo(0.5)
  })

  it('tightens the shadow box when zoomed in and snaps to texels', () => {
    const close = fitShadow(14, 3.3, 7.7, 1024)
    const far = fitShadow(150, 0, 0, 1024)
    expect(close.half).toBeLessThan(far.half)
    const texel = (close.half * 2) / 1024
    expect(Math.abs(close.x / texel - Math.round(close.x / texel))).toBeLessThan(1e-6)
  })

  it('finds the ground focus of a camera ray', () => {
    expect(groundFocus({ x: 0, y: 10, z: 10 }, { x: 0, y: -1, z: -1 })).toEqual({ x: 0, z: 0 })
    expect(groundFocus({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull()
  })
})

describe('quality presets', () => {
  it('parses and orders presets', () => {
    expect(parseQuality('high')).toBe('high')
    expect(parseQuality('medium')).toBe('med')
    expect(parseQuality('ultra', 'low')).toBe('low')
    expect(QUALITY.low.shadowMapSize).toBe(0)
    expect(QUALITY.med.shadowMapSize).toBeLessThan(QUALITY.high.shadowMapSize)
    expect(QUALITY.low.grassTufts).toBeLessThan(QUALITY.med.grassTufts)
    expect(QUALITY.med.grassTufts).toBeLessThan(QUALITY.high.grassTufts)
    expect(QUALITY.low.lodScale).toBeLessThan(QUALITY.high.lodScale)
    // Auto low (SwiftShader) keeps the new art off so the heavy run does not pay for it.
    expect(QUALITY.low.extraTextures).toBe(false)
    expect(QUALITY.low.animatedPeople).toBe(false)
    expect(QUALITY.low.thoughtBubbles).toBe(false)
    expect(QUALITY.low.crowdDetail).toBe(false)
    expect(QUALITY.med.animatedPeople).toBe(true)
    expect(QUALITY.high.crowdDetail).toBe(true)
    // r186 dropped PCFSoftShadowMap; high softens PCF with a radius instead.
    expect(QUALITY.high.shadowType).toBe(THREE.PCFShadowMap)
    expect(QUALITY.high.shadowRadius).toBeGreaterThan(QUALITY.med.shadowRadius)
  })

  it('suggests low on software GL', () => {
    expect(suggestQuality({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' })).toBe('low')
    expect(suggestQuality({ renderer: 'llvmpipe' })).toBe('low')
    expect(QUALITY.low.msaa).toBe(false)
    expect(QUALITY.low.trees).toBe(0)
    expect(QUALITY.low.precipitation).toBe(0)
    expect(QUALITY.low.pixelRatioCap).toBeLessThanOrEqual(0.6)
    expect(suggestQuality({ renderer: 'Apple M2', deviceMemory: 8, hardwareConcurrency: 8 })).toBe('high')
    expect(suggestQuality({ renderer: 'Intel Iris', deviceMemory: 4, hardwareConcurrency: 4 })).toBe('med')
  })
})

describe('procedural textures', () => {
  it('noise tiles seamlessly', () => {
    for (const y of [0, 0.37, 2.5]) expect(tileNoise(0, y, 8, 3)).toBeCloseTo(tileNoise(8, y, 8, 3))
    expect(fbm(0, 0.3, 4, 3)).toBeCloseTo(fbm(1, 0.3, 4, 3))
  })

  it('grass is green, deterministic, and mid-luma', () => {
    const a = paintGrass(32, 1)
    const b = paintGrass(32, 1)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    const [r, g, bl] = a.get(5, 5)
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(bl)
    expect(a.meanLuma()).toBeGreaterThan(50)
    expect(a.meanLuma()).toBeLessThan(170)
  })

  it('apron joints are darker than the slab, and roads are darker than taxiways', () => {
    const concrete = paintConcrete(48, 3)
    const luma = (px: number, py: number) => {
      const [r, g, b] = concrete.get(px, py)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    expect(luma(0, 8)).toBeLessThan(luma(8, 8))
    const road = paintRoad(32).meanLuma()
    const taxi = paintAsphalt(32, 2, GROUND_LOOK.taxiAsphalt).meanLuma()
    expect(road).toBeLessThan(taxi)
  })

  it('raster wraps writes for seamless stamps', () => {
    const r = new Raster(4, 4)
    r.set(-1, -1, [10, 20, 30])
    expect(r.get(3, 3)).toEqual([10, 20, 30, 255])
  })
})
