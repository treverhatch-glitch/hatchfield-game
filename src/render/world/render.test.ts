import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { spawnHallGuest } from '../../game/guests'
import { blankView, rect, starterGame } from './fixtures'
import { initWorldRender, REPLACED_TILES, type RendererLike } from './index'
import { frameGeometry } from './environment'
import { fieldDraw } from '../../maps/index'
import { bake } from './kit'
import { paintGeometry, quadsGeometry } from './surfaces'
import { cellX, cellZ } from './view'
import { contactSpots } from './contact'

function legacyScene() {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#9fc5dd', 90, 220)
  const sun = new THREE.DirectionalLight('#fff3d4', 1.2)
  scene.add(sun, new THREE.HemisphereLight('#e8f3ff', '#6b8a4a', 0.85), new THREE.AmbientLight('#b9c9a8', 0.28))
  const earth = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshBasicMaterial())
  scene.add(earth)
  return { scene, sun, earth }
}

function hallFocus(game: { tiles: string[][] }) {
  let c = 0
  let r = 0
  let n = 0
  for (let rr = 0; rr < game.tiles.length; rr++) {
    for (let cc = 0; cc < game.tiles[rr].length; cc++) {
      if (game.tiles[rr][cc] !== 'terminal') continue
      c += cc
      r += rr
      n++
    }
  }
  return { x: cellX(n ? c / n : 16), z: cellZ(n ? r / n : 20) }
}

function stubRenderer(): RendererLike & { ratio: number } {
  return {
    shadowMap: { enabled: false, type: THREE.BasicShadowMap, autoUpdate: true },
    toneMappingExposure: 1,
    ratio: 1,
    setPixelRatio(n: number) {
      this.ratio = n
    },
  }
}

function camAt(x: number, z: number, dist: number) {
  const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 500)
  cam.position.set(x + dist * 0.5, dist * 0.7, z + dist * 0.5)
  cam.lookAt(x, 0, z)
  cam.updateMatrixWorld()
  return cam
}

