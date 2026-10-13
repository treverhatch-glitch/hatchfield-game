// Perf demo: /src/render/people/demo.html?n=5000&view=wide|close
import * as THREE from 'three'
import { createCrowd, type CrowdAgent, type Role } from './index'

const qs = new URLSearchParams(location.search)
const N = Number(qs.get('n') ?? 5000)
const view = qs.get('view') ?? 'wide'
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdbe4ee)
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(30, 60, 20); scene.add(sun)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 160), new THREE.MeshLambertMaterial({ color: 0xe7e2d8 })); floor.rotation.x = -Math.PI / 2; scene.add(floor)
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000)
if (view === 'close') { camera.position.set(-52, 7, -22); camera.lookAt(-40, 0.8, -8) } else { camera.position.set(0, 70, 95); camera.lookAt(0, 0, 0) }

// terminal-like layout: check-in queues, security, seating rows, shops, R&D, walking streams
const agents: (CrowdAgent & { vx: number; vz: number })[] = []
const staffRoles: Role[] = ['checkin', 'security', 'gate', 'shop', 'cleaner', 'researcher']
let id = 0
const add = (role: Role, x: number, z: number, heading: number, state: string, vx = 0, vz = 0) =>
  agents.push({ id: id++, role, pos: { x, y: 0, z }, heading, state, bagIds: role === 'passenger' && id % 2 ? [`b${id}`] : [], vx, vz })
const staffCount = Math.round(N * 0.06)
for (let i = 0; i < staffCount; i++) {
  const role = staffRoles[i % staffRoles.length]
  const k = (i / staffRoles.length) | 0
  const x = -110 + (k % 40) * 5.5, z = -70 + staffRoles.indexOf(role) * 4 + ((k / 40) | 0) * 26
  add(role, x, z, 0, role === 'researcher' ? 'research' : role === 'cleaner' ? 'walking' : 'serving', role === 'cleaner' ? 0.6 : 0)
}
const pax = N - staffCount
for (let i = 0; i < pax; i++) {
  const r = i % 10
  if (r < 3) { const lane = i % 24, slot = (i / 24) | 0; add('passenger', -100 + lane * 4, -40 + (slot % 30) * 0.8, Math.PI, 'queue_checkin') }
  else if (r < 6) { const s = (i / 10) | 0; add('passenger', -60 + (s % 110) * 1.0, 10 + ((s / 110) | 0) * 1.6, 0, 'seated_gate') }
  else { const dir = i % 2 ? 1 : -1, sp = 1.1 + (i % 7) * 0.08; add('passenger', -120 + Math.random() * 240, 45 + Math.random() * 30, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'walking', dir * sp, 0) }
}
const crowd = createCrowd(scene, { camera, capacity: N + 100 })
// a few hungry passengers
for (let i = 0; i < 6; i++) crowd.showThought(agents[agents.length - 1 - i * 37].id, { icon: '🍔', text: 'wish they had burgers', duration: 1e6 })
crowd.showThought(agents[staffCount + 5].id, { icon: '⏳', text: 'this queue is long', duration: 1e6 })

const hud = document.getElementById('hud')!
let frames = 0, last = performance.now(), fps = 0, worst = 0, prev = last
const samples: number[] = []
function loop(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000); worst = Math.max(worst, now - prev); prev = now
  for (const a of agents) if (a.vx || a.vz) { const p = a.pos as { x: number; z: number }; p.x += a.vx * dt; p.z += a.vz * dt; if (p.x > 125) p.x = -125; if (p.x < -125) p.x = 125 }
  const s = crowd.update(agents, dt)
  renderer.render(scene, camera)
  frames++
  if (now - last >= 1000) {
    fps = (frames * 1000) / (now - last); samples.push(fps); frames = 0; last = now
    hud.textContent = `people ${N}  visible ${s.visible}  LOD ${s.lod.join('/')}\nfps ${fps.toFixed(1)}  worst frame ${worst.toFixed(1)}ms\ndraw calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`
    ;(window as any).__perf = { n: N, view, fps, samples: [...samples], worstMs: worst, stats: { ...s, lod: [...s.lod] }, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, gl: (() => { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown' })() }
    worst = 0
  }
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) })
