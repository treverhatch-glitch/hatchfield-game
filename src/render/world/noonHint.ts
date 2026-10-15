/**
 * Noon HDRI hint. A colour reference for the sun and the hemisphere lights.
 * It is never sampled on the sky dome.
 */
import type { Weather } from '../../game/types'
import { lerpHex } from './daylight'
import type { SkyPhotoBlend } from './dayNight'
import { landingArtUrl } from './landingArt'

export interface NoonHint {
  /** Brightest upper region. Drives the sun colour. */
  sun: number
  /** Upper sky, with the clipped disc left out. Drives the sky hemisphere. */
  sky: number
  /** Lower band. Drives the ground hemisphere. */
  ground: number
}

let loaded: NoonHint | null = null
let started = false

function pack(r: number, g: number, b: number): number {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)
}

function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Colours from an RGBA buffer, y = 0 at the top of the image.
 * The sun is the mean of the brightest upper pixels. The sky mean skips that clipped disc.
 */
export function noonHintFromPixels(data: ArrayLike<number>, w: number, h: number): NoonHint {
  const skyCut = Math.max(1, Math.floor(h * 0.28))
  const sunCut = Math.max(skyCut, Math.floor(h * 0.55))
  const groundCut = Math.min(h - 1, Math.floor(h * 0.82))
  let skyR = 0
  let skyG = 0
  let skyB = 0
  let skyN = 0
  let groundR = 0
  let groundG = 0
  let groundB = 0
  let groundN = 0
  let peak = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      if (y >= groundCut) {
        groundR += r
        groundG += g
        groundB += b
        groundN++
      }
      if (y < sunCut) peak = Math.max(peak, lum(r, g, b))
    }
  }
  const sunFloor = peak * 0.92
  let sunR = 0
  let sunG = 0
  let sunB = 0
  let sunN = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const bright = y < sunCut && lum(r, g, b) >= sunFloor
      if (bright) {
        sunR += r
        sunG += g
        sunB += b
        sunN++
      } else if (y < skyCut) {
        skyR += r
        skyG += g
        skyB += b
        skyN++
      }
    }
  }
  const mean = (r: number, g: number, b: number, n: number) =>
    n > 0 ? pack(Math.round(r / n), Math.round(g / n), Math.round(b / n)) : 0xffffff
  return {
    sun: mean(sunR, sunG, sunB, sunN),
    sky: mean(skyR, skyG, skyB, skyN),
    ground: mean(groundR, groundG, groundB, groundN),
  }
}

/** Last sample, or null until the browser has decoded the plate. */
export function noonHintColours(): NoonHint | null {
  return loaded
}

/** Decode the hint once. Node and a second call do nothing. */
export function loadNoonHint() {
  if (started || typeof document === 'undefined') return
  started = true
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    loaded = noonHintFromPixels(pixels, canvas.width, canvas.height)
  }
  img.src = landingArtUrl('hdri_hint_noon')
}

/**
 * Pull clear-noon sun and hemisphere colours toward the hint.
 * Leaves the sky dome on its panorama. Weather plates are left alone.
 */
export function tintNoonLights(
  sky: { sunColor: number; hemiSky: number; hemiGround: number },
  blend: SkyPhotoBlend,
  weather: Weather,
) {
  const hint = loaded
  if (!hint || weather !== 'clear') return
  const noon = (blend.a === 'noon' ? 1 - blend.t : 0) + (blend.b === 'noon' ? blend.t : 0)
  if (noon <= 0) return
  sky.sunColor = lerpHex(sky.sunColor, hint.sun, noon)
  sky.hemiSky = lerpHex(sky.hemiSky, hint.sky, noon)
  sky.hemiGround = lerpHex(sky.hemiGround, hint.ground, noon)
}
