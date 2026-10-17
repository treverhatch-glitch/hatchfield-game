/**
 * Art review page: /aircraft-gallery.html?view=sheet|liveries&id=b738&hour=13
 * Not part of the game bundle. Renders every airframe (or one airframe in several
 * roster liveries) with the game's aircraft builder, sun and sky probe.
 */
import * as THREE from 'three'
import { ROSTER } from '../../airlines/roster'
import { createAircraft, setAircraftQuality, updateAircraft } from './factory'
import { MOTION_IDLE } from './motion'
import { installAircraftEnvironment } from './env'
import { aircraftWear } from './airframeWear'

/** Roster carrier type → size tier and persona for the wear preview. */
const TYPE_TIER: Record<string, [number, string | undefined]> = { flag: [5, 'luxury'], charter: [3, undefined], regional: [2, undefined], cargo: [2, 'cargo_night'], heli: [2, undefined], budget: [0, 'budget'] }
function rosterWear(type: string, seed: string): number {
  const forced = qs.get('wear')
  if (forced !== null) return Number(forced)
  const [tier, persona] = TYPE_TIER[type] ?? [2, undefined]
  return aircraftWear({ tier, persona, seed })
}
import { MODEL_SPECS, aircraftWorldPerMeter, type Livery } from './specs'

/** Expansion-pack ids. Older builds without derived specs show their fallback. */
const EXTRA_IDS = ['q400', 'atr42', 'crj900', 'b78x', 'a339', 'b779', 'a35k', 'b77f', 'a350f', 'b763bcf']


