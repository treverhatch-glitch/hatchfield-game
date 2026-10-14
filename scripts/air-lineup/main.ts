/**
 * Dev page: every airframe in a row, or one jet at a stand with its motion forced.
 * /scripts/air-lineup/?view=lineup|stand|flaps&night=1
 */
import * as THREE from 'three'
import { createAircraft, MODEL_SPECS, motionForPhase, setAircraftLamp, updateAircraft } from '../../src/render/aircraft/index'

const q = new URLSearchParams(location.search)
const view = q.get('view') ?? 'lineup'
const night = q.get('night') === '1'
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(1)
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(night ? '#0b1424' : '#a9c4dc')
scene.add(new THREE.HemisphereLight(night ? '#334466' : '#ffffff', '#556655', night ? 0.6 : 1.6))
const sun = new THREE.DirectionalLight('#ffffff', night ? 0.25 : 2.2)
sun.position.set(30, 60, 40)
scene.add(sun)
setAircraftLamp(night ? 1 : 0)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: night ? '#2a2f36' : '#7d8288' }))
ground.rotation.x = -Math.PI / 2
scene.add(ground)
// Wide fov plus zoom keeps the LOD distance (distance / zoom) inside the close band.
const camera = new THREE.PerspectiveCamera(170, innerWidth / innerHeight, 0.5, 6000)
camera.zoom = Math.tan((85 * Math.PI) / 180) / Math.tan((16 * Math.PI) / 180)
camera.updateProjectionMatrix()
const livery = { body: '#f4f6f8', stripe: '#0b4ea2', tail: '#0b4ea2', airline: 'grok' } as never

const ids = Object.keys(MODEL_SPECS)
const GROUPS: Record<string, string[]> = {
  regional: ['bn2', 'pc12', 'dhc6', 'atr72', 'citation', 'e175', 'crj700'],
  narrow: ['a223', 'e195e2', 'a320neo', 'b738', 'b38m', 'a321'],
  wide: ['b789', 'a359', 'b77w', 'a380'],
  freight: ['b752f', 'b763f', 'b748f', 'an124', 'c5', 'c17', 'c130'],
  special: ['aw139', 's76', 'at802', 'cl415', 'f15', 'kc135'],
}
if (view === 'lineup') {
  // One tier per shot, 3/4 front view, spaced by span so each airframe reads.
  const group = GROUPS[q.get('group') ?? 'narrow'] ?? ids
  let x = 0
  let maxSpan = 0
  group.forEach((id) => {
    const plane = createAircraft(id, livery)
    const s = plane.children[0].scale.x
    const span = s * MODEL_SPECS[id].spanM
    const len = s * MODEL_SPECS[id].lengthM
    maxSpan = Math.max(maxSpan, span, len)
    x += Math.max(span, len) * 0.55
    plane.position.set(x, 0, 0)
    plane.rotation.y = -0.75
    x += Math.max(span, len) * 0.55
    updateAircraft(plane, true, motionForPhase({ phase: 'taxi_out' }))
    scene.add(plane)
  })
  // Fit the row: effective vertical fov is 32°, so horizontal half-angle is about 27°.
  const box = new THREE.Box3()
  scene.children.forEach((o) => { if (o.type === 'Group') box.expandByObject(o) })
  const c = box.getCenter(new THREE.Vector3())
  const width = box.max.x - box.min.x
  const dist = (width * 0.5) / Math.tan((27 * Math.PI) / 180) * 1.02
  const dir = new THREE.Vector3(0.12, 0.42, 1).normalize()
  camera.position.copy(c).addScaledVector(dir, dist)
  camera.lookAt(c.x, 0, c.z)
  void maxSpan
} else {
  const id = q.get('id') ?? 'b789'
  const plane = createAircraft(id, livery)
  plane.rotation.y = q.get('rot') ? Number(q.get('rot')) : view === 'stand' ? 0.25 : -0.6
  const phase = view === 'stand' ? 'deboard' : 'landing'
  updateAircraft(plane, true, motionForPhase({ phase, alt: 0 }))
  scene.add(plane)
  const gearT = q.get('gearT')
  if (gearT !== null) {
    // Freeze the gear mid-swing for a retraction still.
    plane.userData.gearDown = false
    const lod = plane.getObjectByName('lod') as unknown as { gearT: number; posed: boolean }
    const hold = () => { lod.gearT = Number(gearT); requestAnimationFrame(hold) }
    hold()
  }
  const L = plane.children[0].scale.x * MODEL_SPECS[id].lengthM
  const cam = q.get('cam')?.split(',').map(Number)
  if (cam) camera.position.set(L * cam[0], L * cam[1], L * cam[2])
  else if (view === 'stand') camera.position.set(L * 0.35, L * 0.22, L * 0.62)
  else camera.position.set(-L * 0.55, L * 0.32, L * 0.5)
  const look = q.get('look')?.split(',').map(Number)
  if (look) camera.lookAt(L * look[0], L * look[1], L * look[2])
  else camera.lookAt(0, L * 0.05, 0)
}
let frames = 0
function tick() {
  renderer.render(scene, camera)
  frames++
  if (frames === 240) (window as unknown as { __ready: boolean }).__ready = true
  requestAnimationFrame(tick)
}
tick()
