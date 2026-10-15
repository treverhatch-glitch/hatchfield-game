import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { gradeMaterial } from './grade'
import {
  ALWAYS_DAY,
  applyDayNightPref,
  chooseGraphicsQuality,
  dayNightCycleEnabled,
  explainGraphics,
  graphicsNote,
  graphicsQuality,
  setDayNightCycleEnabled,
  subscribeGraphicsQuality,
} from './graphicsPrefs'

describe('graphics quality setting', () => {
  it('explains the GPU guess', () => {
    expect(explainGraphics({ renderer: 'ANGLE (SwiftShader Device)' })).toMatchObject({
      level: 'low',
      reason: 'software graphics',
    })
    expect(explainGraphics({ renderer: 'llvmpipe' }).level).toBe('low')
    expect(explainGraphics({ renderer: 'Apple M2', deviceMemory: 8, hardwareConcurrency: 8 }).level).toBe('high')
    expect(explainGraphics({ renderer: 'Intel Iris', deviceMemory: 4, hardwareConcurrency: 4 })).toMatchObject({
      level: 'med',
      reason: 'this machine',
    })
  })

  it('saves a choice and tells listeners', () => {
    localStorage.removeItem('hatchfield-gfx')
    const seen: string[] = []
    const off = subscribeGraphicsQuality((level) => seen.push(level))
    chooseGraphicsQuality('low')
    expect(graphicsQuality()).toBe('low')
    chooseGraphicsQuality('medium')
    expect(graphicsQuality()).toBe('med')
    expect(seen).toEqual(['low', 'med'])
    off()
    expect(graphicsNote('low', { level: 'low', reason: 'software graphics' })).toContain('Low')
    expect(graphicsNote('high', { level: 'low', reason: 'software graphics' })).toContain('Saved on High')
  })

  it('round-trips the day/night cycle, on by default', () => {
    localStorage.removeItem('hatchfield-day-night')
    expect(dayNightCycleEnabled()).toBe(true)
    const seen: ({ hour: number; daylight: number; lights: number } | null)[] = []
    const world = { setDayNight: (control: { hour: number; daylight: number; lights: number } | null) => seen.push(control) }
    applyDayNightPref(world)
    expect(seen.at(-1)).toBeNull()
    setDayNightCycleEnabled(false)
    expect(dayNightCycleEnabled()).toBe(false)
    expect(localStorage.getItem('hatchfield-day-night')).toBe('off')
    applyDayNightPref(world)
    expect(seen.at(-1)).toEqual({ hour: ALWAYS_DAY.hour, daylight: ALWAYS_DAY.daylight, lights: ALWAYS_DAY.lights })
    setDayNightCycleEnabled(true)
    expect(dayNightCycleEnabled()).toBe(true)
    expect(localStorage.getItem('hatchfield-day-night')).toBe('on')
    applyDayNightPref(world)
    expect(seen.at(-1)).toBeNull()
  })
})

describe('colour grade', () => {
  it('inserts the grade after tone mapping and before the sRGB encode', () => {
    const mat = new THREE.MeshLambertMaterial()
    gradeMaterial(mat)
    gradeMaterial(mat)
    const shader = {
      fragmentShader: 'void main() {\n\t#include <tonemapping_fragment>\n\t#include <colorspace_fragment>\n}\n',
      uniforms: {},
    }
    mat.onBeforeCompile(shader as never, null as never)
    expect(shader.fragmentShader).toContain('hatchGrade')
    expect(shader.fragmentShader.indexOf('vec3 hatchGrade')).toBeLessThan(shader.fragmentShader.indexOf('void main'))
    expect(shader.fragmentShader.indexOf('hatchGrade(gl_FragColor.rgb)')).toBeGreaterThan(
      shader.fragmentShader.indexOf('tonemapping_fragment'),
    )
    expect(shader.fragmentShader.indexOf('hatchGrade(gl_FragColor.rgb)')).toBeLessThan(
      shader.fragmentShader.indexOf('colorspace_fragment'),
    )
    const basic = new THREE.MeshBasicMaterial()
    gradeMaterial(basic)
    expect(basic.userData.graded).toBeUndefined()
  })
})
