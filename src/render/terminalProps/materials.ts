/**
 * Materials for terminal props and the hall shell. Gemini textures ship as
 * base64 text (imported ?raw) and are unpacked to data URLs at load, so the
 * repo needs no binary files. Canvas-drawn textures (FIDS screens, signs)
 * only exist in the browser; in tests every map is skipped.
 */
import * as THREE from 'three'
import terrazzoB64 from './tex/terrazzo.b64.txt?raw'
import glassB64 from './tex/glass.b64.txt?raw'
import beltB64 from './tex/belt.b64.txt?raw'
import plateB64 from './tex/plate.b64.txt?raw'
import roofB64 from './tex/roof.b64.txt?raw'
import coffeeB64 from './tex/shop_coffee.b64.txt?raw'
import dutyB64 from './tex/shop_dutyfree.b64.txt?raw'
import newsB64 from './tex/shop_news.b64.txt?raw'
import burgerB64 from './tex/shop_burger.b64.txt?raw'
import checkinB64 from './tex/checkin.b64.txt?raw'
import securityB64 from './tex/security.b64.txt?raw'
import { deskHeaderTexture, fidsBoardTexture, wayfindingSheetTexture } from '../signage/load'
import { counterSheetTexture } from './counterArt'
import { interiorTexture } from './interiorTex'
import { bigSign, brushedRough, carpet, corrugated, fids2k, floorTile, slats, wallTile } from './hiq'
import { attachBuildingMaterial } from '../reflections'

export const GEMINI_TEX = {
  terrazzo: terrazzoB64,
  glass: glassB64,
  belt: beltB64,
  plate: plateB64,
  roof: roofB64,
  shop_coffee: coffeeB64,
  shop_dutyfree: dutyB64,
  shop_news: newsB64,
  shop_burger: burgerB64,
  checkin: checkinB64,
  security: securityB64,
} as const
export type GeminiTex = keyof typeof GEMINI_TEX

const hasDom = typeof document !== 'undefined'

const texCache = new Map<string, THREE.Texture>()
export function geminiTexture(name: GeminiTex, repeat: [number, number] = [1, 1]): THREE.Texture | null {
  if (!hasDom) return null
  const key = `${name}:${repeat.join('x')}`
  const hit = texCache.get(key)
  if (hit) return hit
  const t = new THREE.TextureLoader().load(`data:image/jpeg;base64,${GEMINI_TEX[name].trim()}`)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  texCache.set(key, t)
  return t
}