describe('initWorldRender', () => {
  it('builds the starter airfield and adopts legacy lights', () => {
    const { scene, sun, earth } = legacyScene()
    const renderer = stubRenderer()
    const wr = initWorldRender(scene, 'med', { renderer, sun })
    const game = starterGame()
    wr.update(game, camAt(0, 0, 150), 1 / 60)
    const s = wr.stats()
    expect(s.terminals).toHaveLength(1)
    expect(s.jetBridges).toBe(2)
    expect(s.airfieldLights).toBeGreaterThan(100)
    expect(s.terminals[0].staff).toBeGreaterThan(10)
    expect(earth.visible).toBe(false)
    expect(renderer.shadowMap.enabled).toBe(true)
    expect(renderer.shadowMap.type).toBe(THREE.PCFShadowMap)
    expect(sun.castShadow).toBe(true)
    expect(scene.getObjectByName('world-contact')).toBeTruthy()
    expect(scene.getObjectByName('airfield-bloom')).toBeTruthy()
    expect(s.contacts).toBeGreaterThan(0)
    expect(contactSpots(game).length).toBe(s.contacts)
    expect(s.colorGrade).toBe(true)
    // No extra lights were added; the legacy trio is driven instead.
    expect(scene.children.filter((o) => o instanceof THREE.Light)).toHaveLength(3)
    wr.dispose()
    expect(earth.visible).toBe(true)
    expect(scene.getObjectByName('world-render')).toBeUndefined()
  })

  it('zooming in brings the interior + crowd in, zooming out drops them', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'med', { renderer: stubRenderer(), sun })
    const game = starterGame()
    const hall = hallFocus(game)
    const far = camAt(hall.x, hall.z, 220)
    for (let i = 0; i < 30; i++) wr.update(game, far, 1 / 30)
    expect(wr.stats().terminals[0].lod).toBe(2)
    expect(wr.stats().terminals[0].roof).toBe(1)
    const farMeshes = wr.stats().meshes
    const near = camAt(hall.x, hall.z, 16)
    for (let i = 0; i < 30; i++) wr.update(game, near, 1 / 30)
    const s = wr.stats()
    expect(s.terminals[0].lod).toBe(0)
    // Airport view keeps the roof and the walls up, even up close.
    expect(game.view).toBe('apron')
    expect(s.terminals[0].roof).toBe(1)
    expect(s.terminals[0].wallsLowered).toBe(0)
    expect(s.meshes).toBeGreaterThan(farMeshes)
    const seated = scene.getObjectByName('people-static')
    expect(seated?.visible || seated?.parent?.visible).toBe(true)
    expect(s.grassTufts).toBeGreaterThan(0)
    wr.dispose()
  })

  it('interior walls stand when zoomed out and cut away on the camera side up close', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'med', { renderer: stubRenderer(), sun })
    const game = starterGame()
    const hall = hallFocus(game)
    const mid = camAt(hall.x, hall.z, 70)
    for (let i = 0; i < 20; i++) wr.update(game, mid, 1 / 30)
    const t0 = wr.stats().terminals[0]
    expect(t0.rooms).toBe(9)
    expect(t0.walls).toBeGreaterThan(8)
    expect(t0.wallsLowered).toBe(0)
    expect(scene.getObjectByName('room-walls')).toBeTruthy()
    expect(scene.getObjectByName('room-glass')).toBeTruthy()
    // Full height is one merged mesh. The instanced set waits for the cutaway.
    expect(scene.getObjectByName('room-walls-static')?.visible).toBe(true)
    expect(scene.getObjectByName('room-glass-static')?.visible).toBe(true)
    expect(scene.getObjectByName('room-walls')?.visible).toBe(false)
    const near = camAt(hall.x, hall.z, 20)
    game.view = 'hall'
    for (let i = 0; i < 40; i++) wr.update(game, near, 1 / 30)
    const t1 = wr.stats().terminals[0]
    expect(t1.roof).toBe(0)
    expect(t1.wallsLowered).toBeGreaterThan(0)
    expect(t1.wallsLowered).toBeLessThan(t1.walls)
    expect(scene.getObjectByName('room-walls')?.visible).toBe(true)
    expect(scene.getObjectByName('room-walls-static')?.visible).toBe(false)
    wr.dispose()
  })

  it('hall guests walk their doorway route between frames', () => {
    // Spawn spots, routes and LOD picks use Math.random; pin it so the guest is reliably on screen.
    let seed = 7
    const rnd = vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    })
    try {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'high', { renderer: stubRenderer(), sun })
    const game = starterGame()
    game.spawnCool = 999
    const fit = game.fits[0]
    const g = spawnHallGuest('walk', 'depart', 'budget', { hallId: game.hallKey(fit) })
    g.needs.boarding = 80
    g.needs.hunger = 0
    g.needs.bladder = 0
    g.needs.shop = 0
    g.needs.play = 0
    g.needs.energy = 0
    g.needs.bags = 0
    g.node = 'entrance'
    g.clearedSec = false
    game.hallGuests = [g]
    game.routeGuest(g, 'security', game.hallOpenFor(fit))
    expect(g.route && g.route.length).toBeGreaterThan(1)
    // The crowd draws only what the camera sees, so aim at the guest once it has a spot.
    let near = camAt(hallFocus(game).x, hallFocus(game).z, 14)
    wr.update(game, near, 1 / 30)
    near = camAt(g.wx ?? 0, g.wz ?? 0, 14)
    for (let i = 0; i < 4; i++) wr.update(game, near, 1 / 30)
    // The guest may cross a detail level while walking, so look the body mesh up each time.
    const firstBody = (out: THREE.Matrix4) => {
      const body = ['people-torso', 'people-torsoLo', 'hall-guest-body']
        .map((name) => scene.getObjectByName(name) as THREE.InstancedMesh | undefined)
        .find((mesh) => mesh && mesh.count > 0)
      expect(body).toBeTruthy()
      body!.getMatrixAt(0, out)
    }
    const a = new THREE.Matrix4()
    const b = new THREE.Matrix4()
    firstBody(a)
    for (let i = 0; i < 6; i++) {
      game.tick(0.3)
      wr.update(game, near, 1 / 30)
    }
    firstBody(b)
    expect(a.equals(b)).toBe(false)
    expect(g.lost).toBeFalsy()
    wr.dispose()
    } finally {
      rnd.mockRestore()
    }
  })

  it('tints the sky by season while night lights still follow the clock', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'high', { renderer: stubRenderer(), sun })
    const game = starterGame()
    const cam = camAt(0, 0, 80)
    game.clock = 0
    wr.update(game, cam, 1 / 60)
    const spring = (scene.background as THREE.Color).getHex()
    game.clock = 100 * 180
    wr.update(game, cam, 1 / 60)
    const summer = (scene.background as THREE.Color).getHex()
    expect(summer).not.toBe(spring)
    expect(sun.intensity).toBeGreaterThan(0)
    wr.setTimeOfDay(2)
    wr.update(game, cam, 1 / 60)
    expect(wr.stats().lights).toBe(1)
    wr.setQuality('low')
    wr.setTimeOfDay(12)
    game.clock = 0
    wr.update(game, cam, 1 / 60)
    expect(wr.stats().grassTufts).toBe(0)
    wr.dispose()
  })

  it('night turns field lights on; quality swaps shadows', () => {
    const { scene, sun } = legacyScene()
    const renderer = stubRenderer()
    const wr = initWorldRender(scene, 'high', { renderer, sun })
    const game = starterGame()
    const cam = camAt(0, 0, 80)
    wr.setTimeOfDay(23)
    wr.update(game, cam, 1 / 60)
    expect(wr.stats().lights).toBe(1)
    expect(sun.shadow.mapSize.x).toBe(2048)
    wr.setQuality('low')
    wr.update(game, cam, 1 / 60)
    expect(renderer.shadowMap.enabled).toBe(false)
    expect(sun.castShadow).toBe(false)
    expect(wr.stats().grassTufts).toBe(0)
    expect(wr.stats().colorGrade).toBe(false)
    expect(wr.stats().lightBloom).toBe(false)
    expect(wr.stats().contacts).toBe(0)
    expect(scene.getObjectByName('airfield-bloom')).toBeUndefined()
    expect(scene.getObjectByName('world-contact')?.visible).toBe(false)
    wr.setDayNight({ hour: 12, daylight: 0, lights: 1 })
    wr.update(game, cam, 1 / 60)
    expect(wr.stats().lights).toBe(1)
    expect(sun.intensity).toBeLessThan(0.5)
    wr.setTimeOfDay(12)
    wr.setWeather('storm')
    wr.update(game, cam, 1 / 60)
    expect(scene.getObjectByName('world-weather')?.visible).toBe(true)
    wr.dispose()
  })

  it('lights the terminal before the field at dusk, and snows the grass in winter', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'high', { renderer: stubRenderer(), sun })
    const game = starterGame()
    const cam = camAt(0, 0, 80)
    const glass = () => {
      let intensity = 0
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.MeshLambertMaterial | undefined
        if (mat && mat.emissive && mat.emissive.getHex() === 0xffc070) intensity = Math.max(intensity, mat.emissiveIntensity)
      })
      return intensity
    }
    wr.setTimeOfDay(18)
    game.clock = 100 * 180
    wr.update(game, cam, 1 / 60)
    expect(wr.dayNightSample.windows).toBeGreaterThan(0)
    expect(wr.dayNightSample.runwayEdge).toBe(0)
    expect(wr.dayNightSample.taxiEdge).toBe(0)
    expect(wr.dayNightSample.apron).toBe(0)
    expect(glass()).toBeGreaterThan(0.05)
    expect(scene.getObjectByName('airfield-glow')?.visible).toBe(false)

    wr.setTimeOfDay(23)
    wr.update(game, cam, 1 / 60)
    expect(wr.dayNightSample.runwayEdge).toBe(1)
    expect(wr.dayNightSample.taxiEdge).toBe(1)
    expect(wr.dayNightSample.apron).toBe(1)
    expect(wr.dayNightSample.aircraft).toBe(1)
    expect(wr.dayNightSample.headlights).toBe(1)
    expect(wr.dayNightSample.apronPools).toBe(true)
    expect(scene.getObjectByName('airfield-glow')?.visible).toBe(true)
    expect(sun.position.y).toBeGreaterThan(10)

    wr.setTimeOfDay(12)
    wr.update(game, cam, 1 / 60)
    const summerGrass = (scene.getObjectByName('surface-grass') as THREE.Mesh).material as THREE.MeshLambertMaterial
    expect(summerGrass.emissiveIntensity).toBe(0)
    expect(wr.dayNightSample.snow).toBe(0)
    expect(wr.dayNightSample.seasonId).toBe('summer')

    game.clock = 300 * 180
    wr.update(game, cam, 1 / 60)
    expect(wr.dayNightSample.seasonId).toBe('winter')
    expect(wr.dayNightSample.snow).toBeGreaterThan(0.7)
    expect(summerGrass.emissiveIntensity).toBeGreaterThan(0.4)
    const farm = scene.getObjectByName('world-farmland') as THREE.Mesh
    expect((farm.material as THREE.MeshLambertMaterial).emissiveIntensity).toBeGreaterThan(0.3)

    const highSnow = wr.dayNightSample.snow
    wr.setQuality('low')
    wr.setTimeOfDay(23)
    wr.update(game, cam, 1 / 60)
    expect(wr.dayNightSample.snow).toBeGreaterThan(0.5)
    expect(wr.dayNightSample.snow).toBeLessThan(highSnow)
    expect(wr.dayNightSample.apronPools).toBe(false)
    expect(wr.dayNightSample.runwayEdge).toBe(1)
    expect(scene.getObjectByName('airfield-glow')?.visible).toBe(true)

    wr.setDayNight(null)
    wr.setTimeOfDay(12)
    wr.update(game, cam, 1 / 60)
    const daySun = sun.intensity
    wr.setDayNight({ daylight: 0, lights: 1 })
    wr.update(game, cam, 1 / 60)
    expect(sun.intensity).toBeLessThan(daySun * 0.25)
    expect(wr.dayNightSample.lights).toBe(1)
    wr.setTimeOfDay(null)
    wr.update(game, cam, 1 / 60)
    expect(wr.dayNightSample.lights).toBe(1)
    wr.setDayNight(null)
    wr.setTimeOfDay(12)
    wr.update(game, cam, 1 / 60)
    expect(wr.dayNightSample.lights).toBe(0)
    wr.dispose()
  })

  it('5x fast-forward goes lite without a rebuild', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'med', { renderer: stubRenderer(), sun })
    const game = starterGame()
    game.speed = 5
    wr.update(game, camAt(0, 0, 30), 1 / 60)
    expect(sun.castShadow).toBe(false)
    wr.dispose()
  })

  it('rebuilds only when mapRev changes', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'low', { sun })
    const v = blankView([...rect(4, 10, 14, 2, 'runway')])
    wr.update(v, camAt(0, 0, 80), 1 / 60)
    const first = scene.getObjectByName('surface-runway')
    wr.update(v, camAt(0, 0, 80), 1 / 60)
    expect(scene.getObjectByName('surface-runway')).toBe(first)
    v.tiles[3][3] = 'taxi'
    v.mapRev++
    wr.update(v, camAt(0, 0, 80), 1 / 60)
    expect(scene.getObjectByName('surface-runway')).not.toBe(first)
    expect(scene.getObjectByName('surface-taxi')).toBeTruthy()
    wr.dispose()
  })

  it('hides legacy tile meshes it redraws and keeps the rest', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'low', { sun })
    const v = blankView([[5, 5, 'runway'], [6, 5, 'hotel']])
    const group = new THREE.Group()
    const rw = new THREE.Object3D()
    rw.position.set(cellX(5), 0.02, cellZ(5))
    const hotel = new THREE.Object3D()
    hotel.position.set(cellX(6), 0.02, cellZ(6 - 1))
    const badge = new THREE.Object3D()
    badge.position.set(cellX(5) + 1.7, 0.12, cellZ(5) - 1.7)
    group.add(rw, hotel, badge)
    wr.hideLegacyTiles(group, v)
    expect(rw.visible).toBe(false)
    expect(badge.visible).toBe(false)
    expect(hotel.visible).toBe(true)
    expect(REPLACED_TILES.has('terminal')).toBe(true)
    wr.dispose()
  })
})

