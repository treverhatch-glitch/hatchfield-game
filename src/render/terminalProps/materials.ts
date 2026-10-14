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
}

export const MATERIALS: Record<string, MatSpec> = {
  // structure and finishes
  steel: { color: '#b9bec4', rough: 0.35, metal: 0.85 },
  brushed: { color: '#d4d7da', rough: 0.25, metal: 0.95 },
  chrome: { color: '#eceff2', rough: 0.12, metal: 1 },
  darkSteel: { color: '#2b2f35', rough: 0.5, metal: 0.6 },
  black: { color: '#15171a', rough: 0.6, metal: 0.2 },
  rubber: { color: '#1c1d1f', rough: 0.9, metal: 0 },
  belt: { color: '#3a3a3a', rough: 0.8, metal: 0.1, map: () => geminiTexture('belt', [2, 1]) },
  plate: { color: '#c8ccd0', rough: 0.4, metal: 0.8, map: () => geminiTexture('plate', [2, 2]) },
  white: { color: '#f2f1ec', rough: 0.4 },
  cream: { color: '#e9e2d2', rough: 0.55 },
  greyPanel: { color: '#8d939a', rough: 0.5, metal: 0.2 },
  corian: { color: '#f6f5f1', rough: 0.2 },
  granite: { color: '#34363a', rough: 0.25, metal: 0.1 },
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
  fids: { color: '#ffffff', rough: 0.2, map: fidsTex, glow: true },
  sgnGates: { color: '#ffffff', map: () => signTex('Gates A1–A12  →', '#20252c', '#ffcf00', '✈'), glow: true },
  sgnBags: { color: '#ffffff', map: () => signTex('Baggage claim  ↓', '#20252c', '#ffcf00', '▤'), glow: true },
  sgnWC: { color: '#ffffff', map: () => signTex('Toilets   ←', '#20252c', '#ffcf00', 'WC'), glow: true },
  sgnExit: { color: '#ffffff', map: () => signTex('Exit  ·  Taxi  ·  Bus', '#1d6b3a', '#ffffff', '⇥'), glow: true },
  sgnCheckin: { color: '#ffffff', map: () => signTex('Check-in  A  1–8', '#16233b', '#ffffff'), glow: true },
  sgnSecurity: { color: '#ffffff', map: () => signTex('Security', '#16233b', '#ffffff'), glow: true },
  sgnCoffee: { color: '#ffffff', map: () => signTex('HATCH COFFEE', '#2b1a10', '#f3d7a7'), glow: true },
  sgnDuty: { color: '#ffffff', map: () => signTex('DUTY FREE', '#101010', '#e8c66a'), glow: true },
  sgnNews: { color: '#ffffff', map: () => signTex('NEWS + BOOKS', '#b0201c', '#ffffff'), glow: true },
  sgnBurger: { color: '#ffffff', map: () => signTex('RUNWAY BURGER', '#d4402c', '#ffd23f'), glow: true },
  sgnFood: { color: '#ffffff', map: () => signTex('Food court', '#20252c', '#ffcf00', '🍴'), glow: true },
  sgnMen: { color: '#ffffff', map: () => signTex('Men', '#16233b', '#ffffff', '♂', 256, 128), glow: true },
  sgnWomen: { color: '#ffffff', map: () => signTex('Women', '#16233b', '#ffffff', '♀', 256, 128), glow: true },
  sgnBelt: { color: '#ffffff', map: () => signTex('Belt 3   ZJ214 BKK', '#06122a', '#ffd34d'), glow: true },
  sgnHatch: { color: '#ffffff', map: () => signTex('HATCHFIELD INTERNATIONAL', '#ffffff', '#1f4e8c', '', 1024, 128), glow: true },
  lbCoffee: { color: '#ffffff', map: () => geminiTexture('shop_coffee'), glow: true },
  lbDuty: { color: '#ffffff', map: () => geminiTexture('shop_dutyfree'), glow: true },
  lbNews: { color: '#ffffff', map: () => geminiTexture('shop_news'), glow: true },
  lbBurger: { color: '#ffffff', map: () => geminiTexture('shop_burger'), glow: true },
  lbCheckin: { color: '#ffffff', map: () => geminiTexture('checkin'), glow: true },
  lbSecurity: { color: '#ffffff', map: () => geminiTexture('security'), glow: true },
  logo0: { color: '#ffffff', map: () => logoTex(0), glow: true },
  logo1: { color: '#ffffff', map: () => logoTex(1), glow: true },
  logo2: { color: '#ffffff', map: () => logoTex(2), glow: true },
  logo3: { color: '#ffffff', map: () => logoTex(3), glow: true },
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
}

const LOGO_FILES = ['logo_zoomjet.jpg', 'logo_crown_pacific.jpg', 'logo_siam_breeze.jpg', 'logo_bushline_local.jpg']
function logoTex(i: number): THREE.Texture | null {
  if (!hasDom) return null
  const t = new THREE.TextureLoader().load(`/assets/pack4/${LOGO_FILES[i]}`)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function material(key: string): THREE.MeshStandardMaterial {
  const hit = matCache.get(key)
  if (hit) return hit
  const s = MATERIALS[key] ?? MATERIALS.greyPanel
  const map = s.map?.() ?? null
  const m = new THREE.MeshStandardMaterial({
    color: s.color,
    roughness: s.rough ?? 0.6,
    metalness: s.metal ?? 0,
    map,
    emissive: s.glow ? '#ffffff' : (s.emissive ?? '#000000'),
    emissiveMap: s.glow ? map : null,
    emissiveIntensity: s.glow ? 0.85 : (s.emissiveIntensity ?? 1),
    transparent: s.opacity !== undefined,
    opacity: s.opacity ?? 1,
    depthWrite: s.opacity === undefined,
  })
  matCache.set(key, m)
  return m
}
