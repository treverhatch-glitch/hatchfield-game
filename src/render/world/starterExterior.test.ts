import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WORLD_PER_METER } from '../aircraft/specs'
import { ENTRANCE_W, facadeOpenings } from './facade'
import { starterGame } from './fixtures'
import { terminals } from './layout'
import { metreUv } from './starterExterior'
import { FLOOR_Y, makeTerminalShared, ROOF_Y, TerminalBuilding } from './terminal'
import { makeTextures } from './textures'

function build() {
  const info = terminals(starterGame())[0]
  const textures = makeTextures(32, 1)
  const shared = makeTerminalShared(textures)
  const built = new TerminalBuilding(info, shared, { density: 1, walkersPerCell: 0, index: 0 })
  const named = (prefix: string) => {
    const out: THREE.Mesh[] = []
    built.root.traverse((o) => {
      if (o.name.startsWith(prefix) && o instanceof THREE.Mesh) out.push(o)
    })
    return out
  }
  const done = () => {
    built.dispose()
    shared.beam.dispose()
    textures.dispose()
  }
  return { info, built, named, done }
}

const cam = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

describe('starter terminal exterior', () => {
  it('maps plates in metres from baked positions', () => {
    const geo = new THREE.BoxGeometry(2 * WORLD_PER_METER, 1, 1)
    metreUv(geo, 2)
    const uv = geo.getAttribute('uv')
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(nor.getZ(i)) > 0.9) expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / (WORLD_PER_METER * 2), 5)
    }
    geo.dispose()
  })

  it('dresses the shell with cladding, plinth, canopy soffit, parapet and roof plant, all casting and receiving shadows', () => {
    const { named, done } = build()
    for (const prefix of ['starter-clad-', 'starter-frame-', 'starter-plinth-', 'starter-soffit-', 'starter-posts-', 'starter-parapet-', 'starter-coping-', 'starter-deck-', 'starter-skylight-', 'starter-plant-']) {
      const meshes = named(prefix)
      expect(meshes.length, prefix).toBeGreaterThan(0)
      expect(meshes.every((m) => m.castShadow && m.receiveShadow), prefix).toBe(true)
    }
    expect(named('terminal-curtain-').every((m) => m.receiveShadow)).toBe(true)
    done()
  })

  it('wears the exterior set in the airport view and gives the terminal view its see-through glass back', () => {
    const { built, named, done } = build()
    const c = built.center
    const far = cam(c.x + 60, 40, c.z + 60)
    built.update(far, 1 / 30, 1, 0, undefined, true)
    const curtains = named('terminal-curtain-')
    expect(curtains.every((m) => (m.material as THREE.Material).name === 'starter:glass')).toBe(true)
    expect(named('starter-deck-').every((m) => m.visible)).toBe(true)
    expect(named('terminal-sky-').every((m) => !m.visible)).toBe(true)
    built.update(cam(c.x + 61, 40, c.z + 60), 1 / 30, 1, 0, undefined, false)
    expect(curtains.every((m) => (m.material as THREE.Material).name !== 'starter:glass')).toBe(true)
    expect(named('starter-deck-').every((m) => !m.visible)).toBe(true)
    expect(named('terminal-sky-').every((m) => m.visible)).toBe(true)
    done()
  })

  it('keeps the entrance clear: no exterior piece sits in the door opening below the head', () => {
    const { info, named, done } = build()
    const entrance = facadeOpenings(info).find((o) => o.kind === 'entrance')!
    const half = ENTRANCE_W * 0.45
    let blocked = 0
    for (const prefix of ['starter-doors-', 'starter-frame-', 'starter-clad-', 'starter-posts-']) {
      for (const mesh of named(prefix)) {
        const pos = mesh.geometry.getAttribute('position')
        for (let i = 0; i < pos.count; i++) {
          const dx = pos.getX(i) - entrance.x
          const dz = pos.getZ(i) - entrance.z
          const y = pos.getY(i)
          if (Math.hypot(dx, dz) < half && y > FLOOR_Y + 0.05 && y < FLOOR_Y + 1.5 * WORLD_PER_METER) blocked++
        }
      }
    }
    expect(blocked).toBe(0)
    done()
  })

  it('brings the night interior up and stays under the parapet line', () => {
    const { built, named, done } = build()
    const c = built.center
    built.update(cam(c.x + 60, 40, c.z + 60), 1 / 30, 1, 1, undefined, true)
    const glass = named('terminal-curtain-')[0].material as THREE.MeshStandardMaterial
    expect(glass.emissiveIntensity).toBeGreaterThan(0.5)
    let top = 0
    for (const mesh of named('starter-')) {
      mesh.geometry.computeBoundingBox()
      top = Math.max(top, mesh.geometry.boundingBox!.max.y)
    }
    expect(top).toBeLessThan(ROOF_Y + 2 * WORLD_PER_METER)
    done()
  })
})