const qs = new URLSearchParams(location.search)
const view = qs.get('view') ?? 'sheet'
setAircraftQuality('high')
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)
installAircraftEnvironment(renderer)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#9fbfdc')
const sun = new THREE.DirectionalLight('#fff3e2', 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.bias = -0.0003
scene.add(sun, sun.target, new THREE.HemisphereLight('#dfeaf6', '#6d6a62', 0.9))
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#8e9094', roughness: 0.85 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000)
const labels: { text: string; at: THREE.Vector3 }[] = []
const wpm = aircraftWorldPerMeter()

function liveryFor(id: string, n: number): Livery {
  const fleet = ROSTER.filter((a) => a.fleet.includes(id))
  const a = fleet.length ? fleet[n % fleet.length] : ROSTER[n % ROSTER.length]
  return { body: a.primary, stripe: a.secondary, tail: a.primary, scheme: a.type === 'cargo' ? 'solid' : 'twotone', airline: a.id, wear: rosterWear(a.type, `${id}-${n}`) }
}

function place(id: string, livery: Livery, x: number, z: number, label: string) {
  const plane = createAircraft(id, livery)
  plane.position.set(x, 0, z)
  plane.rotation.y = Number(qs.get('rot') ?? 0.55)
  const open = Number(qs.get('doors') ?? 0)
  if (open > 0) updateAircraft(plane, true, { ...MOTION_IDLE, doors: open, cargo: Number(qs.get('cargo') ?? open) })
  plane.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  const hide = (qs.get('hide') ?? '').split(',').filter(Boolean)
  if (hide.length) plane.traverse((o) => { if (hide.includes(o.name)) o.visible = false })
  scene.add(plane)
  labels.push({ text: label, at: new THREE.Vector3(x, 0, z + LABEL_DZ) })
  return plane
}

let extent = 60
let LABEL_DZ = 30 * wpm
let halfW = 60
let halfH = 40
if (view === 'wear') {
  // Same airframe and airline: factory-fresh flag-carrier jet next to a tired budget one.
  const id = qs.get('id') ?? 'a320neo'
  const a = ROSTER.find((r) => r.id === (qs.get('airline') ?? '')) ?? ROSTER.find((r) => r.fleet.includes(id)) ?? ROSTER[0]
  const step = 44 * wpm
  const pick = qs.get('pick')
  const dx = pick ? 0 : step / 2
  if (pick !== 'worn') place(id, { body: a.primary, stripe: a.secondary, tail: a.primary, scheme: 'twotone', airline: a.id, wear: 0 }, -dx, 0, 'Top tier: wear 0 (fresh)')
  if (pick !== 'fresh') place(id, { body: a.primary, stripe: a.secondary, tail: a.primary, scheme: 'twotone', airline: a.id, wear: 1 }, dx, 0, 'Budget tier 0: wear 1')
  extent = step
  halfW = step * 1.25
  halfH = step * 0.6
} else if (view === 'liveries') {
  const id = qs.get('id') ?? 'a320neo'
  const ids = ROSTER.filter((a) => a.fleet.includes(id)).slice(0, 8)
  const pick = ids.length >= 6 ? ids : ROSTER.slice(0, 8)
  const step = 46 * wpm
  LABEL_DZ = 24 * wpm
  pick.forEach((a, i) => {
    const col = i % 4, row = Math.floor(i / 4)
    place(id, { body: a.primary, stripe: a.secondary, tail: a.primary, scheme: 'twotone', airline: a.id, wear: rosterWear(a.type, `${a.id}-${i}`) }, (col - 1.5) * step, (row - 0.5) * step * 1.1, a.name)
  })
  extent = step * 2.6
  halfW = step * 2.2
  halfH = step * 1.35
} else {
  const ids = [...Object.keys(MODEL_SPECS), ...EXTRA_IDS]
  if (qs.get('only')) ids.splice(0, ids.length, ...qs.get('only')!.split(','))
  const cols = Number(qs.get('cols') ?? 8)
  const step = 84 * wpm
  LABEL_DZ = 36 * wpm
  ids.forEach((id, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const rows = Math.ceil(ids.length / cols)
    place(id, liveryFor(id, i), (col - (cols - 1) / 2) * step, (row - (rows - 1) / 2) * step, id)
  })
  const rows = Math.ceil(ids.length / cols)
  extent = step * Math.max(cols, rows) * 0.62
  halfW = (step * cols) / 2
  halfH = (step * rows) / 2 * 0.78 + step * 0.2
}
const hour = Number(qs.get('hour') ?? 13)
const el = ((hour - 6) / 12) * Math.PI
sun.position.set(Math.cos(el) * 300, Math.max(30, Math.sin(el) * 400), 180)
Object.assign(sun.shadow.camera, { left: -extent * 1.4, right: extent * 1.4, top: extent * 1.4, bottom: -extent * 1.4, near: 1, far: 1500 })
sun.shadow.camera.updateProjectionMatrix()
const zoom = Number(qs.get('zoom') ?? 1)
const aspect = innerWidth / innerHeight
const hw = Math.max(halfW, halfH * aspect) / zoom
cam.left = -hw; cam.right = hw; cam.top = hw / aspect; cam.bottom = -hw / aspect
// Optional look-at point in airframe metres (tx, ty, tz), turned with the plane.
const target = new THREE.Vector3(Number(qs.get('tx') ?? 0), Number(qs.get('ty') ?? 0), Number(qs.get('tz') ?? 0))
  .multiplyScalar(wpm)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), Number(qs.get('rot') ?? 0.55))
cam.position.set(Number(qs.get('cx') ?? 0.12), Number(qs.get('cy') ?? 1), Number(qs.get('cz') ?? 0.85)).multiplyScalar(800).add(target)
cam.lookAt(target)
cam.updateProjectionMatrix()
const lbl = document.getElementById('lbl')!
function frame() {
  renderer.render(scene, cam)
  lbl.innerHTML = ''
  for (const l of labels) {
    const p = l.at.clone().project(cam)
    const d = document.createElement('div')
    d.textContent = l.text
    d.style.left = `${((p.x + 1) / 2) * innerWidth}px`
    d.style.top = `${((1 - p.y) / 2) * innerHeight}px`
    lbl.appendChild(d)
  }
  requestAnimationFrame(frame)
}
frame()
;(window as unknown as { __gallery: unknown }).__gallery = { scene, cam, renderer, ready: true }