describe('map climate tint', () => {
  it('paints a desert sky and dunes, then restores the temperate field', () => {
    const { scene, sun } = legacyScene()
    const wr = initWorldRender(scene, 'med', { renderer: stubRenderer(), sun })
    const cam = camAt(0, 0, 80)
    const view = blankView([], { clock: 20, weather: 'clear' })
    wr.update(view, cam, 1 / 60)
    const plain = sun.color.getHex()
    const desert = fieldDraw('desert', 180)
    expect(desert?.skyAmount).toBeGreaterThan(0)
    wr.update({ ...view, mapDraw: desert }, cam, 1 / 60)
    expect(sun.color.getHex()).not.toBe(plain)
    const dunes = scene.getObjectByName('world-landscape')
    const ground = dunes?.children.find((child) => child instanceof THREE.Mesh)
    expect(ground).toBeInstanceOf(THREE.Mesh)
    expect(((ground as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex()).toBe(0xc4a36a)
    wr.update({ ...view, mapDraw: null }, cam, 1 / 60)
    expect(sun.color.getHex()).toBe(plain)
    const restored = scene.getObjectByName('world-landscape')
    const farmland = restored?.children.find((child) => child instanceof THREE.Mesh)
    expect(farmland).toBeInstanceOf(THREE.Mesh)
    expect(((farmland as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex()).toBe(0xb8c8a8)
    wr.dispose()
  })
})

describe('geometry builders', () => {
  it('ground quads use world-space UVs and point up', () => {
    const g = quadsGeometry([{ c: 0, r: 0 }, { c: 1, r: 0 }], { sub: 2, uvSize: 2 })
    expect(g.getAttribute('position').count).toBe(18)
    const n = g.getAttribute('normal')
    for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeCloseTo(1)
    const p = g.getAttribute('position')
    const uv = g.getAttribute('uv')
    expect(uv.getX(0)).toBeCloseTo(p.getX(0) / 2)
  })

  it('paint is one mesh with vertex colours', () => {
    const g = paintGeometry([
      { x: 0, z: 0, w: 1, d: 1, color: 'yellow' },
      { x: 2, z: 0, w: 1, d: 1, color: 'red' },
    ])
    expect(g.getAttribute('position').count).toBe(8)
    expect(g.getAttribute('color').getX(4)).toBeGreaterThan(g.getAttribute('color').getY(4))
  })

  it('outer ground frame leaves the plot uncovered and faces up', () => {
    const g = frameGeometry(10, 100, 1)
    const p = g.getAttribute('position')
    const idx = g.index!
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(p, idx.getX(i))
      b.fromBufferAttribute(p, idx.getX(i + 1))
      c.fromBufferAttribute(p, idx.getX(i + 2))
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
      expect(n.y).toBeGreaterThan(0)
      // Centroid sits outside the hole.
      const cx = (a.x + b.x + c.x) / 3
      const cz = (a.z + b.z + c.z) / 3
      expect(Math.max(Math.abs(cx), Math.abs(cz))).toBeGreaterThan(10)
    }
  })

  it('bakes static props into a single coloured geometry', () => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const g = bake([
      { geo: box, matrix: new THREE.Matrix4().makeTranslation(0, 0, 0), color: 0xff0000 },
      { geo: box, matrix: new THREE.Matrix4().makeTranslation(5, 0, 0), color: 0x00ff00 },
    ])!
    expect(g.getAttribute('position').count).toBe(72)
    expect(g.getAttribute('color').getX(0)).toBeCloseTo(1)
    expect(g.getAttribute('color').getY(40)).toBeCloseTo(1)
    expect(g.boundingSphere!.radius).toBeGreaterThan(2)
  })
})
