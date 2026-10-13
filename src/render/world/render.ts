import * as THREE from 'three'
import type { Weather } from '../../game/types'
import { AirfieldLights, buildJetBridges, setBridgeNight } from './airfield'
import { simClockToHour, skyState, type SkyState } from './daylight'
import { buildLandscape, GrassRing, Rain, SkyDome } from './environment'
import {
  apronMasts,
  jetBridges,
  roadPaint,
  runwayLightSpots,
  runwayPaint,
  runways,
  standPaint,
  stands,
  taxiLightSpots,
  taxiPaint,
  terminals,
} from './layout'
import { fitShadow, groundFocus } from './lod'
import { QUALITY, type QualityLevel, type QualityPreset } from './quality'
import { paintGeometry, quadsGeometry, surfaceCells, type SurfaceKind } from './surfaces'
import type { RoomPlan } from './rooms'
import { disposeTerminalShared, makeTerminalShared, TerminalBuilding, type TerminalShared } from './terminal'
import { makeTextures, type WorldTextures } from './textures'
import { worldToCell, type WorldView } from './view'

/** Minimal renderer surface we touch, so tests can pass a stub. */
export interface RendererLike {
  shadowMap: { enabled: boolean; type: THREE.ShadowMapType; needsUpdate?: boolean; autoUpdate?: boolean }
  toneMappingExposure: number
  setPixelRatio?(n: number): void
}

export interface WorldRenderOptions {
  renderer?: RendererLike
  /** Use this light as the sun instead of searching the scene. */
  sun?: THREE.DirectionalLight
  /** Hide legacy root-level ground discs (earth / horizon) and take over fog + sky. Default true. */
  replaceEnvironment?: boolean
}

export interface WorldRenderStats {
  quality: QualityLevel
  hour: number
  weather: Weather
  lights: number
  terminals: ({ lod: number } & ReturnType<TerminalBuilding['counts']>)[]
  airfieldLights: number
  jetBridges: number
  grassTufts: number
  meshes: number
  instances: number
  shadowMapSize: number
}

/** Tiles this layer redraws; the legacy World should skip (or hide) its own meshes for these. */
export const REPLACED_TILES = new Set(['grass', 'runway', 'taxi', 'stand', 'road', 'terminal'])

const SURFACE_Y: Record<SurfaceKind, number> = { grass: 0.004, pad: 0.008, runway: 0.012, taxi: 0.012, apron: 0.012, road: 0.012 }

