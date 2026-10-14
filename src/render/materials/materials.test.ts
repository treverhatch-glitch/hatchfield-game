import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SurfaceLibrary } from './library'
import { paintSurface, surfacePngUrl, tileNoise } from './paint'

describe('surface textures', () => {
  it('tiles: the noise meets itself after one period', () => {
    expect(tileNoise(0.2, 0.4, 3)).toBeCloseTo(tileNoise(1.2, 1.4, 3), 6)
    expect(tileNoise(0, 0.5, 1)).toBeCloseTo(tileNoise(1, 0.5, 1), 6)
  })

  it('paints distinct tileable floor, wall and wood maps', () => {
    const floor = paintSurface('floor', 32)
    const wall = paintSurface('wall', 32)
    const wood = paintSurface('wood', 32)
    expect(floor).toHaveLength(32 * 32 * 4)
    expect(floor).toEqual(paintSurface('floor', 32))
    expect(floor).not.toEqual(wall)
    expect(wall).not.toEqual(wood)
    // Grout on the floor sits on the wrapped edge, so the tile repeats.
    const grout = (x: number, y: number) => floor[(y * 32 + x) * 4] < 120
    expect(grout(0, 4)).toBe(true)
    expect(grout(4, 0)).toBe(true)
    expect(grout(3, 3)).toBe(false)
  })

  it('shares materials and can swap in a PNG from public/textures/', () => {
    const lib = new SurfaceLibrary(16)
    const a = lib.material('desk', 0xffffff, 'wood')
    const b = lib.material('desk', 0xffffff, 'wood')
    expect(a).toBe(b)
    expect(lib.material('screen', 0x6ec6ff, undefined, true)).not.toBe(a)
    const wood = a as THREE.MeshLambertMaterial
    const procedural = wood.map
    expect(procedural?.wrapS).toBe(THREE.RepeatWrapping)

    const png = new THREE.DataTexture(new Uint8Array([9, 8, 7, 255]), 1, 1)
    const urls: string[] = []
    lib.loadPngs('/textures', {
      load(url, onLoad) {
        urls.push(url)
        if (url.endsWith('wood.png')) onLoad(png)
      },
    })
    expect(urls).toEqual([surfacePngUrl('floor'), surfacePngUrl('wall'), surfacePngUrl('wood')])
    expect(wood.map).toBe(png)
    expect(lib.maps.wood).toBe(png)
    expect(lib.maps.floor).toBeTruthy()
    lib.dispose()
  })
})