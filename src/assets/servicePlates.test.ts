import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SERVICE_PLATE_BYTES, SERVICE_PLATE_NATIVE, SERVICE_PLATES, allAssetPaths, type ServicePlateId } from './manifest'
import { servicePlateTexture } from '../render/servicePlates'

function jpegSize(path: string): { w: number; h: number } {
  const buf = readFileSync(path)
  expect(buf[0]).toBe(0xff)
  expect(buf[1]).toBe(0xd8)
  let i = 2
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) break
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  throw new Error(`no SOF in ${path}`)
}

describe('service concept plates', () => {
  it('registers the three full-resolution JPEGs and does not downscale them', () => {
    for (const id of Object.keys(SERVICE_PLATES) as ServicePlateId[]) {
      const rel = SERVICE_PLATES[id]
      expect(allAssetPaths()).toContain(rel)
      const path = resolve('public', rel.replace(/^\//, ''))
      expect(statSync(path).size, id).toBe(SERVICE_PLATE_BYTES[id])
      expect(jpegSize(path), id).toEqual(SERVICE_PLATE_NATIVE)
    }
  })

  it('does not decode in Node', () => {
    expect(servicePlateTexture('bag_drop_kiosk')).toBeNull()
    expect(servicePlateTexture('baggage_claim')).toBeNull()
    expect(servicePlateTexture('passport_control')).toBeNull()
  })
})