/** Draw a canvas texture; returns null outside the browser. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture | null {
  if (!hasDom) return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return null
  draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function signTex(text: string, bg: string, fg: string, icon = '', w = 512, h = 128) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.fillStyle = fg
    g.font = `bold ${Math.round(h * 0.5)}px Helvetica, Arial, sans-serif`
    g.textBaseline = 'middle'
    const x = icon ? h * 1.05 : w * 0.06
    if (icon) {
      g.fillRect(h * 0.12, h * 0.12, h * 0.76, h * 0.76)
      g.fillStyle = bg
      g.textAlign = 'center'
      g.fillText(icon, h * 0.5, h * 0.53)
      g.fillStyle = fg
    }
    g.textAlign = 'left'
    const avail = w - x - w * 0.04
    const fit = Math.min(h * 0.5, (h * 0.5 * avail) / Math.max(1, g.measureText(text).width))
    g.font = `bold ${Math.floor(fit)}px Helvetica, Arial, sans-serif`
    g.fillText(text, x, h * 0.53)
  })
}

const FLIGHTS = [
  ['08:05', 'ZJ 214', 'BANGKOK', 'A12', 'BOARDING', '#7cf27c'],
  ['08:20', 'CP 880', 'SINGAPORE', 'B03', 'ON TIME', '#ffffff'],
  ['08:35', 'SB 117', 'CHIANG MAI', 'A07', 'GATE OPEN', '#7cf27c'],
  ['08:50', 'BL 042', 'PHUKET', 'A02', 'DELAYED 09:25', '#ffb000'],
  ['09:10', 'ZJ 330', 'HONG KONG', 'B11', 'ON TIME', '#ffffff'],
  ['09:25', 'NS 905', 'TOKYO NRT', 'B09', 'ON TIME', '#ffffff'],
  ['09:40', 'CP 612', 'SYDNEY', 'B14', 'CHECK-IN', '#8fd3ff'],
  ['09:55', 'SB 221', 'HANOI', 'A05', 'CANCELLED', '#ff5050'],
  ['10:15', 'ZJ 476', 'KUALA LUMPUR', 'A10', 'ON TIME', '#ffffff'],
  ['10:30', 'BL 058', 'KRABI', 'A03', 'ON TIME', '#ffffff'],
]
function fidsTex() {
  return canvasTexture(1024, 640, (g) => {
    g.fillStyle = '#06122a'
    g.fillRect(0, 0, 1024, 640)
    g.fillStyle = '#ffcf00'
    g.fillRect(0, 0, 1024, 70)
    g.fillStyle = '#06122a'
    g.font = 'bold 44px Helvetica, Arial, sans-serif'
    g.fillText('✈  DEPARTURES', 24, 50)
    g.font = 'bold 22px Helvetica, Arial'
    g.fillStyle = '#9fb3d9'
    ;['TIME', 'FLIGHT', 'DESTINATION', 'GATE', 'REMARKS'].forEach((t, i) => g.fillText(t, [24, 130, 290, 620, 730][i], 100))
    g.font = 'bold 30px Courier New, monospace'
    FLIGHTS.forEach((f, r) => {
      const y = 145 + r * 50
      if (r % 2) {
        g.fillStyle = '#0b1c3d'
        g.fillRect(0, y - 34, 1024, 50)
      }
      g.fillStyle = '#ffd34d'
      ;[f[0], f[1], f[2], f[3]].forEach((t, i) => g.fillText(t, [24, 130, 290, 620][i], y))
      g.fillStyle = f[5]
      g.fillText(f[4], 730, y)
    })
  })
}

export interface MatSpec {
  color: string
  rough?: number
  metal?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  map?: () => THREE.Texture | null
  /** Use the map as emissive too (backlit screens and lightboxes). */
  glow?: boolean
  /** Roughness map (linear). */
  roughMap?: () => THREE.Texture | null
  /** Clearcoat (polished floors, lacquer, car-paint-like panels). Uses MeshPhysicalMaterial. */
  clearcoat?: number
  /** Environment reflection strength (default 1). */
  envI?: number
}

