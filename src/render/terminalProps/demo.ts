/**
 * Preview page: /terminal-props.html?view=lineup|interior|exterior
 * Not part of the game bundle; used for screenshots and art review.
 */
import * as THREE from 'three'
import { preloadCc0 } from '../cc0/library'
import { buildTerminalExterior, buildTerminalHall, buildTerminalProps, setupTerminalEnvironment, TERMINAL_PROP_TYPES, terminalProp, type PropPlacement } from './index'

const qs = new URLSearchParams(location.search)
await preloadCc0()
const view = qs.get('view') ?? 'interior'
const quality = (qs.get('q') ?? 'high') as 'low' | 'high'
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#bcd3e6')
if (quality === 'high') setupTerminalEnvironment(renderer, scene)
const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 600)
const sun = new THREE.DirectionalLight('#fff6e8', 2.2)
sun.position.set(30, 60, 40)
sun.castShadow = true
sun.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048)
sun.shadow.bias = -0.0004
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 200 })
scene.add(sun, new THREE.AmbientLight('#ffffff', 0.35))

const W = 96, D = 60, H = 9
if (view === 'lineup') {
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#d8d6d0', roughness: 0.6 }))
  fl.rotation.x = -Math.PI / 2
  fl.receiveShadow = true
  scene.add(fl, new THREE.HemisphereLight('#ffffff', '#999080', 0.8))
  const placements: PropPlacement[] = []
  let x = 0, z = 0, rowD = 0
  const maxW = 46
  for (const t of TERMINAL_PROP_TYPES) {
    const s = terminalProp(t).size
    if (x + s.w > maxW) { x = 0; z += rowD + 2.5; rowD = 0 }
    placements.push({ type: t, x: x + s.w / 2, z: z + s.d / 2 })
    x += s.w + 1.6
    rowD = Math.max(rowD, s.d)
  }
  const g = buildTerminalProps(placements, { shadows: true })
  g.position.set(-maxW / 2, 0, -(z + rowD) / 2)
  scene.add(g)
  cam.position.set(0, 30, 31)
  cam.lookAt(0, 0, 1)
} else {
  const carpets = [{ x: 13, z: 13.5, w: 26, d: 10 }]
  const hall = buildTerminalHall({ width: W, depth: D, height: H, lights: view !== 'exterior' && view !== 'airside', quality, carpets })
  scene.add(hall)
  const P: PropPlacement[] = []
  for (let i = 0; i < 3; i++) P.push({ type: 'checkin_row', x: -30 + i * 14, z: -18 })
  for (let i = 0; i < 2; i++) P.push({ type: 'security_lane', x: 22, z: -24 + i * 5.5 })
  P.push({ type: 'security_lane_ct', x: 22, z: -11.5 })
  P.push({ type: 'shop_coffee', x: -40, z: 23.5, yaw: Math.PI }, { type: 'shop_dutyfree', x: -31, z: 23.5, yaw: Math.PI }, { type: 'shop_news', x: -22, z: 23.5, yaw: Math.PI }, { type: 'shop_fastfood', x: -13, z: 23.5, yaw: Math.PI })
  P.push({ type: 'food_court', x: -26, z: 14 })
  P.push({ type: 'gate_seating', x: 6, z: 12 }, { type: 'gate_seating', x: 20, z: 12 })
  P.push({ type: 'restroom_block', x: 4, z: 23.5, yaw: Math.PI })
  P.push({ type: 'baggage_carousel', x: 36, z: 16 })
  if (quality === 'high') {
    P.push({ type: 'departures_wall', x: -10, z: -6 })
    P.push({ type: 'kiosk_bank', x: -38, z: -10 }, { type: 'kiosk_bank', x: 0, z: -10 })
    P.push({ type: 'gate_pylon', x: 1, z: 9 }, { type: 'gate_pylon', x: 26, z: 9 })
  } else P.push({ type: 'departures_board', x: -4, z: -4 }, { type: 'departures_board', x: -16, z: -4 })
  P.push({ type: 'wayfinding_sign', x: -10, z: 2 }, { type: 'wayfinding_sign', x: 10, z: 2 }, { type: 'wayfinding_totem', x: 0, z: 4 })
  for (let i = 0; i < 6; i++) P.push({ type: 'planter_long', x: -36 + i * 8, z: 0 })
  for (let i = 0; i < 4; i++) P.push({ type: 'bin', x: -32 + i * 16, z: 4 })
  P.push({ type: 'planter', x: -45, z: -4 }, { type: 'planter', x: 45, z: -4 })
  scene.add(buildTerminalProps(P, { shadows: true }))
  if (view === 'exterior' || view === 'airside') {
    scene.add(buildTerminalExterior({ width: W, depth: D, height: H, quality }))
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#6f8f55' }))
    grass.rotation.x = -Math.PI / 2
    grass.position.y = -0.02
    scene.add(grass)
    if (view === 'airside') {
      cam.position.set(30, 14, -70)
      cam.lookAt(0, 4, -36)
    } else {
      cam.position.set(-70, 32, 95)
      cam.lookAt(0, 4, 20)
    }
  } else if (view === 'security') {
    cam.position.set(12, 3.4, -2)
    cam.lookAt(22, 1.0, -14)
    cam.fov = 55
    cam.updateProjectionMatrix()
  } else if (view === 'checkinClose') {
    cam.position.set(-26.5, 2.2, -9.5)
    cam.lookAt(-30, 1.5, -19)
    cam.fov = 50
    cam.updateProjectionMatrix()
  } else if (view === 'securityClose') {
    cam.position.set(17.5, 2.4, -17)
    cam.lookAt(22.5, 0.9, -23.5)
    cam.fov = 55
    cam.updateProjectionMatrix()
  } else if (view === 'doors') {
    cam.position.set(22, 2.6, 19)
    cam.lookAt(24, 1.8, 30)
    cam.fov = 60
    cam.updateProjectionMatrix()
  } else if (view === 'retail') {
    cam.position.set(-34, 2.6, 14)
    cam.lookAt(-38, 1.4, 22)
    cam.fov = 60
    cam.updateProjectionMatrix()
  } else if (view === 'checkin') {
    cam.position.set(-24, 3.2, 2)
    cam.lookAt(-30, 1.6, -18)
    cam.fov = 55
    cam.updateProjectionMatrix()
  } else if (view === 'gates') {
    cam.position.set(-2, 3.0, 22)
    cam.lookAt(14, 1.2, 10)
    cam.fov = 60
    cam.updateProjectionMatrix()
  } else {
    // camera inside, looking across the hall from a mezzanine height
    cam.position.set(-6, 8, -6)
    cam.lookAt(-30, 0.5, 20)
    cam.fov = 60
    cam.updateProjectionMatrix()
  }
}
const camQ = qs.get('cam')?.split(',').map(Number)
if (camQ?.length === 6) {
  cam.position.set(camQ[0], camQ[1], camQ[2])
  cam.lookAt(camQ[3], camQ[4], camQ[5])
}
renderer.render(scene, cam)
// Keep drawing while photo textures stream in, then flag ready for screenshots.
let frames = 0
const tick = setInterval(() => {
  renderer.render(scene, cam)
  if (++frames === Number(qs.get('settle') ?? 12)) {
    clearInterval(tick)
    ;(window as unknown as { __ready: boolean }).__ready = true
  }
}, 500)
