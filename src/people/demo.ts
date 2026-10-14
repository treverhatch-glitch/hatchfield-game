// Visual and perf check: /src/people/demo.html?n=2500&view=wide|close|lineup
import * as THREE from 'three'
import { createCrewMesh, createPassengerMesh } from './api.ts'
import { PeopleRenderer, type PeopleAgent } from './renderer.ts'
import { CREW_KINDS } from './types.ts'
import { crewLook, passengerLook } from './variants.ts'

const qs = new URLSearchParams(location.search)
const N = Number(qs.get('n') ?? 2500)
const view = qs.get('view') ?? 'wide'
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xcfd8e3)
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.7))
const sun = new THREE.DirectionalLight(0xffffff, 1.5)
sun.position.set(30, 60, 20)
scene.add(sun)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshLambertMaterial({ color: 0xe3ddd0 }))
floor.rotation.x = -Math.PI / 2
scene.add(floor)
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000)

const agents: PeopleAgent[] = []
let seq = 0
if (view === 'lineup') {
  // Crew and passenger gallery, close up.
  CREW_KINDS.forEach((kind, i) => {
    const g = createCrewMesh(kind, i + 1, { pose: kind === 'marshaller' ? 'wave' : 'idle' })
    g.position.set(-5.4 + i * 1.8, 0, -0.6)
    scene.add(g)
  })
  // Passengers: outfits, ages and luggage on the same base body.
  const gallery = [
    { seed: 'g1', outfit: 'casual', pose: 'walk' },
    { seed: 'g2', outfit: 'business', pose: 'bagPull', carry: 'roller' },
    { seed: 'g3', outfit: 'tourist', pose: 'idle', carry: 'none' },
    { seed: 'g4', outfit: 'casual', pose: 'queue', age: 'elder' },
    { seed: 'g5', outfit: 'casual', pose: 'walk', age: 'kid' },
    { seed: 'g6', outfit: 'casual', pose: 'push', carry: 'stroller' },
    { seed: 'g7', outfit: 'tourist', pose: 'seated', carry: 'duffel' },
  ] as const
  gallery.forEach((spec, i) => {
    const { seed, ...opts } = spec
    const g = createPassengerMesh(seed, { ...opts, phase: 0.2 })
    g.position.set(-5.4 + i * 1.8, 0, 2.4)
    scene.add(g)
  })
  camera.position.set(0, 1.9, 9.5)
  camera.lookAt(0, 0.95, 0.8)
} else {
  const kinds = CREW_KINDS
  for (let i = 0; i < N; i++) {
    const crew = i % 12 === 0
    const look = crew ? crewLook(kinds[(i / 12) % kinds.length | 0], i) : passengerLook(i, { age: i % 9 === 0 ? 'kid' : 'adult' })
    const walking = i % 3 !== 0
    agents.push({
      id: `a${seq++}`,
      look,
      x: -90 + (i % 60) * 3 + (Math.sin(i) * 0.8),
      y: 0,
      z: -60 + Math.floor(i / 60) * 3.2,
      yaw: walking ? (i % 2 ? Math.PI / 2 : -Math.PI / 2) : Math.PI,
      pose: walking ? (look.carry === 'roller' ? 'bagPull' : 'walk') : 'queue',
      speed: walking ? 1.2 : 0,
    })
  }
  if (view === 'close') {
    camera.position.set(-12, 1.9, 24)
    camera.lookAt(-8, 1.1, 14)
  } else {
    camera.position.set(0, 70, 95)
    camera.lookAt(0, 0, 0)
  }
}
const people = new PeopleRenderer(scene, { capacity: Math.max(256, N + 64) })
const hud = document.getElementById('hud')!
let prev = performance.now()
let acc = 0
let frames = 0
let cpuMs = 0
function loop(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000)
  prev = now
  for (const a of agents) {
    if (!a.speed) continue
    a.x += Math.sin(a.yaw) * a.speed * dt
    if (a.x > 100) a.x = -100
    else if (a.x < -100) a.x = 100
  }
  const t0 = performance.now()
  const s = people.update(agents, camera, dt)
  cpuMs += performance.now() - t0
  renderer.render(scene, camera)
  frames++
  acc += dt
  if (acc >= 1) {
    hud.textContent = `${N} people | near ${s.near} mid ${s.mid} far ${s.far} hidden ${s.hidden} | ${(cpuMs / frames).toFixed(2)} ms update | ${frames} fps | draws ${renderer.info.render.calls} tris ${renderer.info.render.triangles}`
    ;(window as unknown as { __stats: unknown }).__stats = { fps: frames, updateMs: cpuMs / frames, draws: renderer.info.render.calls, tris: renderer.info.render.triangles, ...s }
    acc = 0
    frames = 0
    cpuMs = 0
  }
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
