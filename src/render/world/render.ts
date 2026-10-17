import { setAircraftEnvIntensity } from '../aircraft/pool'
import * as THREE from 'three'
import { grassColor, nightLighting, paintSky, seasonAtDay, snowCover } from '../../environment/index.ts'
import { gradeTree } from '../grade'
import { sharedSettings } from '../../features/settings/settings.ts'
import { GROUND_LOOK, LIGHT_LOOK } from '../look'
import type { Weather } from '../../game/types'
import { AirfieldLights, buildJetBridges, poseApronBridge, setBridgeNight } from './airfield'
import { capReadableFog, lerpHex, skyState, type SkyState } from './daylight'
import {
  airfieldLevels,
  applyDayNight,
  daylightFactor,
  idleDayNight,
  resolveHour,
  SKY_PHOTO_WEATHER,
  skyPhotoBlend,
  type DayNightControl,
  type DayNightSample,
} from './dayNight'
import { tintNoonLights } from './noonHint'
import { setWindowGlow } from './nightArt'
import type { ShellWeights } from '../viewCue'
import { ContactShadows, contactSpots } from './contact'
import { buildLandscape, GrassRing, Rain, SkyDome, type LandscapeArt, type LandscapeTint } from './environment'
import { cc0Generation } from '../cc0/library'
import {
  apronMasts,
  jetBridges,
  standFlags,
  roadPaint,
  runwayLightSpots,
  runwayPaint,
  runways,
  standPads,
  standHatch,
  standPaint,
  stands,
  taxiLightSpots,
  taxiPaint,
  terminals,
  type Runway,
} from './layout'
import { posesFrom, HallCrowd } from './hallCrowd'
import { bubbleAnchorY, ThoughtBubbleLayer } from '../../feedback/render/bubbles.ts'
import { liveBubbles } from '../../feedback/stage.ts'
import { FEEDBACK } from '../../feedback/config.ts'
import { actorsFrom, bubbleFor } from './guestActors'
import { GuestMotion } from './guestMotion'
import { fitShadow, groundFocus } from './lod'
import { softShadowRadius } from './softShadows'
import { onPackReady, packArtEnabled, packImage, packTexture, setPackArt, shopLogoPaths, signIconPaths } from './packArt'
import { baseLevel, QUALITY, type QualityLevel, type QualityPreset } from './quality'
import { kerbGeometry, paintGeometry, quadsGeometry, rectsGeometry, surfaceCells, type SurfaceKind } from './surfaces'
import type { RoomPlan } from './rooms'
import { createCrowd, type Crowd } from '../people/crowd'
import { WORLD_PER_METER } from '../aircraft/specs'
import { boardSnapshot, isFidsSource } from '../../fids/project'
import { objectIsFidsBoard } from '../../fids/stage'
import { disposeTerminalShared, FLOOR_Y, makeTerminalShared, ROOF_Y, TerminalBuilding, type TerminalShared } from './terminal'
import { artTexture, photoTexturesEnabled } from './textureRegistry'
import { airfieldTextures } from './airfieldArt'
import { landingTexture, seasonApronId, seasonGrassId, seasonPavedId } from './landingArt'
import { propTexture } from './propArt'
import { benchGeometry, binGeometry, curbFurniture } from './apronProps'
import { instanced } from './kit'
import { makeTextures, type WorldTextures } from './textures'
import { apronPrefabTier } from './progressionBuildings'
import { roadKerbs } from './kerbs'
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
  contacts: number
  lightBloom: boolean
  colorGrade: boolean
}

/** Tiles this layer redraws; the legacy World should skip (or hide) its own meshes for these. */
export const REPLACED_TILES = new Set(['grass', 'runway', 'taxi', 'stand', 'road', 'belt', 'terminal'])

