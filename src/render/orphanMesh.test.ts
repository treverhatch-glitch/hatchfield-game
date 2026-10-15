import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { schemeItems, schemeZones } from '../game/terminal.ts'
import { hallDetailPlacements, hallItemProp, hallPropAllowed, HALL_ITEM_PROP } from './hallKitDetail.ts'

const HALL_SRC = readFileSync(new URL('./hallWorld.ts', import.meta.url), 'utf8')

describe('hall orphan meshes v1', () => {
  it('does not parent the apron picture, a bridge, or a vehicle into the hall', () => {
    expect(HALL_SRC).not.toContain('new TerminalBuilding')
    expect(HALL_SRC).not.toContain('planTerminal')
    expect(HALL_SRC).not.toContain('buildInteriorDressing')
    expect(HALL_SRC).not.toContain('SupplyCartLayer')
    expect(HALL_SRC).not.toContain('HallFigureBatch')
    expect(HALL_SRC).not.toContain('jet_bridge')
    expect(HALL_SRC).not.toContain('placeJetBridge')
    expect(HALL_SRC).not.toContain('dockAirsideBridge')
    expect(HALL_SRC).not.toContain('performance.now')
    expect(HALL_SRC).not.toContain('Date.now')
    expect(HALL_SRC).toContain("hallRoot.name = 'hall-root'")
    const drawn = new Set(Object.values(HALL_ITEM_PROP))
    expect(drawn.has('jet_bridge')).toBe(false)
    expect(drawn.has('baggage_trolley')).toBe(false)
    expect(drawn.has('lounge_cluster')).toBe(false)
    const shell = HALL_SRC.slice(HALL_SRC.indexOf('private buildShell('), HALL_SRC.indexOf('private buildSecureWalls('))
    const live = shell.slice(0, shell.indexOf('return\n'))
    expect(live, 'the walk shell draws no fixed concourse columns through placed kit').not.toContain('0.42, h, 0.42')
  })

  it('keeps security props out of shops, including Runway Burger', () => {
    const zones = schemeZones(1)
    const securityDefs = /security|scanner|xray/
    for (const item of schemeItems(1)) {
      const zone = zones[item.r]?.[item.c]
      if (zone === 'retail' || item.def === 'cafe' || item.def === 'fast_food' || item.def === 'newsagent') {
        expect(item.def).not.toMatch(securityDefs)
        const prop = hallItemProp(item.def)
        expect(prop === 'security_lane' || prop === 'security_lane_ct' || prop === 'body_scanner').toBe(false)
      }
      if (securityDefs.test(item.def)) expect(zone).toBe('security')
    }
    const burger = hallDetailPlacements(
      [{ item: { id: 'burger', def: 'fast_food', c: 0, r: 0, wear: 0 }, x: 1, z: 2 }],
      8,
      5,
    )
    expect(burger.map((p) => p.type)).toEqual(['shop_fastfood'])
    expect(burger[0].scale).toBe(1)
    const cafe = hallDetailPlacements(
      [{ item: { id: 'cafe', def: 'cafe', c: 1, r: 0, wear: 0 }, x: 0, z: 0 }],
      8,
      5,
    )
    expect(cafe.map((p) => p.type)).toEqual(['shop_coffee'])
    expect(hallPropAllowed('passport_booth', 'checkin')).toBe(false)
    expect(hallPropAllowed('passport_booth', 'retail')).toBe(false)
    expect(hallPropAllowed('passport_booth', 'security')).toBe(false)
    expect(hallPropAllowed('passport_booth', 'arrivals')).toBe(true)
    expect(hallPropAllowed('passport_booth', 'claim')).toBe(true)
    expect(hallPropAllowed('cafe', 'retail')).toBe(true)
  })
})