export const MATERIALS: Record<string, MatSpec> = {
  // structure and finishes
  steel: { color: '#b9bec4', rough: 0.35, metal: 0.85, roughMap: brushedRough },
  brushed: { color: '#d4d7da', rough: 0.6, metal: 0.95, roughMap: brushedRough },
  chrome: { color: '#eceff2', rough: 0.12, metal: 1 },
  darkSteel: { color: '#2b2f35', rough: 0.5, metal: 0.6 },
  black: { color: '#15171a', rough: 0.6, metal: 0.2 },
  rubber: { color: '#1c1d1f', rough: 0.9, metal: 0 },
  belt: { color: '#3a3a3a', rough: 0.8, metal: 0.1, map: () => geminiTexture('belt', [2, 1]) },
  plate: { color: '#c8ccd0', rough: 0.4, metal: 0.8, map: () => geminiTexture('plate', [2, 2]) },
  white: { color: '#f2f1ec', rough: 0.4 },
  cream: { color: '#e9e2d2', rough: 0.55 },
  greyPanel: { color: '#8d939a', rough: 0.5, metal: 0.2 },
  corian: { color: '#f6f5f1', rough: 0.2, clearcoat: 0.5 },
  granite: { color: '#34363a', rough: 0.25, metal: 0.1, clearcoat: 0.8 },
  oak: { color: '#b88a58', rough: 0.55 },
  walnut: { color: '#6a4528', rough: 0.5 },
  glass: { color: '#bfe3ee', rough: 0.05, metal: 0.1, opacity: 0.28 },
  glassTint: { color: '#7fb6c8', rough: 0.05, metal: 0.3, opacity: 0.4 },
  // brand + accent
  hatchBlue: { color: '#1f4e8c', rough: 0.4 },
  navy: { color: '#16233b', rough: 0.45 },
  signYellow: { color: '#ffcf00', rough: 0.4, emissive: '#ffcf00', emissiveIntensity: 0.35 },
  signDark: { color: '#20252c', rough: 0.4 },
  red: { color: '#c8322b', rough: 0.4 },
  green: { color: '#2f7a46', rough: 0.5 },
  orange: { color: '#e5791f', rough: 0.45 },
  // soft
  seatBlue: { color: '#2b5f96', rough: 0.7 },
  seatGrey: { color: '#5a6068', rough: 0.75 },
  leather: { color: '#3c2a22', rough: 0.6 },
  fabricRed: { color: '#9e2b2b', rough: 0.85 },
  leaf: { color: '#3d7d3a', rough: 0.8 },
  leafDark: { color: '#2b5b2e', rough: 0.8 },
  soil: { color: '#3b2a1e', rough: 1 },
  pebble: { color: '#d9d4c8', rough: 0.9 },
  // luggage
  bagBlack: { color: '#22252a', rough: 0.55 },
  bagRed: { color: '#b0322e', rough: 0.5 },
  bagTeal: { color: '#2b8a8a', rough: 0.5 },
  bagSilver: { color: '#b5b9bf', rough: 0.3, metal: 0.6 },
  tray: { color: '#4b5560', rough: 0.6 },
  // emissive
  screen: { color: '#0d1b33', rough: 0.2, emissive: '#3b7bd6', emissiveIntensity: 0.6 },
  screenGreen: { color: '#0a2a14', rough: 0.2, emissive: '#2fd062', emissiveIntensity: 0.9 },
  screenRed: { color: '#2a0a0a', rough: 0.2, emissive: '#ff3a2a', emissiveIntensity: 0.9 },
  lamp: { color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 2.2 },
  lampCool: { color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: 1.6 },
  amber: { color: '#ffb000', emissive: '#ffb000', emissiveIntensity: 1.2 },
  // textured / signage
  terrazzo: { color: '#ffffff', rough: 0.25, map: () => geminiTexture('terrazzo', [1, 1]) },
  fids: { color: '#ffffff', rough: 0.2, map: () => fidsBoardTexture() ?? fids2k() ?? fidsTex(), glow: true },
  fidsArr: { color: '#ffffff', rough: 0.2, map: () => fids2k('ARRIVALS', '#8fd3ff'), glow: true },
  // pass 2: high-res finishes (desktop tier)
  floorTile: { color: '#ffffff', rough: 1, map: () => floorTile('color', [1, 1]), roughMap: () => floorTile('rough', [1, 1]), clearcoat: 0.35 },
  carpet: { color: '#ffffff', rough: 0.95, map: () => carpet([2, 2]) },
  slat: { color: '#ffffff', rough: 0.8, map: () => slats('color', [1, 1]) },
  oakSlat: { color: '#c79a66', rough: 0.55 },
  corrugated: { color: '#ffffff', rough: 0.35, metal: 0.8, map: () => corrugated([6, 1]) },
  jbGlass: { color: '#5d8796', rough: 0.05, metal: 0.4, opacity: 0.55 },
  bellows: { color: '#2a2c30', rough: 0.85 },
  tileWhite: { color: '#ffffff', rough: 0.2, map: () => wallTile('#f2f2ee', [3, 2]), clearcoat: 0.6 },
  tileTeal: { color: '#ffffff', rough: 0.2, map: () => wallTile('#4e8c86', [3, 2]), clearcoat: 0.6 },
  mirror: { color: '#f4f6f8', rough: 0.02, metal: 1, envI: 1.5 },
  stainless: { color: '#c9cdd1', rough: 0.3, metal: 1, roughMap: brushedRough },
  lacquerBlue: { color: '#1f4e8c', rough: 0.25, clearcoat: 1 },
  lacquerWhite: { color: '#f5f5f2', rough: 0.25, clearcoat: 1 },
  led: { color: '#ffffff', emissive: '#dff0ff', emissiveIntensity: 3 },
  ledWarm: { color: '#ffffff', emissive: '#ffd9a0', emissiveIntensity: 2.6 },
  ledBlue: { color: '#4fa3ff', emissive: '#4fa3ff', emissiveIntensity: 2.2 },
  kiosk: { color: '#ffffff', rough: 0.2, map: () => bigSign('Self check-in  ✈  Tap to start', '#0c3a6e', '#ffffff', 512, 768), glow: true },
  sgnGateA12: { color: '#ffffff', map: () => bigSign('A12', '#ffcf00', '#111111', 512, 256), glow: true },
  sgnGateA14: { color: '#ffffff', map: () => bigSign('A14', '#ffcf00', '#111111', 512, 256), glow: true },
  sgnHatchBig: { color: '#ffffff', map: () => bigSign('HATCHFIELD', '#0e2240', '#ffffff', 2048, 256), glow: true },
  sgnDepartures: { color: '#ffffff', map: () => wayfindingSheetTexture('departures') ?? bigSign('DEPARTURES  ✈', '#0e2240', '#ffcf00', 1024, 192), glow: true },
  sgnArrivals: { color: '#ffffff', map: () => wayfindingSheetTexture('arrivals') ?? bigSign('ARRIVALS', '#0e2240', '#8fd3ff', 1024, 192), glow: true },
  asphalt: { color: '#3a3c3f', rough: 0.92 },
  apronConcrete: { color: '#a9a7a1', rough: 0.85 },
  sgnGates: { color: '#ffffff', map: () => wayfindingSheetTexture('gates') ?? signTex('Gates A1–A12  →', '#20252c', '#ffcf00', '✈'), glow: true },
  sgnBags: { color: '#ffffff', map: () => wayfindingSheetTexture('baggage') ?? signTex('Baggage claim  ↓', '#20252c', '#ffcf00', '▤'), glow: true },
  sgnWC: { color: '#ffffff', map: () => wayfindingSheetTexture('toilets') ?? signTex('Toilets   ←', '#20252c', '#ffcf00', 'WC'), glow: true },
  sgnExit: { color: '#ffffff', map: () => wayfindingSheetTexture('exit') ?? signTex('Exit  ·  Taxi  ·  Bus', '#1d6b3a', '#ffffff', '⇥'), glow: true },
  sgnCheckin: { color: '#ffffff', map: () => wayfindingSheetTexture('checkin') ?? signTex('Check-in  A  1–8', '#16233b', '#ffffff'), glow: true },
  sgnSecurity: { color: '#ffffff', map: () => wayfindingSheetTexture('security') ?? signTex('Security', '#16233b', '#ffffff'), glow: true },
  sgnCoffee: { color: '#ffffff', map: () => signTex('HATCH COFFEE', '#2b1a10', '#f3d7a7'), glow: true },
  sgnDuty: { color: '#ffffff', map: () => signTex('DUTY FREE', '#101010', '#e8c66a'), glow: true },
  sgnNews: { color: '#ffffff', map: () => signTex('NEWS + BOOKS', '#b0201c', '#ffffff'), glow: true },
  sgnBurger: { color: '#ffffff', map: () => signTex('RUNWAY BURGER', '#d4402c', '#ffd23f'), glow: true },
  sgnFood: { color: '#ffffff', map: () => signTex('Food court', '#20252c', '#ffcf00', '🍴'), glow: true },
  sgnMen: { color: '#ffffff', map: () => signTex('Men', '#16233b', '#ffffff', '♂', 256, 128), glow: true },
  sgnWomen: { color: '#ffffff', map: () => signTex('Women', '#16233b', '#ffffff', '♀', 256, 128), glow: true },
  sgnBelt: { color: '#ffffff', map: () => signTex('Belt 3   ZJ214 BKK', '#06122a', '#ffd34d'), glow: true },
  sgnHatch: { color: '#ffffff', map: () => signTex('HATCHFIELD INTERNATIONAL', '#ffffff', '#1f4e8c', '', 1024, 128), glow: true },
  lbCoffee: { color: '#ffffff', map: () => counterSheetTexture('coffee') ?? geminiTexture('shop_coffee'), glow: true },
  lbDuty: { color: '#ffffff', map: () => counterSheetTexture('dutyfree') ?? geminiTexture('shop_dutyfree'), glow: true },
  lbNews: { color: '#ffffff', map: () => counterSheetTexture('news') ?? geminiTexture('shop_news'), glow: true },
  lbBurger: { color: '#ffffff', map: () => counterSheetTexture('burger') ?? geminiTexture('shop_burger'), glow: true },
  lbCheckin: { color: '#ffffff', map: () => geminiTexture('checkin'), glow: true },
  lbSecurity: { color: '#ffffff', map: () => geminiTexture('security'), glow: true },
  logo0: { color: '#ffffff', map: () => logoTex(0), glow: true },
  logo1: { color: '#ffffff', map: () => logoTex(1), glow: true },
  logo2: { color: '#ffffff', map: () => logoTex(2), glow: true },
  logo3: { color: '#ffffff', map: () => logoTex(3), glow: true },
  // round 4: staff / officers (low-poly figures on props)
  skin: { color: '#d4a574', rough: 0.7 },
  skinDark: { color: '#8d5a3b', rough: 0.7 },
  hair: { color: '#2a1f18', rough: 0.85 },
  hairBrown: { color: '#5a3a22', rough: 0.85 },
  shirtWhite: { color: '#f4f4f0', rough: 0.75 },
  shirtNavy: { color: '#1a2a4a', rough: 0.7 },
  pantsNavy: { color: '#1c2740', rough: 0.75 },
  pantsBlack: { color: '#1a1c20', rough: 0.75 },
  vestYellow: { color: '#f0c020', rough: 0.55, emissive: '#f0c020', emissiveIntensity: 0.15 },
  // per-desk number lightboxes
  desk1: { color: '#ffffff', map: () => deskHeaderTexture(1) ?? bigSign('1', '#0e2240', '#ffcf00', 256, 256), glow: true },
  desk2: { color: '#ffffff', map: () => deskHeaderTexture(2) ?? bigSign('2', '#0e2240', '#ffcf00', 256, 256), glow: true },
  desk3: { color: '#ffffff', map: () => deskHeaderTexture(3) ?? bigSign('3', '#0e2240', '#ffcf00', 256, 256), glow: true },
  desk4: { color: '#ffffff', map: () => deskHeaderTexture(4) ?? bigSign('4', '#0e2240', '#ffcf00', 256, 256), glow: true },
  desk5: { color: '#ffffff', map: () => deskHeaderTexture(5) ?? bigSign('5', '#0e2240', '#ffcf00', 256, 256), glow: true },
  desk6: { color: '#ffffff', map: () => deskHeaderTexture(6) ?? bigSign('6', '#0e2240', '#ffcf00', 256, 256), glow: true },
  deskOpen: { color: '#ffffff', map: () => bigSign('OPEN', '#0a3a14', '#2fd062', 512, 192), glow: true },
  // shop goods
  goodsA: { color: '#c9a24a', rough: 0.3, metal: 0.4 },
  goodsB: { color: '#6a2a52', rough: 0.4 },
  goodsC: { color: '#2a6a9a', rough: 0.4 },
  goodsD: { color: '#e8e0c8', rough: 0.6 },
  bottle: { color: '#8a5a20', rough: 0.1, metal: 0.2, opacity: 0.85 },
  bun: { color: '#d89a48', rough: 0.7 },
  cup: { color: '#f4efe6', rough: 0.5 },
  porcelain: { color: '#fafafa', rough: 0.15 },
  tileGreen: { color: '#5e8f86', rough: 0.3 },
  // concept interior plates (arrivals, claim, food court, lounge, restrooms, office, jet bridge)
  intFloor: { color: '#d8d0c4', rough: 0.35, map: () => interiorTexture('floor_terrazzo', [2, 2]), clearcoat: 0.35 },
  intRestroomFloor: { color: '#c4c2bc', rough: 0.4, map: () => interiorTexture('floor_restroom', [2, 2]), clearcoat: 0.25 },
  intCarpet: { color: '#303848', rough: 0.95, map: () => interiorTexture('floor_carpet', [2, 2]) },
  intTile: { color: '#f2f2ee', rough: 0.25, map: () => interiorTexture('wall_tile', [2, 2]), clearcoat: 0.45 },
  intWall: { color: '#e8e2d4', rough: 0.55, map: () => interiorTexture('wall_panel', [1, 1]) },
  intStall: { color: '#5c6268', rough: 0.45, metal: 0.25, map: () => interiorTexture('wall_stall', [1, 1]) },
  intCounter: { color: '#ece8e0', rough: 0.35, map: () => interiorTexture('counter_front', [1, 1]), clearcoat: 0.2 },
  intBelt: { color: '#2a2c30', rough: 0.85, map: () => interiorTexture('belt_claim', [4, 1]) },
  intOffice: { color: '#243454', rough: 0.8, map: () => interiorTexture('office_panel', [1, 1]) },
  intJet: { color: '#c6cacf', rough: 0.4, metal: 0.55, map: () => interiorTexture('jetbridge_panel', [2, 1]) },
  intWood: { color: '#8a623e', rough: 0.55, map: () => interiorTexture('lounge_wood', [1, 2]) },
  sgnGrill: { color: '#ffffff', map: () => signTex('GRILL', '#c45a28', '#fff6e8', '', 1024, 256), glow: true },
  sgnNoodle: { color: '#ffffff', map: () => signTex('NOODLES', '#1d4e4a', '#fff6e8', '', 1024, 256), glow: true },
  sgnBrew: { color: '#ffffff', map: () => signTex('BREW', '#5a3a22', '#f3e2c4', '', 1024, 256), glow: true },
  sgnGrab: { color: '#ffffff', map: () => signTex('GRAB', '#1e4a86', '#ffffff', '', 1024, 256), glow: true },
}