const WHITE = new THREE.Color(1, 1, 1)

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
  private paintMat: THREE.MeshLambertMaterial | null = null
  /** Hazard-chevron restraint boxes at stand heads (Medium and up). */
  private hatchMat: THREE.MeshLambertMaterial | null = null
  private contacts = new ContactShadows()
  private kerbMat = new THREE.MeshLambertMaterial({ color: GROUND_LOOK.kerb })
  private staticGroup = new THREE.Group()
  private staticGeos: THREE.BufferGeometry[] = []
  private bridgeMats: THREE.Material[] = []
  private propMats: THREE.Material[] = []
  private buildings: TerminalBuilding[] = []
  private lights!: AirfieldLights
  private landscape: { group: THREE.Group; dispose: () => void } | null = null
  private grass!: GrassRing
  private rain!: Rain
  private builtRev = -1
  private builtKey = ''
  private bridgeCount = 0
  private hourOverride: number | null = null
  /** Lighting-rig override. Photo mode uses `hourOverride` and leaves this in place. */
  private dayNightControl: DayNightControl | null = null
  /** Last frame's cycle sample. The light rig and vehicle/aircraft lamps read this. */
  dayNightSample: DayNightSample = idleDayNight()
  private weatherOverride: Weather | null = null
  private lite = false
  private flash = 0
  private state: SkyState = skyState(11)
  private legacyKey = ''
  private time = 0
  private frame = 0
  private lastShadowKey = ''
  private hallCrowd: HallCrowd | null = null
  private people: Crowd | null = null
  private motion: GuestMotion | null = null
  private thoughtSig = new Map<string, string>()
  private packUnsub: (() => void) | null = null
  private packSigns = new THREE.Group()
  private packSignRev = -2
  /** Per-frame scratch, so `update` allocates nothing. */
  private camPos = new THREE.Vector3()
  private camDir = new THREE.Vector3()
  private background = new THREE.Color()
  private terrainKey = ''
  private groundKey = ''
  private landscapeArt: LandscapeArt | null = null
  private thresholdMat: THREE.MeshLambertMaterial | null = null
  private shoulderMat: THREE.MeshLambertMaterial | null = null

  constructor(scene: THREE.Scene, quality: QualityLevel, opts: WorldRenderOptions = {}) {
    this.scene = scene
    this.renderer = opts.renderer
    this.quality = quality
    this.q = QUALITY[quality]
    this.root.name = 'world-render'
    this.packSigns.name = 'pack-signs'
    this.root.add(this.staticGroup)
    this.root.add(this.contacts.mesh)
    this.root.add(this.packSigns)

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
    this.sun.shadow.bias = LIGHT_LOOK.shadowBias
    this.sun.shadow.normalBias = LIGHT_LOOK.shadowNormalBias

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
    this.hatchMat?.dispose()
    const hatchMap = propTexture('hatch', q.anisotropy) ?? (photoTexturesEnabled(q.level) ? artTexture('chevron_stripe', q.anisotropy) : null)
    this.hatchMat = hatchMap ? new THREE.MeshLambertMaterial({ map: hatchMap, polygonOffset: true, polygonOffsetFactor: -3 }) : null
    this.tex = makeTextures(q.textureSize, q.anisotropy, photoTexturesEnabled(q.level))
    this.paintMat?.dispose()
    this.paintMat = new THREE.MeshLambertMaterial({
      map: this.tex.markings ?? undefined,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      transparent: true,
      alphaTest: 0.5,
    })
    this.paintMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphatest_fragment>',
        `
#ifdef ALPHATEST
  float fw = fwidth(diffuseColor.a);
  diffuseColor.a = smoothstep(ALPHATEST - fw, ALPHATEST + fw, diffuseColor.a);
#endif
        `
      )
    }
    this.shared = makeTerminalShared(this.tex, baseLevel(q.level))
    const surf: Record<SurfaceKind, THREE.Texture> = {
      grass: this.tex.grass,
      runway: this.tex.runway,
      taxi: this.tex.asphalt,
      apron: this.tex.concrete,
      road: this.tex.road,
      pad: this.tex.concrete,
    }
    for (const k of Object.keys(surf) as SurfaceKind[]) {
      this.surfaceMats.set(
        k,
        new THREE.MeshLambertMaterial({
          map: surf[k],
          vertexColors: true,
          color: GROUND_LOOK.surfaceTint[k],
        }),
      )
    }
    this.lights = new AirfieldLights(this.tex)
    this.root.add(this.lights.root)
    this.thresholdMat?.dispose()
    this.shoulderMat?.dispose()
    const threshold = landingTexture('threshold_metal', q.anisotropy)
    const shoulder = landingTexture('dirt_shoulder', q.anisotropy)
    this.thresholdMat = threshold
      ? new THREE.MeshLambertMaterial({ map: threshold, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -4 })
      : null
    this.shoulderMat = shoulder
      ? new THREE.MeshLambertMaterial({ map: shoulder, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1 })
      : null
    this.landscapeArt = {
      farmland: landingTexture('farmland', q.anisotropy),
      water: landingTexture('water_river', q.anisotropy),
      trees: landingTexture('tree_sprites', q.anisotropy),
      bushes: landingTexture('bush_sprites', q.anisotropy),
    }
    this.groundKey = ''
    this.applySeasonPlates('spring', 0, 0)
    this.landscape = buildLandscape(this.tex.grass, q.trees, null, this.landscapeArt)
    this.root.add(this.landscape.group)
    this.terrainKey = ''
    this.grass = new GrassRing(q.grassTufts)
    this.root.add(this.grass.mesh)
    this.rain = new Rain(q.precipitation)
    this.root.add(this.rain.lines)
    this.applyShadows()
    if (this.renderer?.setPixelRatio && typeof window !== 'undefined') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap))
    }
    this.builtRev = -1
    this.builtKey = ''
    this.hallCrowd?.dispose()
    this.hallCrowd = new HallCrowd(this.root, this.shared.people)
    this.sky.setPhotos(q.skyPhotos)
    if (q.colorGrade) gradeTree(this.root)
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

  /**
   * Day/night hook for the lighting rig and photo tools.
   * `null` clears the hour override and the daylight/lights sample.
   * A later `setTimeOfDay` only replaces the hour.
   */
  setDayNight(control: DayNightControl | null) {
    this.dayNightControl = control
    if (!control) this.hourOverride = null
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
    for (const m of this.propMats) m.dispose()
    this.propMats = []
    for (const b of this.buildings) b.dispose()
    this.buildings = []

    const cells = surfaceCells(view)
    for (const k of Object.keys(cells) as SurfaceKind[]) {
      if (!cells[k].length) continue
      const geo = quadsGeometry(cells[k], {
        y: SURFACE_Y[k],
        uvSize: k === 'grass' ? 7 : k === 'runway' ? 10 : k === 'apron' || k === 'pad' ? 6.2 : 8,
        sub: k === 'grass' ? 2 : 1,
        macro: k === 'grass' ? 0.34 : 0.06,
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
    const pads = standPads(view, st)
    if (pads.length) {
      const geo = rectsGeometry(pads, 0.02)
      this.staticGeos.push(geo)
      const mesh = new THREE.Mesh(geo, this.surfaceMats.get('apron')!)
      mesh.receiveShadow = true
      mesh.name = 'surface-stand-pad'
      this.staticGroup.add(mesh)
    }
    for (const rw of rws) {
      if (this.thresholdMat) {
        const geo = photoQuads(thresholdRects(rw), 0.02)
        this.staticGeos.push(geo)
        const mesh = new THREE.Mesh(geo, this.thresholdMat)
        mesh.receiveShadow = true
        mesh.name = 'surface-threshold'
        this.staticGroup.add(mesh)
      }
      if (this.shoulderMat) {
        const geo = photoQuads(shoulderRects(rw), 0.007, 8)
        this.staticGeos.push(geo)
        const mesh = new THREE.Mesh(geo, this.shoulderMat)
        mesh.receiveShadow = true
        mesh.name = 'surface-shoulder'
        this.staticGroup.add(mesh)
      }
    }
    const paints = [...rws.flatMap(runwayPaint), ...taxiPaint(view), ...standPaint(st), ...roadPaint(view)]
    if (paints.length && this.paintMat) {
      const geo = paintGeometry(paints)
      this.staticGeos.push(geo)
      const mesh = new THREE.Mesh(geo, this.paintMat)
      mesh.receiveShadow = true
      mesh.name = 'surface-paint'
      this.staticGroup.add(mesh)
    }
    const hatch = this.hatchMat ? standHatch(st) : []
    if (hatch.length && this.hatchMat) {
      const geo = rectsGeometry(hatch, 0.03, 1.5 * WORLD_PER_METER)
      this.staticGeos.push(geo)
      const mesh = new THREE.Mesh(geo, this.hatchMat)
      mesh.receiveShadow = true
      mesh.name = 'surface-stand-hatch'
      this.staticGroup.add(mesh)
    }
    const kerbs = roadKerbs(view)
    if (kerbs.length) {
      const geo = kerbGeometry(kerbs)
      this.staticGeos.push(geo)
      const mesh = new THREE.Mesh(geo, this.kerbMat)
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.name = 'surface-kerb'
      this.staticGroup.add(mesh)
    }
    const spots = [...rws.flatMap((r) => runwayLightSpots(r)), ...taxiLightSpots(view)]
    this.lights.build(spots, apronMasts(st), rws, this.q.lightPools, this.q.lightBloom)
    for (const flag of standFlags(st)) {
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6)
      const clothGeo = new THREE.PlaneGeometry(1.4, 0.8)
      this.staticGeos.push(poleGeo, clothGeo)
      const poleMat = new THREE.MeshLambertMaterial({ color: '#c5ced6' })
      const clothMat = new THREE.MeshLambertMaterial({ color: flag.color, side: THREE.DoubleSide })
      this.propMats.push(poleMat, clothMat)
      const group = new THREE.Group()
      group.name = 'stand-flag'
      const pole = new THREE.Mesh(poleGeo, poleMat)
      pole.position.y = 2.1
      const cloth = new THREE.Mesh(clothGeo, clothMat)
      cloth.name = 'stand-flag-cloth'
      cloth.position.set(0.7, 3.6, 0)
      group.add(pole, cloth)
      group.position.set(flag.x, 0, flag.z)
      this.staticGroup.add(group)
    }
    this.contacts.sync(this.q.contactShadows ? contactSpots(view) : [])

    const bridges = jetBridges(view, st)
    this.bridgeCount = bridges.length
    if (bridges.length) {
      const jb = buildJetBridges(bridges, this.shared.beam)
      this.bridgeMats = jb.mats
      this.staticGeos.push(...(jb.group.userData.geos as THREE.BufferGeometry[]))
      jb.group.name = 'jet-bridges'
      this.staticGroup.add(jb.group)
    }
    const pier = apronPrefabTier(view.fits) >= 2
    terminals(view).forEach((t, i) => {
      const b = new TerminalBuilding(t, this.shared, {
        density: this.q.propDensity,
        walkersPerCell: this.q.walkersPerCell,
        index: i,
        pier,
      })
      this.buildings.push(b)
      this.staticGroup.add(b.root)
    })
    const dress = curbFurniture(view)
    for (const [name, matrices, geo] of [
      ['apron-benches', dress.benches, benchGeometry()],
      ['apron-bins', dress.bins, binGeometry()],
    ] as const) {
      this.staticGeos.push(geo)
      if (!matrices.length) continue
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
      this.propMats.push(mat)
      const mesh = instanced(geo, mat, matrices)
      mesh.castShadow = true
      mesh.name = name
      this.staticGroup.add(mesh)
    }
    this.applyShadows()
    if (this.q.colorGrade) gradeTree(this.staticGroup)
  }

  /** True when the ray hits a split-flap board. */
  pickFids(raycaster: THREE.Raycaster): boolean {
    const roots = this.buildings.map((building) => building.fidsGroup)
    if (!roots.length) return false
    return raycaster.intersectObjects(roots, true).some((hit) => objectIsFidsBoard(hit.object))
  }

  /** First terminal, for the view-change dolly. */
  terminalAim(): { x: number; z: number } | null {
    const building = this.buildings[0]
    if (!building) return null
    return { x: building.center.x, z: building.center.z }
  }

  /** Roof lift and wall snap. Null seats every shell. The sim does not call this. */
  setShellCue(weights: ShellWeights | null) {
    for (const building of this.buildings) building.applyShellCue(weights)
  }

  update(view: WorldView, camera: THREE.Camera, dt: number) {
    // Generous clamp: software GL runs ~5–15 FPS and the crowd should still walk at pace.
    const step = Math.min(0.25, Math.max(0, dt))
    this.time += step
    const builtKey = `${view.mapRev}|${apronPrefabTier(view.fits)}|${cc0Generation()}`
    if (builtKey !== this.builtKey) {
      this.builtKey = builtKey
      this.rebuild(view)
    }
    const lite = this.lite || (view.speed ?? 1) >= 5
    if (lite !== this.lite) this.setLiteMode(lite)

    const camPos = camera.getWorldPosition(this.camPos)
    const dir = camera.getWorldDirection(this.camDir)
    const focus = groundFocus(camPos, dir) ?? { x: camPos.x, z: camPos.z }
    const camDist = Math.hypot(camPos.x - focus.x, camPos.y, camPos.z - focus.z)

    const cycleOn = sharedSettings().get().dayNightCycle
    const explicitHour = this.dayNightControl?.hour != null && Number.isFinite(this.dayNightControl.hour)
    // Off holds noon with the lamps out. A photo hour or an explicit control hour still wins.
    const control = !cycleOn && this.hourOverride == null && !explicitHour
      ? { hour: 12, daylight: 1, lights: 0 }
      : this.dayNightControl
    const hour = resolveHour(view.clock ?? 0, this.hourOverride, control, cycleOn)
    const weather = this.weatherOverride ?? view.weather ?? 'clear'
    const day = Math.floor(Math.max(0, view.clock ?? 0) / 180)
    let s = applyDayNight(paintSky(hour, weather, day, baseLevel(this.quality)), control)
    // 5× drops shadows, grass, and walkers. Mast flood pools stay; Low still skips them.
    const night = nightLighting(s.hour, s.lights, this.q.lightPools)
    const season = seasonAtDay(day)
    const snow = view.mapDraw ? 0 : snowCover(day, baseLevel(this.quality))
    this.dayNightSample = {
      hour: s.hour,
      daylight: control?.daylight ?? daylightFactor(s.hour),
      lights: s.lights,
      windows: night.terminalWindows,
      runwayEdge: night.runwayEdge,
      taxiEdge: night.taxiEdge,
      apron: night.apron,
      apronPools: night.apronPools,
      aircraft: night.runwayEdge,
      headlights: night.runwayEdge,
      snow,
      ground: season.palette.ground,
      grass: season.palette.grass,
      seasonId: season.id,
      precip: s.precip,
    }
    const draw = view.mapDraw
    if (draw && draw.skyAmount > 0) {
      const k = draw.skyAmount
      s.skyTop = lerpHex(s.skyTop, draw.skyTop, k)
      s.skyHorizon = lerpHex(s.skyHorizon, draw.skyHorizon, k)
      s.fogColor = s.skyHorizon
      s.sunColor = lerpHex(s.sunColor, draw.sun, k)
      s.hemiSky = lerpHex(s.hemiSky, draw.hemi, k * 0.7)
      s.hemiGround = lerpHex(s.hemiGround, draw.ground, k)
      s.sunIntensity *= draw.sunScale
      if (draw.fogScale > 0) {
        const fog = capReadableFog(s.fogNear, s.fogFar * draw.fogScale)
        s.fogFar = fog.fogFar
        s.fogNear = fog.fogNear
      }
    }
    this.syncTerrain(draw?.terrain ?? null)
    this.state = s
    if (s.lightning && Math.random() < step * 0.25) this.flash = 1
    this.flash = Math.max(0, this.flash - step * 5)

    this.sun.color.setHex(s.sunColor)
    this.sun.intensity = s.sunIntensity + this.flash * 1.5
    this.hemi.color.setHex(s.hemiSky)
    this.hemi.groundColor.setHex(s.hemiGround)
    this.hemi.intensity = s.hemiIntensity + this.flash * 1.2
    setAircraftEnvIntensity((s.sunIntensity + s.hemiIntensity) / 3)
    this.ambient.intensity = s.ambient
    this.fog.color.setHex(s.fogColor)
    this.fog.near = s.fogNear
    this.fog.far = s.fogFar
    this.sky.set(s.skyTop, s.skyHorizon, s.stars, s.sunDir, s.sunColor)
    // Climate maps paint their own sky, so the photo gives way as their tint comes in.
    const photoAmount = (SKY_PHOTO_WEATHER[weather] ?? 1) * (1 - (draw?.skyAmount ?? 0))
    const skyBlend = skyPhotoBlend(s.hour, control?.daylight, weather)
    tintNoonLights(s, skyBlend, weather)
    this.sky.setPhoto(skyBlend, photoAmount)
    this.sky.follow(camPos)
    this.scene.background = this.background.setHex(s.skyHorizon)
    if (this.renderer) this.renderer.toneMappingExposure = s.exposure

    const fit = fitShadow(camDist, focus.x, focus.z, Math.max(1, this.q.shadowMapSize), this.q.shadowReach)
    const sc = this.sun.shadow.camera
    if (sc.right !== fit.half) {
      sc.left = -fit.half
      sc.right = fit.half
      sc.top = fit.half
      sc.bottom = -fit.half
      sc.updateProjectionMatrix()
    }
    // Constant-width soft penumbra on the ground at every zoom (softShadows.ts).
    this.sun.shadow.radius = softShadowRadius(camDist, fit.half, Math.max(1, this.q.shadowMapSize), this.q.shadowRadius)
    this.sun.position.set(fit.x + s.sunDir.x * 160, s.sunDir.y * 160, fit.z + s.sunDir.z * 160)
    this.sun.target.position.set(fit.x, 0, fit.z)
    this.sun.target.updateMatrixWorld()
    this.scheduleShadow(fit)

    const wetK = 1 - s.wet * 0.28
    this.applySeasonPlates(season.id, snow, s.wet)
    const grassHex = grassColor(day, baseLevel(this.quality))
    for (const [k, m] of this.surfaceMats) {
      const landing = Boolean((m.map as THREE.Texture | null)?.userData?.landing)
      if (k === 'grass') {
        // Season tint shifts the hue only: normalised so every preset stays as bright as the albedo,
        // then eased toward white so a saturated palette does not turn the field lime.
        if (landing) {
          m.color.setHex(0xffffff)
          if (s.wet > 0) m.color.multiplyScalar(1 - s.wet * 0.15)
        } else {
          m.color.setHex(grassHex)
          m.color.multiplyScalar(1 / Math.max(1e-3, m.color.r, m.color.g, m.color.b))
          m.color.lerp(WHITE, 1 - GROUND_LOOK.seasonTint)
          if (s.wet > 0) m.color.multiplyScalar(1 - s.wet * 0.22)
        }
      } else if (landing) m.color.setScalar(s.wet > 0 ? 1 - s.wet * 0.12 : 1)
      else m.color.setScalar(wetK * (k === 'pad' ? 0.85 : k === 'road' ? 0.75 : 1))
    }
    this.paintPlot(draw ?? null)
    const farm = this.landscape?.group.getObjectByName('world-farmland')
    const fields = this.landscape?.group.getObjectByName('world-fields')
    const tuft = this.grass?.mesh.material
    this.rain.cover.paintSnow(
      snow,
      s.wet,
      this.quality,
      this.surfaceMats.get('grass'),
      farm instanceof THREE.Mesh ? (farm.material as THREE.MeshLambertMaterial) : undefined,
      fields instanceof THREE.Mesh ? (fields.material as THREE.MeshLambertMaterial) : undefined,
      tuft instanceof THREE.MeshLambertMaterial ? tuft : undefined,
    )

    const enclosed = view.view === 'apron' || view.viewCue != null
    setWindowGlow(night.terminalWindows)
    for (const b of this.buildings) b.update(camPos, step, this.q.lodScale, night.terminalWindows, focus, enclosed, camera)
    const feed = isFidsSource(view)
      ? view
      : {
          clock: view.clock ?? 0,
          schedule: [],
          flights: [],
          airline: () => undefined,
          gateLabel: () => '--',
        }
    this.shared.fids.tick(step, boardSnapshot(feed))
    const showGuests = this.buildings.some((b) => b.lifeFade > 0.04)
    this.syncGuests(view, camera, step, showGuests, lite)
    this.syncPack(view, lite)
    this.lights.update(
      step,
      s.lights,
      weather === 'storm' ? 1 : weather === 'rain' ? 0.6 : 0.25,
      camDist,
      airfieldLevels(this.dayNightSample),
      this.quality === 'low',
    )
    this.poseJetBridges(view)
    setBridgeNight(this.bridgeMats, s.lights)
    if (this.lite) this.grass.mesh.visible = false
    else this.grass.update(view, focus.x, focus.z, camDist, step, view.mapRev)
    this.rain.updateRich(step, s.precip > 0 ? (snow > 0 ? 'snow' : 'rain') : 'none', weather, s.precip, focus.x, focus.z)
  }

  /** Park every bought bridge on its terminal socket, then reach toward a docked aircraft. */
  private poseJetBridges(view: WorldView) {
    const root = this.staticGroup.getObjectByName('jet-bridges')
    if (!root) return
    for (const child of root.children) {
      if (child.name !== 'apron-bridge') continue
      const stand = child.userData.stand as { c: number; r: number } | undefined
      const extend = stand && view.bridgeExtendAt ? view.bridgeExtendAt(stand) : 0
      const craft = stand && extend > 0 ? (view.bridgeAircraftAt?.(stand) ?? null) : null
      poseApronBridge(child, extend, craft)
    }
  }

  /**
   * Plot grass uses a green albedo, so a multiply alone stays green.
   * A terrain colour on `color` plus a little emissive shifts the field
   * toward sand or jungle. Temperate passes null and the albedo is unchanged.
   */
  private paintPlot(draw: { terrain: { ground: number } | null } | null) {
    const grass = this.surfaceMats.get('grass')
    if (!grass) return
    const ground = draw?.terrain?.ground
    if (ground == null) {
      // Colour already holds the season tint and wetness from `update`; only clear the terrain glow.
      grass.emissive.setHex(0x000000)
      grass.emissiveIntensity = 0
    } else {
      grass.color.setHex(ground)
      grass.emissive.setHex(ground)
      grass.emissiveIntensity = 0.28
    }
    const tuft = this.grass?.mesh.material
    if (tuft instanceof THREE.MeshLambertMaterial) {
      if (ground == null) {
        tuft.color.setHex(0xffffff)
        tuft.emissive.setHex(0x000000)
        tuft.emissiveIntensity = 0
      } else {
        tuft.color.setHex(ground)
        tuft.emissive.setHex(ground)
        tuft.emissiveIntensity = 0.2
      }
    }
  }

  /** Swap landing plates when the season, snow, or rain changes. Files stay full size. */
  private applySeasonPlates(seasonId: string, snow: number, wet: number) {
    const winter = snow > 0.35 || seasonId === 'winter' ? 1 : 0
    const wetBit = wet > 0.15 ? 1 : 0
    const key = `${seasonId}|${winter}|${wetBit}`
    if (key === this.groundKey) return
    this.groundKey = key
    const anisotropy = this.q.anisotropy
    const assign = (mat: THREE.Material | undefined, tex: THREE.Texture | null) => {
      if (!(mat instanceof THREE.MeshLambertMaterial) || !tex) return
      mat.map = tex
      mat.needsUpdate = true
    }
    const paved = (mat: THREE.Material | undefined, id: 'asphalt' | 'runway' | 'apron' | null, fallback: THREE.Texture | null) => {
      if (!(mat instanceof THREE.MeshLambertMaterial)) return
      const art = id ? airfieldTextures(id, anisotropy) : null
      mat.normalMap = art?.normalMap ?? null
      if (art?.normalMap) mat.normalScale.set(0.6, 0.6)
      assign(mat, art?.map ?? fallback)
      mat.needsUpdate = true
    }
    assign(this.surfaceMats.get('grass'), landingTexture(seasonGrassId(seasonId, snow), anisotropy))
    const apron = landingTexture(seasonApronId(seasonId, snow), anisotropy)
    const dry = !winter && !wetBit
    paved(this.surfaceMats.get('apron'), dry ? 'apron' : null, apron)
    paved(this.surfaceMats.get('pad'), dry ? 'apron' : null, apron)
    paved(this.surfaceMats.get('runway'), dry ? 'runway' : null, landingTexture(seasonPavedId(seasonId, snow, wet), anisotropy))
    if (winter || wetBit) {
      const plate = landingTexture(winter ? 'snow_asphalt' : 'wet_asphalt', anisotropy)
      paved(this.surfaceMats.get('taxi'), null, plate)
      assign(this.surfaceMats.get('road'), plate)
    } else if (this.tex) {
      paved(this.surfaceMats.get('taxi'), 'asphalt', this.tex.asphalt)
      assign(this.surfaceMats.get('road'), this.tex.road)
    }
    assign(this.shoulderMat ?? undefined, landingTexture(winter ? 'snow_grass' : 'dirt_shoulder', anisotropy))
    const farm = landingTexture(winter ? 'snow_grass' : 'farmland', anisotropy)
    if (farm && this.landscape) {
      for (const name of ['world-farmland', 'world-fields']) {
        const mesh = this.landscape.group.getObjectByName(name)
        if (mesh instanceof THREE.Mesh) assign(mesh.material as THREE.Material, farm)
      }
    }
  }

  /** Swap the outer farmland when a map brings its own ground colours. */
  private syncTerrain(tint: LandscapeTint | null) {
    const key = (tint ? `${tint.ground}|${tint.fields.join(',')}|${tint.trees.join(',')}` : '') + (cc0Generation() ? '#cc0' : '')
    if (key === this.terrainKey || !this.tex) return
    this.terrainKey = key
    this.landscape?.dispose()
    this.landscape?.group.removeFromParent()
    this.landscape = buildLandscape(this.tex.grass, this.q.trees, tint, this.landscapeArt)
    this.root.add(this.landscape.group)
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
      contacts: this.contacts.mesh.visible ? this.contacts.mesh.count : 0,
      lightBloom: this.q.lightBloom,
      colorGrade: this.q.colorGrade,
    }
  }

  /** Animated people when the preset allows it; otherwise the cheap hall instances. */
  private syncGuests(view: WorldView, camera: THREE.Camera, step: number, showGuests: boolean, lite: boolean) {
    const rich = showGuests && !lite && this.q.animatedPeople
    if (!rich) {
      this.people?.update([], step)
      this.hallCrowd?.sync(showGuests ? posesFrom(view) : [], this.time)
      this.clearThoughts()
      this.moodBubbles?.clear()
      return
    }
    const actors = actorsFrom(view).slice(0, 480)
    let placed = actors
    if (this.q.crowdDetail && actors.length > 1) {
      this.motion ??= new GuestMotion()
      const doors = this.buildings.flatMap((b) =>
        b.rooms.doors
          .filter((d) => d.kind !== 'staff')
          .map((d) => {
            const hx = d.axis === 'x' ? d.width / 2 : 0
            const hz = d.axis === 'z' ? d.width / 2 : 0
            return { id: `${b.root.id}:${d.a}-${d.b}`, ax: d.x - hx, az: d.z - hz, bx: d.x + hx, bz: d.z + hz }
          }),
      )
      const moved = this.motion.apply(
        actors.map((a) => ({ id: a.id, x: a.x, z: a.z, yaw: a.yaw, queued: a.queued })),
        doors,
        step,
      )
      const byId = new Map(moved.map((p) => [p.id, p]))
      placed = actors.map((a) => {
        const p = byId.get(a.id)
        return p ? { ...a, x: p.x, z: p.z } : a
      })
    }
    this.people ??= createCrowd(this.root, { camera, capacity: 480, unitsPerMeter: WORLD_PER_METER, full: true })
    this.people.setCamera(camera)
    this.hallCrowd?.sync([], this.time)
    this.people.update(
      placed.map((a) => ({
        id: a.id,
        role: a.role,
        pos: { x: a.x, y: FLOOR_Y, z: a.z },
        heading: a.yaw,
        state: a.state,
        bagIds: a.hasChecked && !a.bagsDropped ? [a.id] : [],
        bagsDropped: a.bagsDropped,
        speed: 1.25,
      })),
      step,
    )
    this.syncThoughts(placed, !lite && this.q.thoughtBubbles)
    this.syncMoodBubbles(placed, camera, !lite && this.q.thoughtBubbles)
  }

  private moodBubbles: ThoughtBubbleLayer | null = null

  /** Occasional mood icons. One instanced mesh per icon, slots reused each frame. */
  private syncMoodBubbles(
    actors: readonly { id: string; x: number; z: number }[],
    camera: THREE.Camera,
    on: boolean,
  ) {
    const wanted = on ? liveBubbles() : []
    if (wanted.length === 0) {
      this.moodBubbles?.clear()
      return
    }
    this.moodBubbles ??= new ThoughtBubbleLayer(this.root, {
      capacity: FEEDBACK.bubbleCap,
      unit: WORLD_PER_METER,
      head: 2.2,
      width: FEEDBACK.bubbleWidthM,
    })
    const at = new Map(actors.map((actor) => [actor.id, actor]))
    const draw = []
    const head = 2.2
    for (const bubble of wanted) {
      const actor = at.get(bubble.passengerId)
      if (!actor) continue
      const y = bubbleAnchorY(FLOOR_Y, ROOF_Y, this.roofCovers(actor.x, actor.z), head, WORLD_PER_METER)
      draw.push({ id: bubble.passengerId, icon: bubble.icon, x: actor.x, y, z: actor.z })
    }
    this.moodBubbles.sync(draw, camera)
  }

  /** Closed roofs hide the hall. Icons over those passengers clear the roof. */
  private roofCovers(x: number, z: number): boolean {
    for (const building of this.buildings) {
      if (building.roofFade < 0.55) continue
      const dx = x - building.center.x
      const dz = z - building.center.z
      const reach = building.radius * 0.92
      if (dx * dx + dz * dz <= reach * reach) return true
    }
    return false
  }

  private syncThoughts(actors: readonly { id: string; x: number; z: number; thought: string }[], on: boolean) {
    if (!this.people) return
    if (!on) {
      this.clearThoughts()
      return
    }
    const picks = actors
      .map((a) => ({ a, b: bubbleFor(a.thought) }))
      .filter((row): row is { a: (typeof actors)[number]; b: NonNullable<ReturnType<typeof bubbleFor>> } => row.b != null)
      .sort((p, q) => p.b.rank - q.b.rank)
      .slice(0, 6)
    const keep = new Set(picks.map((p) => p.a.id))
    for (const id of this.thoughtSig.keys()) {
      if (!keep.has(id)) {
        this.people.hideThought(id)
        this.thoughtSig.delete(id)
      }
    }
    for (const { a, b } of picks) {
      const img = b.image ? packImage(b.image) : null
      const sig = `${b.text}|${img ? 'img' : 'emo'}`
      if (this.thoughtSig.get(a.id) === sig) continue
      this.thoughtSig.set(a.id, sig)
      this.people.showThought(a.id, { icon: b.icon, text: b.text, duration: 8, image: img })
    }
  }

  private clearThoughts() {
    if (!this.people) {
      this.thoughtSig.clear()
      return
    }
    for (const id of this.thoughtSig.keys()) this.people.hideThought(id)
    this.thoughtSig.clear()
  }

  private syncPack(view: WorldView, lite: boolean) {
    const on = this.q.extraTextures && !lite
    setPackArt(on)
    if (!on || !packArtEnabled()) return
    if (!this.packUnsub) this.packUnsub = onPackReady(() => this.applyPack())
    if (packTexture('grass') && this.packSignRev !== view.mapRev) this.applyPack()
  }

  private applyPack() {
    if (!this.q.extraTextures || !packTexture('grass')) return
    // Ground keeps the procedural maps on every preset: the pack's ground SVGs are a flat
    // fill with dots and read as plastic next to them.
    const floor = packTexture('terrazzo')
    const glass = packTexture('terminal_glass')
    for (const b of this.buildings) b.applyPackMaps(floor, glass)
    this.dressSigns()
    this.packSignRev = this.builtRev
  }

  private dressSigns() {
    this.clearPackSigns()
    const icons = signIconPaths()
    const logos = shopLogoPaths()
    const kindIcon: Record<string, string> = {
      checkin: icons.checkin,
      security: icons.security,
      gate: icons.gates,
      shops: icons.shops,
      airside: icons.baggage_reclaim,
    }
    let shops = 0
    for (const b of this.buildings) {
      for (const room of b.rooms.rooms) {
        const icon = packImage(kindIcon[room.kind] ?? '')
        if (icon) this.packSigns.add(decalSprite(icon, room.x, FLOOR_Y + 3.2, room.z, 1.15))
        if (room.kind === 'shops') {
          const logo = packImage(logos[shops % logos.length] ?? '')
          shops += 1
          if (logo) this.packSigns.add(decalSprite(logo, room.x + 1.4, FLOOR_Y + 2.4, room.z, 1.4))
          const carpet = packTexture('carpet')
          if (carpet) {
            const geo = new THREE.PlaneGeometry(5, 3.5)
            geo.rotateX(-Math.PI / 2)
            const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: carpet }))
            mesh.position.set(room.x, FLOOR_Y + 0.03, room.z)
            mesh.name = 'shop-carpet'
            this.packSigns.add(mesh)
          }
        }
      }
    }
  }

  private clearPackSigns() {
    this.packSigns.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) {
        const sprite = o as THREE.Sprite
        sprite.material.map?.dispose()
        sprite.material.dispose()
        return
      }
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) for (const m of mat) m.dispose()
      else mat?.dispose()
    })
    this.packSigns.clear()
  }

  private disposeContent() {
    this.people?.dispose()
    this.people = null
    this.clearThoughts()
    this.clearPackSigns()
    this.packSignRev = -2
    this.hallCrowd?.dispose()
    this.hallCrowd = null
    for (const b of this.buildings) b.dispose()
    this.buildings = []
    for (const g of this.staticGeos) g.dispose()
    this.staticGeos = []
    this.staticGroup.clear()
    for (const m of this.bridgeMats) m.dispose()
    this.bridgeMats = []
    for (const m of this.propMats) m.dispose()
    this.propMats = []
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
    this.contacts.sync([])
    disposeTerminalShared(this.shared)
    this.tex.dispose()
  }

  dispose() {
    this.disposeContent()
    this.paintMat?.dispose()
    this.hatchMat?.dispose()
    this.thresholdMat?.dispose()
    this.shoulderMat?.dispose()
    this.contacts.dispose()
    this.kerbMat.dispose()
    this.sky.dispose()
    this.root.removeFromParent()
    for (const l of this.ownLights) l.removeFromParent()
    for (const o of this.hidden) o.visible = true
    if (this.renderer) this.renderer.shadowMap.autoUpdate = true
    this.scene.fog = this.prevFog
    this.scene.background = this.prevBackground
  }
}

