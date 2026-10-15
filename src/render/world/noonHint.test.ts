import { describe, expect, it } from 'vitest'
import { LANDING_FILES, LANDING_NATIVE } from './landingArt'
import { SKY_PHOTOS } from './dayNight'
import { noonHintFromPixels, tintNoonLights } from './noonHint'

describe('noon HDRI hint', () => {
  it('stays off the sky dome', () => {
    expect(LANDING_FILES.hdri_hint_noon).toBe('lighting/hdri_hint_noon.jpeg')
    expect(LANDING_NATIVE.hdri_hint_noon).toEqual({ w: 2912, h: 1440 })
    for (const photo of Object.values(SKY_PHOTOS)) expect(photo.url).not.toContain('hdri')
  })

  it('reads sun, sky, and ground from an RGBA buffer', () => {
    const w = 4
    const h = 4
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 20
      data[i + 1] = 40
      data[i + 2] = 80
      data[i + 3] = 255
    }
    // One clipped sun pixel in the top row, and a pale ground row.
    data[0] = 255
    data[1] = 250
    data[2] = 240
    for (let x = 0; x < w; x++) {
      const i = ((h - 1) * w + x) * 4
      data[i] = 180
      data[i + 1] = 170
      data[i + 2] = 150
    }
    const hint = noonHintFromPixels(data, w, h)
    expect(hint.sun).toBe(0xfffaf0)
    expect((hint.sky >> 16) & 255).toBeLessThan(80)
    expect((hint.ground >> 16) & 255).toBeGreaterThan(150)
  })

  it('tints clear noon lights and leaves a storm alone', () => {
    const sky = { sunColor: 0x000000, hemiSky: 0x000000, hemiGround: 0x000000 }
    tintNoonLights(sky, { a: 'noon', b: 'noon', t: 0 }, 'clear')
    expect(sky.sunColor).toBe(0)
    tintNoonLights(sky, { a: 'storm', b: 'storm', t: 0 }, 'storm')
    expect(sky).toEqual({ sunColor: 0, hemiSky: 0, hemiGround: 0 })
  })
})
