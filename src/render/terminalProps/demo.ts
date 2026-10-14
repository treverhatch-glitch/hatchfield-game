/**
 * Preview page: /terminal-props.html?view=lineup|interior|exterior
 * Not part of the game bundle; used for screenshots and art review.
 */
import * as THREE from 'three'
import { buildTerminalExterior, buildTerminalHall, buildTerminalProps, TERMINAL_PROP_TYPES, terminalProp, type PropPlacement } from './index'

const view = new URLSearchParams(location.search).get('view') ?? 'interior'
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#bcd3e6')
const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 600)
const sun = new THREE.DirectionalLight('#fff6e8', 2.2)
sun.position.set(30, 60, 40)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
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
  const hall = buildTerminalHall({ width: W, depth: D, height: H, lights: view === 'interior' })
  scene.add(hall)
  const P: PropPlacement[] = []
  for (let i = 0; i < 3; i++) P.push({ type: 'checkin_row', x: -30 + i * 14, z: -18 })
  for (let i = 0; i < 3; i++) P.push({ type: 'security_lane', x: 22, z: -20 + i * 5 })
  P.push({ type: 'shop_coffee', x: -40, z: 23.5, yaw: Math.PI }, { type: 'shop_dutyfree', x: -31, z: 23.5, yaw: Math.PI }, { type: 'shop_news', x: -22, z: 23.5, yaw: Math.PI }, { type: 'shop_fastfood', x: -13, z: 23.5, yaw: Math.PI })
  P.push({ type: 'food_court', x: -26, z: 14 })
  P.push({ type: 'gate_seating', x: 6, z: 12 }, { type: 'gate_seating', x: 20, z: 12 })
  P.push({ type: 'restroom_block', x: 4, z: 23.5, yaw: Math.PI })
  P.push({ type: 'baggage_carousel', x: 36, z: 16 })
  P.push({ type: 'departures_board', x: -4, z: -4 }, { type: 'departures_board', x: -16, z: -4 })
  P.push({ type: 'wayfinding_sign', x: -10, z: 2 }, { type: 'wayfinding_sign', x: 10, z: 2 }, { type: 'wayfinding_totem', x: 0, z: 4 })
  for (let i = 0; i < 6; i++) P.push({ type: 'planter_long', x: -36 + i * 8, z: 0 })
  for (let i = 0; i < 4; i++) P.push({ type: 'bin', x: -32 + i * 16, z: 4 })
  P.push({ type: 'planter', x: -45, z: -4 }, { type: 'planter', x: 45, z: -4 })
  scene.add(buildTerminalProps(P, { shadows: true }))
  if (view === 'exterior') {
    scene.add(buildTerminalExterior({ width: W, depth: D, height: H }))
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#6f8f55' }))
    grass.rotation.x = -Math.PI / 2
    grass.position.y = -0.02
    scene.add(grass)
    cam.position.set(-70, 32, 95)
    cam.lookAt(0, 4, 20)
  } else {
    // camera inside, looking across the hall from a mezzanine height
    cam.position.set(-6, 8, -6)
    cam.lookAt(-30, 0.5, 20)
    cam.fov = 60
    cam.updateProjectionMatrix()
  }
}
renderer.render(scene, cam)
setTimeout(() => {
  renderer.render(scene, cam)
  ;(window as unknown as { __ready: boolean }).__ready = true
}, 1500)