const LOGO_FILES = ['logo_zoomjet.jpg', 'logo_crown_pacific.jpg', 'logo_siam_breeze.jpg', 'logo_bushline_local.jpg']
function logoTex(i: number): THREE.Texture | null {
  if (!hasDom) return null
  const t = new THREE.TextureLoader().load(`/assets/pack4/${LOGO_FILES[i]}`)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()
let metalCap = 1
/**
 * Scenes without an environment map (the game world) render full-metal
 * surfaces near black. Cap metalness there; the preview page keeps PMREM.
 */
export function capTerminalPropMetal(cap: number) {
  metalCap = cap
  for (const [k, m] of matCache) m.metalness = Math.min(MATERIALS[k]?.metal ?? 0, cap)
}
export function material(key: string): THREE.MeshStandardMaterial {
  const hit = matCache.get(key)
  if (hit) return hit
  const s = MATERIALS[key] ?? MATERIALS.greyPanel
  const map = s.map?.() ?? null
  const Ctor = s.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
  const m = new Ctor({
    color: s.color,
    roughness: s.rough ?? 0.6,
    metalness: Math.min(s.metal ?? 0, metalCap),
    map,
    emissive: s.glow ? '#ffffff' : (s.emissive ?? '#000000'),
    emissiveMap: s.glow ? map : null,
    emissiveIntensity: s.glow ? 0.85 : (s.emissiveIntensity ?? 1),
    transparent: s.opacity !== undefined,
    opacity: s.opacity ?? 1,
    depthWrite: s.opacity === undefined,
    roughnessMap: s.roughMap?.() ?? null,
    envMapIntensity: s.envI ?? 1,
  })
  if (s.clearcoat && m instanceof THREE.MeshPhysicalMaterial) {
    m.clearcoat = s.clearcoat
    m.clearcoatRoughness = 0.12
  }
  attachBuildingMaterial(m)
  matCache.set(key, m)
  return m
}
