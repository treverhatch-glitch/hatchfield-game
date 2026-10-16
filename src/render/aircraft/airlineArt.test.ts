import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROSTER } from '../../airlines/roster'
import { airlineLogoUrl } from './airlineLogo'
import { selectLivery } from './airlineArt'
import { LIVERY_LONG_SIDE, jpegLiveryFits, liveryPreload, listedLivery } from './liveryFiles'

const GROK = ['bushline_local', 'zoomjet', 'crown_pacific', 'siam_breeze', 'northstar_cargo'] as const

describe('roster livery plates', () => {
  it('maps every Gemini carrier onto the airframes it flies, and leaves the five base carriers procedural', () => {
    const withRef = ROSTER.filter((airline) => airline.ref)
    const without = ROSTER.filter((airline) => !airline.ref)
    expect(ROSTER).toHaveLength(46)
    expect(withRef).toHaveLength(40)
    expect(without).toHaveLength(6)
    for (const airline of withRef) {
      expect(listedLivery(airline.id)).toBe(true)
      expect(liveryPreload(airline.id)).toBe(false)
      expect(airline.fleet.length).toBeGreaterThan(0)
      for (const model of airline.fleet) expect(jpegLiveryFits(airline.id, model)).toBe(true)
      expect(jpegLiveryFits(airline.id, 'f15')).toBe(false)
      expect(existsSync(`public/textures/liveries/${airline.id}/fuselage.jpg`)).toBe(true)
      expect(existsSync(`public/textures/liveries/${airline.id}/tail.jpg`)).toBe(true)
      expect(existsSync(`public/textures/liveries/${airline.id}/med/fuselage.jpg`)).toBe(true)
      expect(existsSync(`public/textures/liveries/${airline.id}/low/tail.jpg`)).toBe(true)
    }
    for (const airline of without) {
      if (airline.id === 'siam_breeze') {
        expect(listedLivery(airline.id)).toBe(true)
        expect(jpegLiveryFits(airline.id, 'a320neo')).toBe(true)
        continue
      }
      expect(listedLivery(airline.id)).toBe(false)
      expect(existsSync(`public/textures/liveries/${airline.id}/fuselage.jpg`)).toBe(false)
    }
    for (const id of GROK) {
      expect(listedLivery(id)).toBe(true)
      expect(liveryPreload(id)).toBe(true)
    }
  })

  it('wears the plate on a flown type and the procedural paint otherwise', () => {
    const brisa = ROSTER.find((airline) => airline.id === 'brisa')!
    const worn = selectLivery({ body: brisa.primary, stripe: brisa.secondary, airline: 'brisa' }, brisa.fleet[0])
    expect(worn.airline).toBe('brisa')
    const other = selectLivery({ body: brisa.primary, stripe: brisa.secondary, airline: 'brisa' }, 'b748f')
    expect(other.airline).toBeUndefined()
    const preview = selectLivery(
      { body: brisa.primary, stripe: brisa.secondary, airline: `brisa@${brisa.fleet[0]}` },
      brisa.fleet[0],
    )
    expect(preview.airline).toBe('brisa')
    const base = ROSTER.find((airline) => airline.id === 'air_lowcost_1')!
    const procedural = selectLivery(
      { body: base.primary, stripe: base.secondary, airline: base.id },
      base.fleet[0],
    )
    expect(procedural.airline).toBe(`${base.id}@${base.fleet[0]}`)
    const zoom = selectLivery({ body: '#111', stripe: '#eee', airline: 'zoomjet' }, 'a320neo')
    expect(zoom.airline).toBe('zoomjet')
    const wrong = selectLivery({ body: '#111', stripe: '#eee', airline: 'zoomjet' }, 'a380')
    expect(wrong.airline).toBeUndefined()
  })

  it('points the card and the tail at a quality-stepped logo, with no url for an unknown carrier', () => {
    expect(airlineLogoUrl('brisa', 'high')).toBe('/assets/airline-logos/brisa.jpg')
    expect(airlineLogoUrl('brisa', 'med')).toBe('/assets/airline-logos/med/brisa.jpg')
    expect(airlineLogoUrl('brisa', 'low')).toBe('/assets/airline-logos/low/brisa.jpg')
    expect(airlineLogoUrl('air_cargo_1', 'low')).toBe('/assets/airline-logos/low/air_cargo_1.jpg')
    expect(airlineLogoUrl('zoomjet', 'high')).toBe('/assets/airline-logos/zoomjet.jpg')
    expect(airlineLogoUrl('bushline', 'med')).toBe('/assets/airline-logos/med/bushline_local.jpg')
    expect(airlineLogoUrl('crown', 'low')).toBe('/assets/airline-logos/low/crown_pacific.jpg')
    expect(airlineLogoUrl('nobody', 'high')).toBeNull()
    for (const airline of ROSTER) {
      const url = airlineLogoUrl(airline.id, 'high')
      expect(url).toBeTruthy()
      expect(existsSync(`public${url}`)).toBe(true)
      expect(existsSync(`public/assets/airline-logos/low/${airline.id}.jpg`)).toBe(true)
    }
    expect(LIVERY_LONG_SIDE.high).toBe(4096)
    const plate = readFileSync('public/textures/liveries/brisa/fuselage.jpg')
    let width = 0
    for (let i = 2; i < plate.length - 8; i++) {
      if (plate[i] !== 0xff) continue
      const marker = plate[i + 1]
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        width = plate.readUInt16BE(i + 7)
        break
      }
      if (marker === 0xd8 || marker === 0xd9) {
        i += 1
        continue
      }
      i += 1 + plate.readUInt16BE(i + 2)
    }
    expect(width).toBeGreaterThan(1280)
  })
})
