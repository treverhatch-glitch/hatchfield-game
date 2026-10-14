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
if (view === 'lineup') {
  // Two rows sorted by length so scale reads at a glance.
  const sorted = ids.slice().sort((a, b) => MODEL_SPECS[a].lengthM - MODEL_SPECS[b].lengthM)
  const half = Math.ceil(sorted.length / 2)
  let x = [0, 0]
  sorted.forEach((id, i) => {
    const row = i < half ? 0 : 1
    const plane = createAircraft(id, livery)
    const span = plane.children[0].scale.x * MODEL_SPECS[id].spanM
    x[row] += span / 2 + 2
    plane.position.set(x[row], 0, row * -90)
    plane.rotation.y = Math.PI / 2
    x[row] += span / 2 + 2
    updateAircraft(plane, true, motionForPhase({ phase: 'taxi_out' }))
    scene.add(plane)
  })
  const w = Math.max(x[0], x[1])
  camera.position.set(w / 2, w * 0.35, w * 0.55)
  camera.lookAt(w / 2, 0, -45)
} else {
  const id = q.get('id') ?? 'b789'
  const plane = createAircraft(id, livery)
  plane.rotation.y = view === 'stand' ? 0.25 : -0.6
  const phase = view === 'stand' ? 'deboard' : 'landing'
  updateAircraft(plane, true, motionForPhase({ phase, alt: 0 }))
  scene.add(plane)
  const L = plane.children[0].scale.x * MODEL_SPECS[id].lengthM
  if (view === 'stand') camera.position.set(L * 0.35, L * 0.22, L * 0.62)
  else camera.position.set(-L * 0.55, L * 0.32, L * 0.5)
  camera.lookAt(0, L * 0.05, 0)
}
let frames = 0
function tick() {
  renderer.render(scene, camera)
  frames++
  if (frames === 240) (window as unknown as { __ready: boolean }).__ready = true
  requestAnimationFrame(tick)
}
tick()
