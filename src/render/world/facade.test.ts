import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { starterGame } from './fixtures'
import { ENTRANCE_W, facadeOpenings, outwardYaw } from './facade'
import { OPPOSITE } from './layout'
import { terminals } from './layout'
import { DOOR_H, FLOOR_Y, makeTerminalShared, TerminalBuilding } from './terminal'
import { makeTextures } from './textures'

describe('terminal facade openings', () => {
  it('puts the entrance on the landside and a gate door on every airside bay', () => {
    const info = terminals(starterGame())[0]
    const openings = facadeOpenings(info)
    const entrance = openings.filter((o) => o.kind === 'entrance')
    const gates = openings.filter((o) => o.kind === 'gate')
    expect(entrance).toHaveLength(1)
    expect(entrance[0].side).toBe(OPPOSITE[info.airside])
    expect(gates.length).toBe(info.edges.filter((e) => e.side === info.airside).length)
    expect(gates.every((g) => g.side === info.airside)).toBe(true)
    expect(gates.length).toBeGreaterThan(0)
  })

  it('aims a docked bridge outward from each side', () => {
    const offset = (side: 'n' | 'e' | 's' | 'w') => {
      const yaw = outwardYaw(side)
      return { x: Math.cos(yaw), z: -Math.sin(yaw) }
    }
    expect(offset('e').x).toBeGreaterThan(0.9)
    expect(offset('w').x).toBeLessThan(-0.9)
    expect(offset('s').z).toBeGreaterThan(0.9)
    expect(offset('n').z).toBeLessThan(-0.9)
  })

  it('leaves the landside door clear in the curtain wall', () => {
    const game = starterGame()
    const info = terminals(game)[0]
    const textures = makeTextures(32, 1)
    const shared = makeTerminalShared(textures)
    const built = new TerminalBuilding(info, shared, { density: 1, walkersPerCell: 0, index: 0 })
    const entrance = facadeOpenings(info).find((o) => o.kind === 'entrance')
    expect(entrance).toBeTruthy()
    const curtains: THREE.Mesh[] = []
    built.root.traverse((obj) => {
      if (obj.name.startsWith('terminal-curtain-') && obj instanceof THREE.Mesh) curtains.push(obj)
    })
    expect(curtains.length).toBeGreaterThan(0)
    const limit = ENTRANCE_W * 0.2
    const head = FLOOR_Y + DOOR_H * 0.55
    let inDoor = 0
    for (const curtain of curtains) {
      const pos = curtain.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - entrance!.x
        const dz = pos.getZ(i) - entrance!.z
        if (Math.hypot(dx, dz) < limit && pos.getY(i) < head) inDoor++
      }
    }
    expect(inDoor).toBe(0)
    built.dispose()
    shared.beam.dispose()
    textures.dispose()
  })
})