function photoQuads(rects: readonly { x: number; z: number; w: number; d: number }[], y: number, uvSize = 0): THREE.BufferGeometry {
  const pos = new Float32Array(rects.length * 4 * 3)
  const uvs = new Float32Array(rects.length * 4 * 2)
  const col = new Float32Array(rects.length * 4 * 3)
  const idx: number[] = []
  rects.forEach((rect, n) => {
    const x0 = rect.x - rect.w / 2
    const z0 = rect.z - rect.d / 2
    const corners: [number, number][] = [
      [x0, z0],
      [x0 + rect.w, z0],
      [x0 + rect.w, z0 + rect.d],
      [x0, z0 + rect.d],
    ]
    const base = n * 4
    corners.forEach(([x, z], i) => {
      const v = base + i
      pos[v * 3] = x
      pos[v * 3 + 1] = y
      pos[v * 3 + 2] = z
      if (uvSize > 0) {
        uvs[v * 2] = x / uvSize
        uvs[v * 2 + 1] = z / uvSize
      } else {
        uvs[v * 2] = i === 1 || i === 2 ? 1 : 0
        uvs[v * 2 + 1] = i >= 2 ? 1 : 0
      }
      col[v * 3] = 1
      col[v * 3 + 1] = 1
      col[v * 3 + 2] = 1
    })
    idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

function thresholdRects(rw: Runway): { x: number; z: number; w: number; d: number }[] {
  const depth = Math.min(5.5, rw.length * 0.12)
  if (rw.axis === 'h') {
    const z = (rw.z0 + rw.z1) / 2
    return [
      { x: rw.x0 + depth / 2, z, w: depth, d: rw.width },
      { x: rw.x1 - depth / 2, z, w: depth, d: rw.width },
    ]
  }
  const x = (rw.x0 + rw.x1) / 2
  return [
    { x, z: rw.z0 + depth / 2, w: rw.width, d: depth },
    { x, z: rw.z1 - depth / 2, w: rw.width, d: depth },
  ]
}

function shoulderRects(rw: Runway): { x: number; z: number; w: number; d: number }[] {
  const band = 2.2
  if (rw.axis === 'h') {
    const x = (rw.x0 + rw.x1) / 2
    return [
      { x, z: rw.z0 - band / 2, w: rw.length, d: band },
      { x, z: rw.z1 + band / 2, w: rw.length, d: band },
    ]
  }
  const z = (rw.z0 + rw.z1) / 2
  return [
    { x: rw.x0 - band / 2, z, w: band, d: rw.length },
    { x: rw.x1 + band / 2, z, w: band, d: rw.length },
  ]
}

function decalSprite(img: HTMLImageElement, x: number, y: number, z: number, size: number): THREE.Sprite {
  const map = new THREE.Texture(img)
  map.colorSpace = THREE.SRGBColorSpace
  map.needsUpdate = true
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }))
  sprite.position.set(x, y, z)
  sprite.scale.set(size, size, 1)
  return sprite
}
