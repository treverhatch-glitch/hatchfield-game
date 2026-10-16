import { describe, expect, it } from 'vitest'
import { Game } from '../../game/sim.ts'
import { hostKey } from '../../stands/catalog.ts'
import { aircraftWorldPerMeter, BRIDGE_CAB_M, getAircraftSpec } from '../aircraft/specs.ts'
import { bridgeParts, posedApronBridge, type BridgePart } from './airfield.ts'
import { DIR_VEC, dockToAircraft, jetBridges, OPPOSITE, stands, type JetBridge } from './layout.ts'
import { cellX, cellZ, type BridgeCraft } from './view.ts'

const SEALED = new Set(['bridge-cab', 'bridge-bellows', 'bridge-tunnel-a', 'bridge-tunnel-b'])

function starterBridges(fit: Record<string, number>): JetBridge[] {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 2_000_000
  for (const [key, n] of Object.entries(fit)) {
    const [c, r] = key.split(',').map(Number)
    for (let i = 0; i < n; i++) game.fittings[hostKey('stand', c!, r!)] = [...(game.fittings[hostKey('stand', c!, r!)] ?? []), { id: 'jet_bridge' }]
    game.standAccess[key] = 'jetway'
  }
  return jetBridges(game, stands(game))
}

function standHeading(bridge: JetBridge): number {
  const game = new Game()
  game.autosave = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  const info = stands(game).find((s) => s.c === bridge.stand.c && s.r === bridge.stand.r)!
  const nose = DIR_VEC[OPPOSITE[info.entry]]
  return Math.atan2(nose.dr, nose.dc)
}

/** Footprint corners of a box part, world X/Z. */
function corners(part: BridgePart): { x: number; z: number }[] {
  const ax = Math.sin(part.yaw)
  const az = Math.cos(part.yaw)
  const out: { x: number; z: number }[] = []
  for (const a of [-0.5, 0.5]) {
    for (const s of [-0.5, 0.5]) {
      out.push({
        x: part.x + ax * part.sz * a + az * part.sx * s,
        z: part.z + az * part.sz * a - ax * part.sx * s,
      })
    }
  }
  return out
}

/** Aircraft-local meters: x along the nose, z across. */
function local(craft: BridgeCraft, p: { x: number; z: number }): { x: number; z: number } {
  const wu = aircraftWorldPerMeter()
  const dx = p.x - cellX(craft.x)
  const dz = p.z - cellZ(craft.y)
  const nx = Math.cos(craft.heading)
  const nz = Math.sin(craft.heading)
  return { x: (dx * nx + dz * nz) / wu, z: (-dx * nz + dz * nx) / wu }
}

/** Closest a sealed part comes to the fuselage side, meters past the skin (negative is inside). */
function skinClearance(bridge: JetBridge, craft: BridgeCraft): number {
  const spec = getAircraftSpec(craft.airframeId)
  let worst = Infinity
  for (const part of bridgeParts(bridge)) {
    if (!SEALED.has(part.name)) continue
    for (const corner of corners(part)) {
      const p = local(craft, corner)
      if (Math.abs(p.x) > spec.lengthM / 2) continue
      worst = Math.min(worst, Math.abs(p.z) - spec.rx)
    }
  }
  return worst
}

describe('jet bridge seal on the parked aircraft', () => {
  const [bridge] = starterBridges({ '12,7': 1 })
  const heading = standHeading(bridge!)

  it.each(['crj700', 'e175', 'b738', 'a320', 'b789'])('docks the %s door from outside the skin', (airframeId) => {
    for (const h of [heading, heading + Math.PI]) {
      const craft = { airframeId, x: 12, y: 7, heading: h }
      const target = dockToAircraft(bridge!, craft)
      expect(target).toBeTruthy()
      const spec = getAircraftSpec(airframeId)
      const face = local(craft, target!.cab)
      expect(Math.abs(face.z)).toBeCloseTo(spec.rx + BRIDGE_CAB_M.gapM, 4)
      for (let e = 0; e <= 1.0001; e += 0.05) {
        const posed = posedApronBridge(bridge!, e, craft)
        expect(skinClearance(posed, craft)).toBeGreaterThan(0.05)
      }
      const docked = posedApronBridge(bridge!, 1, craft)
      expect(docked.cab.x).toBeCloseTo(target!.cab.x)
      expect(docked.cab.z).toBeCloseTo(target!.cab.z)
      // The cab looks straight at the fuselage once docked.
      const f = docked.cabFace!
      const lat = local(craft, { x: cellX(12) + f.x, z: cellZ(7) + f.z })
      expect(Math.abs(lat.x)).toBeLessThan(1e-6)
    }
  })

  it('parks beside the rotunda at extend 0, off the facade', () => {
    const craft = { airframeId: 'b738', x: 12, y: 7, heading }
    const parked = posedApronBridge(bridge!, 0, craft)
    expect(Math.hypot(parked.cab.x - bridge!.root.x, parked.cab.z - bridge!.root.z)).toBeLessThan(3.5)
    const n = DIR_VEC[bridge!.side]
    const rot = bridgeParts(parked).find((p) => p.name === 'bridge-rotunda')!
    const out = (rot.x - bridge!.root.x) * n.dc + (rot.z - bridge!.root.z) * n.dr
    expect(out).toBeGreaterThan(0.55)
    const open = posedApronBridge(bridge!, 1, craft)
    const rotOpen = bridgeParts(open).find((p) => p.name === 'bridge-rotunda')!
    expect(rotOpen.x).toBeCloseTo(rot.x)
    expect(rotOpen.z).toBeCloseTo(rot.z)
  })

  it('hands each widebody bridge its own door, and parks a bridge with no door', () => {
    const pair = starterBridges({ '12,7': 2 })
    expect(pair).toHaveLength(2)
    const wide = { airframeId: 'b789', x: 12, y: 7, heading }
    const a = dockToAircraft(pair[0]!, wide)!
    const b = dockToAircraft(pair[1]!, wide)!
    expect(Math.hypot(a.cab.x - b.cab.x, a.cab.z - b.cab.z)).toBeGreaterThan(2)
    const narrow = { airframeId: 'b738', x: 12, y: 7, heading }
    expect(dockToAircraft(pair[0]!, narrow)).toBeTruthy()
    expect(dockToAircraft(pair[1]!, narrow)).toBeNull()
    const idle = posedApronBridge(pair[1]!, 1, narrow)
    expect(Math.hypot(idle.cab.x - pair[1]!.root.x, idle.cab.z - pair[1]!.root.z)).toBeLessThan(3.5)
  })
})
