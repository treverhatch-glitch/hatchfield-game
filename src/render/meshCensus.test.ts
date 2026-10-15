import { describe, expect, it } from 'vitest'
import { starterGame } from './world/fixtures'
import { initWorldRender, type RendererLike } from './world/index'
import * as THREE from 'three'
import { repeatedMeshes, repeatedShapes } from './meshCensus'

function stubRenderer(): RendererLike {
  return {
    shadowMap: { enabled: false, type: THREE.BasicShadowMap, autoUpdate: true },
    toneMappingExposure: 1,
    setPixelRatio() {},
  }
}

// Same world init as render.test.ts: near the 5 s default on this VM with full exterior meshes.
describe('apron mesh census', { timeout: 20_000 }, () => {
  it('lists the most repeated individual meshes on the starter field', () => {
    const scene = new THREE.Scene()
    const sun = new THREE.DirectionalLight()
    scene.add(sun)
    const wr = initWorldRender(scene, 'high', { renderer: stubRenderer(), sun })
    const game = starterGame()
    wr.update(game, new THREE.PerspectiveCamera(), 1 / 60)
    const shared = repeatedMeshes(scene).filter((row) => row.count > 1)
    const shapes = repeatedShapes(scene).filter((row) => row.count > 1)
    // Starter apron repeats are signs, not the passenger-budget body parts.
    expect(shared).toEqual([])
    expect(shapes.map((row) => `${row.name}:${row.count}:${row.triangles}`)).toEqual([
      'PlaneGeometry|v4:8:16',
      'gate-sign|v4:6:12',
      'wayfinding-sign|v4:4:8',
    ])
    wr.dispose()
  })
})