export class WorldRenderer {
  readonly root = new THREE.Group()
  quality: QualityLevel
  private q: QualityPreset
  private scene: THREE.Scene
  private renderer?: RendererLike
  private sun: THREE.DirectionalLight
  private hemi: THREE.HemisphereLight
  private ambient: THREE.AmbientLight
  private ownLights: THREE.Light[] = []
  private hidden: THREE.Object3D[] = []
  private fog: THREE.Fog
  private prevFog: THREE.Fog | THREE.FogExp2 | null
  private prevBackground: THREE.Scene['background']
  private sky = new SkyDome()
  private tex!: WorldTextures
  private shared!: TerminalShared
  private surfaceMats = new Map<SurfaceKind, THREE.MeshLambertMaterial>()
  private paintMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 })
  private staticGroup = new THREE.Group()
  private staticGeos: THREE.BufferGeometry[] = []
  private bridgeMats: THREE.Material[] = []
  private buildings: TerminalBuilding[] = []
  private lights!: AirfieldLights
  private landscape: { group: THREE.Group; dispose: () => void } | null = null
  private grass!: GrassRing
  private rain!: Rain
  private builtRev = -1
  private bridgeCount = 0
  private hourOverride: number | null = null
  private weatherOverride: Weather | null = null
  private lite = false
  private flash = 0
  private state: SkyState = skyState(11)
  private legacyKey = ''
  private time = 0
  private frame = 0
  private lastShadowKey = ''

  constructor(scene: THREE.Scene, quality: QualityLevel, opts: WorldRenderOptions = {}) {
    this.scene = scene
    this.renderer = opts.renderer
    this.quality = quality
    this.q = QUALITY[quality]
    this.root.name = 'world-render'
    this.root.add(this.staticGroup)

    const found = { dir: opts.sun ?? null, hemi: null as THREE.HemisphereLight | null, amb: null as THREE.AmbientLight | null }
    for (const o of scene.children) {
      if (!found.dir && o instanceof THREE.DirectionalLight) found.dir = o
      else if (!found.hemi && o instanceof THREE.HemisphereLight) found.hemi = o
      else if (!found.amb && o instanceof THREE.AmbientLight) found.amb = o
    }
    const own = <T extends THREE.Light>(l: T) => (this.ownLights.push(l), scene.add(l), l)
    this.sun = found.dir ?? own(new THREE.DirectionalLight(0xffffff, 1.2))
    this.hemi = found.hemi ?? own(new THREE.HemisphereLight(0xe8f3ff, 0x5a7a44, 0.8))
    this.ambient = found.amb ?? own(new THREE.AmbientLight(0xffffff, 0.2))
    if (!this.sun.parent) scene.add(this.sun)
    if (!this.sun.target.parent) scene.add(this.sun.target)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 340
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.03

    this.prevFog = scene.fog
    this.prevBackground = scene.background
    this.fog = scene.fog instanceof THREE.Fog ? scene.fog : new THREE.Fog(0xc4ddf0, 140, 420)
    if (opts.replaceEnvironment !== false) {
      scene.fog = this.fog
      for (const o of scene.children) {
        if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CircleGeometry && o.visible) {
          o.visible = false
          this.hidden.push(o)
        }
      }
      this.root.add(this.sky.mesh)
    }
    scene.add(this.root)
    this.applyQuality(true)
  }

  private applyQuality(first = false) {
    const q = this.q
    if (!first) this.disposeContent()
    this.tex = makeTextures(q.textureSize, q.anisotropy)
    this.shared = makeTerminalShared(this.tex)
    const surf: Record<SurfaceKind, THREE.Texture> = {
      grass: this.tex.grass,
      runway: this.tex.runway,
      taxi: this.tex.asphalt,
      apron: this.tex.concrete,
      road: this.tex.asphalt,
      pad: this.tex.concrete,
    }
    for (const k of Object.keys(surf) as SurfaceKind[]) {
      this.surfaceMats.set(
        k,
        new THREE.MeshLambertMaterial({ map: surf[k], vertexColors: true, color: k === 'pad' ? 0xd8dadc : k === 'road' ? 0xc0c0c0 : 0xffffff }),
      )
    }
    this.lights = new AirfieldLights(this.tex)
    this.root.add(this.lights.root)
    this.landscape = buildLandscape(this.tex.grass, q.trees)
    this.root.add(this.landscape.group)
    this.grass = new GrassRing(q.grassTufts)
    this.root.add(this.grass.mesh)
    this.rain = new Rain(q.precipitation)
    this.root.add(this.rain.lines)
    this.applyShadows()
    if (this.renderer?.setPixelRatio && typeof window !== 'undefined') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap))
    }
    this.builtRev = -1
  }

  private applyShadows() {
    const on = this.q.shadowMapSize > 0 && !this.lite
    if (this.renderer) {
      this.renderer.shadowMap.enabled = on
      this.renderer.shadowMap.type = this.q.shadowType
      this.renderer.shadowMap.needsUpdate = true
    }
    this.sun.castShadow = on
    this.sun.shadow.radius = this.q.shadowRadius
    if (on && this.sun.shadow.mapSize.x !== this.q.shadowMapSize) {
      this.sun.shadow.mapSize.set(this.q.shadowMapSize, this.q.shadowMapSize)
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null
    }
    for (const b of this.buildings) b.setShadows(on)
  }

  setQuality(level: QualityLevel) {
    if (level === this.quality) return
    this.quality = level
    this.q = QUALITY[level]
    this.applyQuality()
  }

  /** Fast-forward / low-power: drop shadows, grass ring, and walkers without a rebuild. */
  setLiteMode(on: boolean) {
    if (on === this.lite) return
    this.lite = on
    this.applyShadows()
  }

  setTimeOfDay(hour: number | null) {
    this.hourOverride = hour
  }

  setWeather(w: Weather | null) {
    this.weatherOverride = w
  }

  /** Hide legacy World tile meshes that this layer redraws. Cheap to call every frame. */
  hideLegacyTiles(group: THREE.Object3D, view: WorldView) {
    const key = `${view.mapRev}|${group.children.length}|${group.children[0]?.id ?? 0}`
    if (key === this.legacyKey) return
    this.legacyKey = key
    for (const child of group.children) {
      const cell = worldToCell(child.position.x, child.position.z)
      const t = view.tiles[cell.r]?.[cell.c]
      if (t && REPLACED_TILES.has(t)) child.visible = false
    }
  }

  private rebuild(view: WorldView) {
    this.builtRev = view.mapRev
    for (const g of this.staticGeos) g.dispose()
    this.staticGeos = []
    for (const o of [...this.staticGroup.children]) {
      if (o instanceof THREE.InstancedMesh) o.dispose()
      o.removeFromParent()
    }
    for (const m of this.bridgeMats) m.dispose()
    this.bridgeMats = []
    for (const b of this.buildings) b.dispose()
    this.buildings = []

    const cells = surfaceCells(view)
    for (const k of Object.keys(cells) as SurfaceKind[]) {
      if (!cells[k].length) continue
      const geo = quadsGeometry(cells[k], {
        y: SURFACE_Y[k],
        uvSize: k === 'grass' ? 7 : k === 'runway' ? 10 : k === 'apron' || k === 'pad' ? 6.2 : 8,
        sub: k === 'grass' ? 2 : 1,
        macro: k === 'grass' ? 0.22 : 0.06,
        seed: k.length,
      })
      this.staticGeos.push(geo)
      const mesh = new THREE.Mesh(geo, this.surfaceMats.get(k)!)
      mesh.receiveShadow = true
      mesh.name = `surface-${k}`
      this.staticGroup.add(mesh)
    }
    const rws = runways(view)
    const st = stands(view)
    const paints = [...rws.flatMap(runwayPaint), ...taxiPaint(view), ...standPaint(st), ...roadPaint(view)]
    if (paints.length) {
      const geo = paintGeometry(paints)
      this.staticGeos.push(geo)
      const mesh = new THREE.Mesh(geo, this.paintMat)
      mesh.receiveShadow = true
      mesh.name = 'surface-paint'
      this.staticGroup.add(mesh)
    }
    const spots = [...rws.flatMap((r) => runwayLightSpots(r)), ...taxiLightSpots(view)]
    this.lights.build(spots, apronMasts(st), rws, this.q.lightPools)

    const bridges = jetBridges(view, st)
    this.bridgeCount = bridges.length
    if (bridges.length) {
      const jb = buildJetBridges(bridges, this.shared.beam)
      this.bridgeMats = jb.mats
      this.staticGeos.push(...(jb.group.userData.geos as THREE.BufferGeometry[]))
      jb.group.name = 'jet-bridges'
      this.staticGroup.add(jb.group)
    }
    terminals(view).forEach((t, i) => {
      const b = new TerminalBuilding(t, this.shared, {
        density: this.q.propDensity,
        walkersPerCell: this.q.walkersPerCell,
        index: i,
      })
      this.buildings.push(b)
      this.staticGroup.add(b.root)
    })
    this.applyShadows()
  }

  update(view: WorldView, camera: THREE.Camera, dt: number) {
    // Generous clamp: software GL runs ~5–15 FPS and the crowd should still walk at pace.
    const step = Math.min(0.25, Math.max(0, dt))
    this.time += step
    if (view.mapRev !== this.builtRev) this.rebuild(view)
    const lite = this.lite || (view.speed ?? 1) >= 5
    if (lite !== this.lite) this.setLiteMode(lite)

    const camPos = new THREE.Vector3()
    camera.getWorldPosition(camPos)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const focus = groundFocus(camPos, dir) ?? { x: camPos.x, z: camPos.z }
    const camDist = Math.hypot(camPos.x - focus.x, camPos.y, camPos.z - focus.z)

    const hour = this.hourOverride ?? simClockToHour(view.clock ?? 0)
    const weather = this.weatherOverride ?? view.weather ?? 'clear'
    const s = skyState(hour, weather)
    this.state = s
    if (s.lightning && Math.random() < step * 0.25) this.flash = 1
    this.flash = Math.max(0, this.flash - step * 5)

    this.sun.color.setHex(s.sunColor)
    this.sun.intensity = s.sunIntensity + this.flash * 1.5
    this.hemi.color.setHex(s.hemiSky)
    this.hemi.groundColor.setHex(s.hemiGround)
    this.hemi.intensity = s.hemiIntensity + this.flash * 1.2
    this.ambient.intensity = s.ambient
    this.fog.color.setHex(s.fogColor)
    this.fog.near = s.fogNear
    this.fog.far = s.fogFar
    this.sky.set(s.skyTop, s.skyHorizon, s.stars)
    this.sky.follow(camPos)
    this.scene.background = new THREE.Color(s.skyHorizon)
    if (this.renderer) this.renderer.toneMappingExposure = s.exposure

    const fit = fitShadow(camDist, focus.x, focus.z, Math.max(1, this.q.shadowMapSize))
    const sc = this.sun.shadow.camera
    if (sc.right !== fit.half) {
      sc.left = -fit.half
      sc.right = fit.half
      sc.top = fit.half
      sc.bottom = -fit.half
      sc.updateProjectionMatrix()
    }
    this.sun.position.set(fit.x + s.sunDir.x * 160, s.sunDir.y * 160, fit.z + s.sunDir.z * 160)
    this.sun.target.position.set(fit.x, 0, fit.z)
    this.sun.target.updateMatrixWorld()
    this.scheduleShadow(fit)

    const wetK = 1 - s.wet * 0.28
    for (const [k, m] of this.surfaceMats) {
      if (k !== 'grass') m.color.setScalar(wetK * (k === 'pad' ? 0.85 : k === 'road' ? 0.75 : 1))
    }

    for (const b of this.buildings) b.update(camPos, step, this.q.lodScale, s.lights, focus)
    this.lights.update(step, s.lights, weather === 'storm' ? 1 : weather === 'rain' ? 0.6 : 0.25, camDist)
    setBridgeNight(this.bridgeMats, s.lights)
    if (this.lite) this.grass.mesh.visible = false
    else this.grass.update(view, focus.x, focus.z, camDist, step, view.mapRev)
    this.rain.update(step, s.precip, focus.x, focus.z)
  }

  /** Shadow pass every `shadowEvery` frames, or at once when the shadow box moves. */
  private scheduleShadow(fit: { half: number; x: number; z: number }) {
    const sm = this.renderer?.shadowMap
    if (!sm || !sm.enabled) return
    this.frame++
    sm.autoUpdate = false
    const key = `${fit.half}|${fit.x}|${fit.z}`
    if (key !== this.lastShadowKey || this.frame % Math.max(1, this.q.shadowEvery) === 0) {
      sm.needsUpdate = true
      this.lastShadowKey = key
    }
  }

  /**
   * Room plans (rooms, walls, doorways, nav grid) for each terminal, in world space.
   * Rebuilt when `mapRev` changes. Use with `navPath` / `roomAt` so sim pathing respects
   * the walls drawn here.
   */
  roomPlans(): { index: number; origin: { c: number; r: number }; plan: RoomPlan }[] {
    return this.buildings.map((b, index) => ({
      index,
      origin: { c: b.info.cluster.minC, r: b.info.cluster.minR },
      plan: b.rooms,
    }))
  }

  stats(): WorldRenderStats {
    let meshes = 0
    let instances = 0
    this.root.traverseVisible((o) => {
      if (o instanceof THREE.InstancedMesh) {
        meshes++
        instances += o.count
      } else if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) meshes++
    })
    return {
      quality: this.quality,
      hour: Math.round(this.state.hour * 100) / 100,
      weather: this.weatherOverride ?? 'clear',
      lights: Math.round(this.state.lights * 100) / 100,
      terminals: this.buildings.map((b) => ({ lod: b.lod, ...b.counts() })),
      airfieldLights: this.lights.count,
      jetBridges: this.bridgeCount,
      grassTufts: this.grass.mesh.visible ? this.grass.mesh.count : 0,
      meshes,
      instances,
      shadowMapSize: this.sun.castShadow ? this.q.shadowMapSize : 0,
    }
  }

  private disposeContent() {
    for (const b of this.buildings) b.dispose()
    this.buildings = []
    for (const g of this.staticGeos) g.dispose()
    this.staticGeos = []
    this.staticGroup.clear()
    for (const m of this.bridgeMats) m.dispose()
    this.bridgeMats = []
    for (const m of this.surfaceMats.values()) m.dispose()
    this.surfaceMats.clear()
    this.lights.dispose()
    this.lights.root.removeFromParent()
    this.landscape?.dispose()
    this.landscape?.group.removeFromParent()
    this.grass.dispose()
    this.grass.mesh.removeFromParent()
    this.rain.dispose()
    this.rain.lines.removeFromParent()
    disposeTerminalShared(this.shared)
    this.tex.dispose()
  }

  dispose() {
    this.disposeContent()
    this.paintMat.dispose()
    this.sky.dispose()
    this.root.removeFromParent()
    for (const l of this.ownLights) l.removeFromParent()
    for (const o of this.hidden) o.visible = true
    if (this.renderer) this.renderer.shadowMap.autoUpdate = true
    this.scene.fog = this.prevFog
    this.scene.background = this.prevBackground
  }
}
