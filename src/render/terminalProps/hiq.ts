/**
 * High-quality procedural surfaces for the terminal (desktop tier, RTX 4070
 * baseline). Everything is drawn on canvas at load, so the repo stays text
 * only: large-format porcelain floor with grout and tone variation, gate
 * carpet, timber slat ceiling, corrugated jet-bridge skin, brushed metal
 * roughness, ceramic wall tile and a 2K departures board. Outside the
 * browser every function returns null and materials fall back to colour.
 */
import * as THREE from 'three'
import { canvasTexture } from './materials'

const cache = new Map<string, THREE.Texture | null>()
function memo(key: string, make: () => THREE.Texture | null, repeat?: [number, number]): THREE.Texture | null {
  const k = repeat ? `${key}@${repeat.join('x')}` : key
  if (cache.has(k)) return cache.get(k)!
  let t = make()
  if (t && repeat) {
    t = t.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  cache.set(k, t)
  return t
}
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
function linear(t: THREE.Texture | null) {
  if (t) t.colorSpace = THREE.NoColorSpace
  return t
}
function wrap(t: THREE.Texture | null) {
  if (t) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** 1.2 m porcelain tiles, 4x4 per texture (4.8 m), 2048 px. */
export function floorTile(kind: 'color' | 'rough', repeat: [number, number]) {
  return memo(`floor-${kind}`, () => {
    const t = canvasTexture(2048, 2048, (g) => {
      const r = rng(7)
      const n = 4, s = 2048 / n
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = r()
          if (kind === 'color') {
            const l = 86 + v * 5
            g.fillStyle = `hsl(36, 9%, ${l}%)`
          } else g.fillStyle = `rgb(${50 + v * 40},${50 + v * 40},${50 + v * 40})`
          g.fillRect(i * s, j * s, s, s)
          // speckle / veining
          for (let k = 0; k < 900; k++) {
            const a = r()
            g.fillStyle = kind === 'color' ? `rgba(${90 + a * 80},${85 + a * 70},${80 + a * 60},${0.08 + a * 0.12})` : `rgba(255,255,255,${a * 0.08})`
            g.fillRect(i * s + r() * s, j * s + r() * s, 1 + a * 4, 1 + a * 4)
          }
          if (kind === 'color') {
            g.strokeStyle = 'rgba(150,140,128,0.18)'
            g.lineWidth = 1.5
            g.beginPath()
            let x = i * s + r() * s, y = j * s
            g.moveTo(x, y)
            for (let k = 0; k < 8; k++) g.lineTo((x += (r() - 0.5) * 60), (y += s / 8))
            g.stroke()
          }
        }
      // grout
      g.fillStyle = kind === 'color' ? '#9a948a' : '#e0e0e0'
      for (let i = 0; i <= n; i++) {
        g.fillRect(i * s - 3, 0, 6, 2048)
        g.fillRect(0, i * s - 3, 2048, 6)
      }
    })
    return kind === 'rough' ? linear(wrap(t)) : wrap(t)
  }, repeat)
}

/** Patterned gate carpet: navy with teal flecks and a woven stripe. */
export function carpet(repeat: [number, number]) {
  return memo('carpet', () => wrap(canvasTexture(1024, 1024, (g) => {
    const r = rng(11)
    g.fillStyle = '#26324a'
    g.fillRect(0, 0, 1024, 1024)
    for (let k = 0; k < 26000; k++) {
      const a = r()
      g.fillStyle = a > 0.97 ? '#3fa3a0' : a > 0.9 ? '#33405e' : '#1c2639'
      g.fillRect(r() * 1024, r() * 1024, 2, 2)
    }
    g.fillStyle = 'rgba(80,150,170,0.35)'
    for (let y = 0; y < 1024; y += 256) g.fillRect(0, y + 120, 1024, 10)
  })), repeat)
}

/** Timber slat soffit, 20 slats per texture. */
export function slats(kind: 'color' | 'rough', repeat: [number, number]) {
  return memo(`slats-${kind}`, () => {
    const t = canvasTexture(1024, 256, (g) => {
      const r = rng(3)
      g.fillStyle = kind === 'color' ? '#2a2018' : '#ffffff'
      g.fillRect(0, 0, 1024, 256)
      const p = 1024 / 20
      for (let i = 0; i < 20; i++) {
        const v = r()
        g.fillStyle = kind === 'color' ? `hsl(30, ${38 + v * 10}%, ${52 + v * 10}%)` : `rgb(${130 + v * 40},${130 + v * 40},${130 + v * 40})`
        g.fillRect(i * p + 4, 0, p - 8, 256)
        if (kind === 'color')
          for (let k = 0; k < 40; k++) {
            g.fillStyle = `rgba(90,55,30,${r() * 0.18})`
            g.fillRect(i * p + 4 + r() * (p - 8), 0, 1, 256)
          }
      }
    })
    return kind === 'rough' ? linear(wrap(t)) : wrap(t)
  }, repeat)
}

/** Corrugated stainless jet-bridge skin (bump-ish via colour + roughness). */
export function corrugated(repeat: [number, number]) {
  return memo('corr', () => wrap(canvasTexture(512, 512, (g) => {
    for (let x = 0; x < 512; x++) {
      const v = 175 + Math.sin((x / 512) * Math.PI * 32) * 40
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`
      g.fillRect(x, 0, 1, 512)
    }
  })), repeat)
}

/** Brushed-metal roughness streaks. */
export function brushedRough() {
  return memo('brushed', () => linear(wrap(canvasTexture(512, 512, (g) => {
    const r = rng(5)
    g.fillStyle = '#5a5a5a'
    g.fillRect(0, 0, 512, 512)
    for (let k = 0; k < 4000; k++) {
      const v = 60 + r() * 90
      g.fillStyle = `rgba(${v},${v},${v},0.35)`
      g.fillRect(r() * 512, r() * 512, 40 + r() * 160, 1)
    }
  }))))
}

/** 10 cm ceramic wall tile (restrooms). */
export function wallTile(color: string, repeat: [number, number]) {
  return memo(`tile-${color}`, () => wrap(canvasTexture(512, 512, (g) => {
    const r = rng(9)
    const n = 8, s = 512 / n
    g.fillStyle = '#d8d6d0'
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = color
        g.globalAlpha = 0.86 + r() * 0.14
        g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4)
      }
    g.globalAlpha = 1
  })), repeat)
}

/** Frit-dot glass spandrel / sunshade pattern. */
export function frit() {
  return memo('frit', () => wrap(canvasTexture(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(255,255,255,0.9)'
    for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
      const rr = 2 + (y / 256) * 5
      g.beginPath(); g.arc(x + 8, y + 8, rr, 0, Math.PI * 2); g.fill()
    }
  })))
}

/** Gate number / big lit sign. */
export function bigSign(text: string, bg: string, fg: string, w = 1024, h = 256) {
  return memo(`big-${text}`, () => canvasTexture(w, h, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let fs = h * 0.62
    g.font = `800 ${fs}px Helvetica, Arial, sans-serif`
    const mw = g.measureText(text).width
    if (mw > w * 0.9) fs *= (w * 0.9) / mw
    g.font = `800 ${fs}px Helvetica, Arial, sans-serif`
    g.fillText(text, w / 2, h * 0.54)
  }))
}

const FL = [
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
  ['10:45', 'CP 233', 'SEOUL ICN', 'B06', 'ON TIME', '#ffffff'],
  ['11:00', 'NS 118', 'DUBAI', 'B01', 'CHECK-IN', '#8fd3ff'],
  ['11:20', 'ZJ 590', 'LONDON LHR', 'B12', 'ON TIME', '#ffffff'],
  ['11:35', 'SB 402', 'DELHI', 'A09', 'ON TIME', '#ffffff'],
]
/** 2K split-flap style FIDS with airline colour chips. */
export function fids2k(title = 'DEPARTURES', accent = '#ffcf00') {
  return memo(`fids2k-${title}`, () => canvasTexture(2048, 1280, (g) => {
    g.fillStyle = '#050d1f'
    g.fillRect(0, 0, 2048, 1280)
    g.fillStyle = accent
    g.fillRect(0, 0, 2048, 120)
    g.fillStyle = '#050d1f'
    g.font = 'bold 80px Helvetica, Arial, sans-serif'
    g.textBaseline = 'middle'
    g.fillText(`✈  ${title}`, 40, 64)
    g.textAlign = 'right'
    g.fillText('08:02', 2008, 64)
    g.textAlign = 'left'
    g.font = 'bold 36px Helvetica, Arial'
    g.fillStyle = '#8ea6d1'
    ;['TIME', 'FLIGHT', 'DESTINATION', 'GATE', 'REMARKS'].forEach((t, i) => g.fillText(t, [40, 270, 600, 1260, 1460][i], 160))
    const air: Record<string, string> = { ZJ: '#e5791f', CP: '#1f4e8c', SB: '#2b8a8a', BL: '#3d7d3a', NS: '#c8322b' }
    FL.forEach((f, r) => {
      const y = 230 + r * 75
      g.fillStyle = r % 2 ? '#0a1834' : '#071228'
      g.fillRect(0, y - 36, 2048, 72)
      // split-flap cells
      g.fillStyle = 'rgba(255,255,255,0.03)'
      for (let x = 30; x < 2040; x += 36) g.fillRect(x, y - 30, 32, 60)
      g.fillStyle = air[f[1].slice(0, 2)] ?? '#888'
      g.fillRect(240, y - 24, 16, 48)
      g.font = 'bold 50px Courier New, monospace'
      g.fillStyle = '#ffd34d'
      ;[f[0], f[1], f[2], f[3]].forEach((t, i) => g.fillText(t, [40, 270, 600, 1260][i], y + 2))
      g.fillStyle = f[5]
      g.fillText(f[4], 1460, y + 2)
      g.fillStyle = 'rgba(0,0,0,0.5)'
      g.fillRect(0, y, 2048, 2)
    })
  }))
}
