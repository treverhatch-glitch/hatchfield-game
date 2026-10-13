import * as THREE from 'three'
import { AIRLINES } from '../../game/catalog'
import { sharedMat } from './pool'
import type { Livery } from './specs'

/** Tail marks for the airlines in the catalog. Single-word names are not initials. */
const MARKS: Record<string, string> = {
  bushline: 'BL',
  northline: 'NL',
  harbor: 'HA',
  summit: 'SP',
  crown: 'CP',
  umazon: 'UA',
  upps: 'UP',
  exfed: 'EX',
}

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
}

export interface Brand {
  body: string
  stripe: string
  tail: string
  mark: string
}

export function resolveBrand(livery: Livery): Brand {
  const match = Object.values(AIRLINES).find(
    (airline) => airline.color.toLowerCase() === livery.body.toLowerCase(),
  )
  const raw = livery.mark || (match ? MARKS[match.id] : '') || 'HF'
  return {
    body: livery.body,
    stripe: livery.stripe,
    tail: livery.tail || livery.stripe,
    mark: raw.slice(0, 2).toUpperCase(),
  }
}

function logoTexture(mark: string, tail: string): THREE.DataTexture {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  const ink = new THREE.Color(tail)
  const ir = Math.round(ink.r * 255)
  const ig = Math.round(ink.g * 255)
  const ib = Math.round(ink.b * 255)
  const cx = 15.5
  const cy = 15.5
  const rad = 14
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const i = (y * size + x) * 4
      if (dx * dx + dy * dy > rad * rad) {
        data[i + 3] = 0
        continue
      }
      data[i] = 246
      data[i + 1] = 248
      data[i + 2] = 252
      data[i + 3] = 255
    }
  }
  const stamp = (ch: string, ox: number, oy: number) => {
    const rows = FONT[ch] ?? FONT.H
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] !== '1') continue
        for (let py = 0; py < 2; py++) {
          for (let px = 0; px < 2; px++) {
            const sx = ox + x * 2 + px
            const sy = oy + y * 2 + py
            if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue
            const i = (sy * size + sx) * 4
            data[i] = ir
            data[i + 1] = ig
            data[i + 2] = ib
            data[i + 3] = 255
          }
        }
      }
    }
  }
  stamp(mark[0] || 'H', 4, 9)
  stamp(mark[1] || 'F', 18, 9)
  const tex = new THREE.DataTexture(data, size, size)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function logoMaterials(brand: Brand): { opaque: THREE.Material; fade: THREE.Material } {
  const key = `logo:${brand.mark}:${brand.tail}`
  const opaque = sharedMat(key, () => {
    const map = logoTexture(brand.mark, brand.tail)
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    })
  })
  const fade = sharedMat(`fade:${key}`, () => {
    const copy = opaque.clone()
    copy.transparent = true
    copy.opacity = 1
    copy.depthWrite = true
    return copy
  })
  return { opaque, fade }
}
