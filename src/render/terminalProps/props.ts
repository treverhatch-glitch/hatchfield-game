/**
 * Detailed terminal prop models. Every builder returns parts in metres with
 * the origin at the floor centre and the passenger-facing side toward +Z.
 * Dimensions follow real kit: 1.0 m check-in desks, 0.9 m x-ray tunnels,
 * 0.76 m bench seats, 2.1 m arches, 0.75 m tables.
 */
import { box, cyl, part, place, type Part } from './parts'

const H = Math.PI / 2

// ---------- small reusable bits ----------
function suitcase(mat: string, w = 0.42, h = 0.62, d = 0.26): Part[] {
  return [
    box([w, h, d], [0, h / 2 + 0.04, 0], mat),
    box([w * 0.94, 0.03, d + 0.02], [0, h * 0.55, 0], 'black'),
    box([0.04, 0.12, 0.04], [-w * 0.18, h + 0.1, 0], 'black'),
    box([0.04, 0.12, 0.04], [w * 0.18, h + 0.1, 0], 'black'),
    box([w * 0.42, 0.03, 0.04], [0, h + 0.16, 0], 'black'),
    cyl([0.05, 0.04, 0.05], [-w * 0.4, 0.02, d * 0.35], 'rubber', [H, 0, 0]),
    cyl([0.05, 0.04, 0.05], [w * 0.4, 0.02, d * 0.35], 'rubber', [H, 0, 0]),
  ]
}
/** Lying-down bag (on belts and carousels). */
function bagFlat(mat: string, l = 0.66, w = 0.44): Part[] {
  return [box([l, 0.24, w], [0, 0.12, 0], mat), box([0.2, 0.04, 0.03], [0, 0.26, 0], 'black'), box([l + 0.01, 0.03, w + 0.01], [0, 0.14, 0], 'black')]
}
function stanchionPost(): Part[] {
  return [
    cyl([0.36, 0.03, 0.36], [0, 0.015, 0], 'chrome'),
    cyl([0.06, 0.95, 0.06], [0, 0.5, 0], 'chrome'),
    cyl([0.08, 0.06, 0.08], [0, 0.98, 0], 'chrome'),
  ]
}
/** Retractable belt between two posts at (x0,z0) and (x1,z1). */
function strap(x0: number, z0: number, x1: number, z1: number): Part {
  const dx = x1 - x0, dz = z1 - z0
  const len = Math.hypot(dx, dz)
  return box([len, 0.05, 0.01], [(x0 + x1) / 2, 0.93, (z0 + z1) / 2], 'hatchBlue', [0, -Math.atan2(dz, dx), 0])
}
function monitor(w = 0.5, h = 0.32): Part[] {
  return [
    box([w, h, 0.03], [0, 0, 0], 'black'),
    box([w * 0.92, h * 0.86, 0.005], [0, 0, 0.017], 'screen'),
  ]
}
function chair(seat = 'oak', frame = 'darkSteel'): Part[] {
  return [
    box([0.44, 0.04, 0.42], [0, 0.46, 0], seat),
    box([0.44, 0.38, 0.03], [0, 0.68, -0.2], seat, [-0.12, 0, 0]),
    ...[-0.19, 0.19].flatMap((x) => [-0.17, 0.17].map((z) => cyl([0.025, 0.45, 0.025], [x, 0.225, z], frame))),
  ]
}
function plant(scale = 1, pot = 'darkSteel'): Part[] {
  const s = scale
  return [
    cyl([0.55 * s, 0.6 * s, 0.55 * s], [0, 0.3 * s, 0], pot),
    cyl([0.5 * s, 0.02, 0.5 * s], [0, 0.6 * s, 0], 'soil'),
    cyl([0.07 * s, 0.9 * s, 0.07 * s], [0, 1.0 * s, 0], 'walnut'),
    part('sphere', [0.7 * s, 0.6 * s, 0.7 * s], [0, 1.55 * s, 0], 'leaf'),
    part('sphere', [0.5 * s, 0.45 * s, 0.5 * s], [0.22 * s, 1.35 * s, 0.1 * s], 'leafDark'),
    part('sphere', [0.5 * s, 0.45 * s, 0.5 * s], [-0.2 * s, 1.4 * s, -0.12 * s], 'leafDark'),
    part('sphere', [0.45 * s, 0.4 * s, 0.45 * s], [0.02 * s, 1.85 * s, 0.05 * s], 'leaf'),
  ]
}

// ---------- check-in ----------
function checkinDesk(i: number): Part[] {
  const logo = `logo${i % 4}`
  return [
    // counter body + granite top + bag-drop step
    box([1.6, 1.05, 0.7], [0, 0.525, -0.2], 'corian'),
    box([1.64, 0.04, 0.78], [0, 1.07, -0.2], 'granite'),
    box([1.5, 0.12, 0.02], [0, 0.85, 0.16], 'hatchBlue'),
    box([0.25, 0.16, 0.03], [-0.4, 0.95, 0.17], 'screen'),
    // agent monitor, printer, keyboard
    ...place(monitor(0.48, 0.3), -0.35, -0.38, Math.PI, 1.3),
    box([0.3, 0.12, 0.25], [0.25, 1.15, -0.4], 'black'),
    box([0.42, 0.02, 0.14], [-0.35, 1.1, -0.3], 'black'),
    // weigh scale + bag belt feeding to the back belt
    box([0.9, 0.32, 0.8], [1.25, 0.16, -0.15], 'steel'),
    box([0.86, 0.04, 0.76], [1.25, 0.34, -0.15], 'belt'),
    box([0.24, 0.12, 0.04], [1.25, 0.6, 0.25], 'screenGreen'),
    cyl([0.04, 0.3, 0.04], [1.25, 0.45, 0.25], 'chrome'),
    box([0.9, 0.36, 0.02], [1.25, 0.18, 0.26], 'plate'),
    // agent stool
    cyl([0.4, 0.06, 0.4], [0, 0.65, -0.95], 'black'),
    cyl([0.06, 0.6, 0.06], [0, 0.32, -0.95], 'chrome'),
    cyl([0.5, 0.04, 0.5], [0, 0.02, -0.95], 'darkSteel'),
    // overhead desk number + airline screen on logo wall
    box([1.2, 0.68, 0.04], [0.3, 2.4, -1.66], 'black'),
    box([1.12, 0.6, 0.01], [0.3, 2.4, -1.635], logo),
    box([0.34, 0.2, 0.05], [-0.55, 2.4, -1.64], 'signDark'),
    box([0.28, 0.12, 0.01], [-0.55, 2.4, -1.61], 'amber'),
  ]
}
function checkinRow(n = 4): Part[] {
  const pitch = 2.3
  const len = n * pitch + 0.6
  const out: Part[] = []
  for (let i = 0; i < n; i++) out.push(...place(checkinDesk(i), (i - (n - 1) / 2) * pitch, 0))
  // collector belt behind the desks
  out.push(box([len, 0.42, 0.9], [0.4, 0.21, -1.15], 'steel'))
  out.push(box([len, 0.04, 0.8], [0.4, 0.44, -1.15], 'belt'))
  out.push(box([len, 0.12, 0.04], [0.4, 0.5, -0.72], 'brushed'))
  out.push(box([len, 0.12, 0.04], [0.4, 0.5, -1.58], 'brushed'))
  // bags riding the collector
  const bags = ['bagBlack', 'bagRed', 'bagTeal', 'bagSilver']
  for (let i = 0; i < n + 1; i++) out.push(...place(bagFlat(bags[i % 4], 0.6, 0.4), (i - n / 2) * pitch * 0.9 + 0.6, -1.15, 0.2 * (i % 2), 0.44))
  // logo wall: framed back panel, airline lightbox, overhead FIDS-style strip
  out.push(box([len + 0.4, 3.2, 0.25], [0.4, 1.6, -1.8], 'cream'))
  out.push(box([len + 0.5, 0.25, 0.35], [0.4, 3.3, -1.75], 'hatchBlue'))
  out.push(box([len * 0.55, 0.5, 0.03], [0.4, 3.0, -1.61], 'sgnCheckin'))
  out.push(box([len + 0.4, 0.06, 0.06], [0.4, 3.0 - 0.3, -1.6], 'lamp'))
  // strip curtain opening where the belt exits
  out.push(box([0.9, 0.6, 0.3], [len / 2 + 0.55, 0.75, -1.15], 'darkSteel'))
  out.push(box([0.8, 0.5, 0.02], [len / 2 + 0.5, 0.7, -1.0], 'rubber'))
  // serpentine queue in front
  out.push(...queue(len - 1.2, 3, 1.1, 2.6))
  return out
}

/** Stanchion serpentine; w = lane length, lanes deep, posts at pitch. */
function queue(w: number, lanes: number, gap: number, z0: number): Part[] {
  const out: Part[] = []
  const nx = Math.max(2, Math.round(w / 1.8) + 1)
  const pitch = w / (nx - 1)
  for (let l = 0; l <= lanes; l++) {
    const z = z0 + l * gap
    for (let i = 0; i < nx; i++) {
      const x = -w / 2 + i * pitch
      out.push(...place(stanchionPost(), x, z))
      if (i > 0) {
        // leave alternate end gaps to make a snake
        const open = (l % 2 === 0 && i === nx - 1) || (l % 2 === 1 && i === 1)
        if (!open || l === 0 || l === lanes) out.push(strap(x - pitch, z, x, z))
      }
    }
  }
  return out
}

// ---------- security ----------
function xray(): Part[] {
  const out: Part[] = [
    // in-feed roller bed
    box([1.8, 0.08, 0.7], [-2.1, 0.75, 0], 'steel'),
    ...Array.from({ length: 12 }, (_, i) => cyl([0.05, 0.66, 0.05], [-2.9 + i * 0.145, 0.8, 0], 'chrome', [H, 0, 0])),
    box([1.8, 0.7, 0.05], [-2.1, 0.4, 0.33], 'greyPanel'),
    box([1.8, 0.7, 0.05], [-2.1, 0.4, -0.33], 'greyPanel'),
    // tunnel housing
    box([2.2, 1.45, 1.1], [0, 0.73, 0], 'white'),
    box([2.25, 0.08, 1.15], [0, 1.48, 0], 'hatchBlue'),
    box([0.85, 0.6, 0.02], [-1.11, 0.98, 0], 'rubber', [0, H, 0]),
    box([0.85, 0.6, 0.02], [1.11, 0.98, 0], 'rubber', [0, H, 0]),
    box([2.15, 0.04, 0.7], [0, 0.72, 0], 'belt'),
    box([0.5, 0.06, 0.06], [0.6, 1.55, 0.35], 'screenRed'),
    box([0.5, 0.06, 0.06], [-0.6, 1.55, 0.35], 'screenGreen'),
    box([1.4, 0.3, 0.02], [0, 1.2, 0.56], 'greyPanel'),
    box([0.6, 0.08, 0.02], [0, 1.2, 0.575], 'signYellow'),
    // out-feed + exit rollers
    box([2.4, 0.08, 0.7], [2.4, 0.75, 0], 'steel'),
    ...Array.from({ length: 16 }, (_, i) => cyl([0.05, 0.66, 0.05], [1.3 + i * 0.145, 0.8, 0], 'chrome', [H, 0, 0])),
    box([2.4, 0.7, 0.05], [2.4, 0.4, 0.33], 'greyPanel'),
    // operator desk with two monitors
    box([1.1, 0.75, 0.6], [0.2, 0.38, -1.1], 'greyPanel'),
    box([1.14, 0.03, 0.64], [0.2, 0.77, -1.1], 'granite'),
    ...place(monitor(0.5, 0.32), 0, -1.2, 0, 1.05),
    ...place(monitor(0.5, 0.32), 0.52, -1.2, 0, 1.05),
    ...place(chair('black'), 0.2, -1.65),
  ]
  // trays riding through
  for (const [x, m] of [[-2.4, 'bagBlack'], [-1.6, 'bagSilver'], [1.8, 'bagTeal'], [2.8, 'bagRed']] as const) {
    out.push(box([0.55, 0.1, 0.4], [x, 0.85, 0], 'tray'))
    out.push(box([0.4, 0.14, 0.26], [x, 0.95, 0], m))
  }
  return out
}
function archDetector(): Part[] {
  return [
    box([0.14, 2.1, 0.6], [-0.48, 1.05, 0], 'greyPanel'),
    box([0.14, 2.1, 0.6], [0.48, 1.05, 0], 'greyPanel'),
    box([1.1, 0.2, 0.62], [0, 2.18, 0], 'white'),
    box([0.03, 1.7, 0.02], [-0.41, 1.0, 0.25], 'lampCool'),
    box([0.03, 1.7, 0.02], [0.41, 1.0, 0.25], 'lampCool'),
    box([0.14, 0.05, 0.12], [-0.48, 2.3, 0.2], 'screenGreen'),
    box([0.14, 0.05, 0.12], [0.48, 2.3, 0.2], 'screenRed'),
    box([0.6, 0.04, 0.02], [0, 2.18, 0.32], 'signDark'),
    box([1.4, 0.01, 1.4], [0, 0.005, 0], 'rubber'),
    ...place([box([0.35, 0.02, 0.55], [0, 0.01, 0], 'signYellow')], 0, 1.0),
  ]
}
function securityLane(): Part[] {
  const out: Part[] = [...place(xray(), 0, 0)]
  // divesting tables (rear) with tray stacks
  for (const x of [-4.2, -5.3]) {
    out.push(box([1.0, 0.82, 0.7], [x, 0.41, 0], 'corian'), box([1.04, 0.03, 0.74], [x, 0.84, 0], 'brushed'))
    for (let k = 0; k < 6; k++) out.push(box([0.55, 0.06, 0.4], [x, 0.89 + k * 0.065, 0], 'tray'))
  }
  // walk-through arch beside the tunnel; body scanner pad
  out.push(...place(archDetector(), -0.6, 1.6))
  out.push(box([1.0, 0.4, 0.04], [-0.6, 2.6, 1.6], 'lbSecurity'))
  // reclaim (composure) table + tray return conveyor underneath back to start
  out.push(box([2.4, 0.82, 0.8], [4.6, 0.41, 0.05], 'corian'), box([2.44, 0.03, 0.84], [4.6, 0.84, 0.05], 'brushed'))
  out.push(box([8.8, 0.3, 0.5], [0, 0.17, -0.7], 'darkSteel'))
  out.push(box([8.8, 0.03, 0.44], [0, 0.33, -0.7], 'belt'))
  for (const x of [-3, -1, 1.2, 3.4]) out.push(box([0.55, 0.06, 0.4], [x, 0.37, -0.7], 'tray'))
  // lane number pylon + glass divider screens
  out.push(box([0.3, 2.4, 0.3], [-6.1, 1.2, 1.0], 'hatchBlue'))
  out.push(box([0.32, 0.4, 0.02], [-6.1, 2.1, 1.16], 'screenGreen'))
  for (const z of [-2.0, 2.6]) {
    out.push(box([12.6, 1.1, 0.03], [-0.4, 0.65, z], 'glass'))
    out.push(box([12.6, 0.05, 0.06], [-0.4, 1.22, z], 'chrome'))
    for (let x = -6.6; x <= 5.8; x += 2.1) out.push(cyl([0.05, 1.2, 0.05], [x, 0.6, z], 'chrome'))
  }
  out.push(...place(stanchionPost(), -6.4, 2.2), ...place(stanchionPost(), -6.4, 0.9))
  return out
}

// ---------- shops ----------
type ShopKind = 'coffee' | 'dutyfree' | 'news' | 'fastfood'
const SHOP: Record<ShopKind, { sign: string; lb: string; accent: string; floor: string }> = {
  coffee: { sign: 'sgnCoffee', lb: 'lbCoffee', accent: 'walnut', floor: 'oak' },
  dutyfree: { sign: 'sgnDuty', lb: 'lbDuty', accent: 'black', floor: 'granite' },
  news: { sign: 'sgnNews', lb: 'lbNews', accent: 'red', floor: 'greyPanel' },
  fastfood: { sign: 'sgnBurger', lb: 'lbBurger', accent: 'red', floor: 'cream' },
}
function shopShell(kind: ShopKind, w = 8, d = 6, h = 4): Part[] {
  const s = SHOP[kind]
  const out: Part[] = [
    box([w, 0.02, d], [0, 0.01, -d / 2], s.floor),
    box([w, h, 0.2], [0, h / 2, -d], 'cream'),
    box([0.25, h, d], [-w / 2, h / 2, -d / 2], 'cream'),
    box([0.25, h, d], [w / 2, h / 2, -d / 2], 'cream'),
    // fascia + illuminated sign + lightbox posters
    box([w + 0.3, 0.9, 0.35], [0, h - 0.45, 0.05], s.accent),
    box([w * 0.62, 0.6, 0.04], [0, h - 0.45, 0.24], s.sign),
    box([1.4, 2.0, 0.08], [-w / 2 + 0.95, 1.35, 0.05], s.lb),
    // shopfront glazing with mullions + open doorway in centre
    box([w / 2 - 2.2, 2.6, 0.04], [-w / 4 - 0.1 + 0.55, 1.4, 0.02], 'glass'),
    box([w / 2 - 2.2, 2.6, 0.04], [w / 4 + 0.1 - 0.55, 1.4, 0.02], 'glass'),
    box([w, 0.08, 0.1], [0, 2.75, 0.02], 'darkSteel'),
    box([w, 0.08, 0.1], [0, 0.04, 0.02], 'darkSteel'),
  ]
  for (const x of [-w / 2 + 1.7, -1.2, 1.2, w / 2 - 0.15]) out.push(box([0.08, 2.75, 0.1], [x, 1.38, 0.02], 'darkSteel'))
  // downlights
  for (let x = -w / 2 + 1.2; x < w / 2; x += 2) for (const z of [-1.5, -4]) out.push(cyl([0.22, 0.03, 0.22], [x, h - 0.06, z], 'lamp'))
  return out
}
function shelfUnit(goods: string[], w = 1.8): Part[] {
  const out: Part[] = [box([w, 2.1, 0.45], [0, 1.05, -0.05], 'white')]
  for (let k = 0; k < 5; k++) {
    const y = 0.3 + k * 0.42
    out.push(box([w - 0.06, 0.03, 0.42], [0, y, 0.02], 'brushed'))
    for (let i = 0; i < 6; i++) out.push(box([0.2, 0.28, 0.22], [-w / 2 + 0.2 + i * ((w - 0.3) / 5), y + 0.16, 0.05], goods[(i + k) % goods.length]))
  }
  return out
}
function counterUnit(len: number, top = 'granite', face = 'walnut'): Part[] {
  return [
    box([len, 1.0, 0.7], [0, 0.5, 0], face),
    box([len + 0.06, 0.05, 0.76], [0, 1.03, 0], top),
    box([len, 0.1, 0.02], [0, 0.08, 0.36], 'black'),
    box([len - 0.2, 0.03, 0.03], [0, 0.85, 0.37], 'amber'),
  ]
}
function shop(kind: ShopKind): Part[] {
  const out = shopShell(kind)
  if (kind === 'coffee') {
    out.push(...place(counterUnit(4.2, 'granite', 'walnut'), 0.6, -3.2))
    out.push(box([0.7, 0.5, 0.55], [0.9, 1.3, -3.25], 'chrome'), box([0.5, 0.25, 0.04], [0.9, 1.35, -2.96], 'black'))
    out.push(box([1.4, 0.45, 0.5], [2.1, 1.28, -3.2], 'glass'), box([1.3, 0.12, 0.4], [2.1, 1.12, -3.2], 'bun'))
    for (let i = 0; i < 5; i++) out.push(cyl([0.09, 0.12, 0.09], [-0.9 + i * 0.12, 1.12, -3.0], 'cup'))
    out.push(box([3.5, 0.9, 0.05], [0.5, 2.6, -5.85], 'black'), box([3.3, 0.75, 0.02], [0.5, 2.6, -5.82], 'lbCoffee'))
    out.push(box([3.6, 0.04, 0.35], [0.5, 1.7, -5.75], 'oak'), box([3.6, 0.04, 0.35], [0.5, 2.0, -5.75], 'oak'))
    for (const [x, z] of [[-2.6, -1.4], [-2.6, -4.6]]) {
      out.push(cyl([0.7, 0.04, 0.7], [x, 0.74, z], 'oak'), cyl([0.08, 0.72, 0.08], [x, 0.36, z], 'darkSteel'))
      out.push(...place(chair('leather'), x - 0.55, z, H), ...place(chair('leather'), x + 0.55, z, -H))
    }
    for (const x of [-0.8, 1.8]) out.push(cyl([0.18, 0.4, 0.18], [x, 3.3, -3.0], 'amber'), cyl([0.01, 0.6, 0.01], [x, 3.75, -3.0], 'black'))
  } else if (kind === 'dutyfree') {
    out.push(...place(shelfUnit(['bottle', 'goodsA', 'goodsB']), -2.7, -5.6), ...place(shelfUnit(['goodsB', 'goodsD', 'goodsA']), -0.8, -5.6))
    out.push(...place(shelfUnit(['bottle', 'goodsC', 'bottle']), 1.1, -5.6), ...place(shelfUnit(['goodsA', 'goodsD', 'goodsC']), 3.0, -5.6))
    for (const x of [-1.8, 1.8]) {
      out.push(box([1.6, 0.9, 0.9], [x, 0.45, -2.8], 'black'), box([1.5, 0.35, 0.8], [x, 1.08, -2.8], 'glass'))
      for (let i = 0; i < 4; i++) out.push(box([0.18, 0.24, 0.12], [x - 0.5 + i * 0.33, 1.02, -2.8], i % 2 ? 'goodsA' : 'goodsB'))
    }
    out.push(...place(counterUnit(2, 'granite', 'black'), -3, -1.4, H))
    out.push(box([0.6, 1.7, 0.1], [0, 0.85, -1.2], 'lbDuty'))
  } else if (kind === 'news') {
    out.push(...place(shelfUnit(['goodsC', 'red', 'goodsD', 'signYellow']), -2.6, -5.6), ...place(shelfUnit(['goodsD', 'goodsC', 'hatchBlue']), -0.7, -5.6))
    out.push(...place(shelfUnit(['red', 'goodsD', 'goodsC']), 1.2, -5.6))
    // magazine wall: angled racks
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) out.push(box([0.22, 0.3, 0.02], [-3.6, 0.6 + k * 0.42, -4.4 + i * 0.3], ['red', 'goodsC', 'signYellow', 'goodsD'][(i + k) % 4], [0, H, -0.25]))
    // drinks fridge
    out.push(box([1.4, 2.0, 0.7], [3.1, 1.0, -5.4], 'darkSteel'), box([1.3, 1.8, 0.02], [3.1, 1.05, -5.04], 'glass'))
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) out.push(cyl([0.07, 0.22, 0.07], [2.6 + i * 0.2, 0.4 + k * 0.45, -5.2], i % 2 ? 'bagTeal' : 'red'))
    out.push(box([1.4, 0.04, 0.6], [3.1, 2.05, -5.4], 'lampCool'))
    out.push(...place(counterUnit(1.8, 'corian', 'red'), 2.4, -1.6))
    out.push(box([0.4, 0.3, 0.3], [2.4, 1.2, -1.6], 'black'))
  } else {
    out.push(...place(counterUnit(5.6, 'brushed', 'red'), 0, -2.6))
    for (let i = 0; i < 3; i++) out.push(...place(monitor(0.3, 0.22), -1.8 + i * 1.8, -2.45, 0, 1.2))
    // kitchen line behind
    out.push(box([6.6, 0.95, 0.8], [0, 0.48, -5.3], 'brushed'), box([6.6, 0.6, 0.6], [0, 2.6, -5.4], 'steel'))
    for (let i = 0; i < 3; i++) out.push(box([0.9, 0.3, 0.6], [-2 + i * 2, 1.15, -5.3], 'darkSteel'))
    out.push(box([5.4, 0.9, 0.05], [0, 3.0, -5.85], 'black'))
    for (let i = 0; i < 4; i++) out.push(box([1.25, 0.75, 0.02], [-1.95 + i * 1.3, 3.0, -5.82], i % 2 ? 'lbBurger' : 'screen'))
    for (let i = 0; i < 4; i++) out.push(part('sphere', [0.14, 0.08, 0.14], [-1 + i * 0.3, 1.1, -2.5], 'bun'))
    out.push(box([0.6, 1.8, 0.4], [3.4, 0.9, -1.0], 'signYellow'), box([0.5, 0.5, 0.02], [3.4, 1.3, -0.79], 'screen'))
  }
  return out
}

// ---------- food court ----------
function cafeTable(seats = 4): Part[] {
  const out: Part[] = [
    box([0.9, 0.04, 0.9], [0, 0.75, 0], 'corian'),
    cyl([0.08, 0.72, 0.08], [0, 0.37, 0], 'darkSteel'),
    cyl([0.5, 0.03, 0.5], [0, 0.015, 0], 'darkSteel'),
    cyl([0.2, 0.08, 0.2], [0.15, 0.81, 0.1], 'red'),
    cyl([0.08, 0.13, 0.08], [-0.2, 0.83, -0.1], 'cup'),
    box([0.35, 0.02, 0.26], [0.1, 0.78, -0.18], 'tray'),
  ]
  const yaws = seats === 2 ? [0, Math.PI] : [0, H, Math.PI, -H]
  for (const y of yaws) out.push(...place(chair('oak'), Math.sin(y) * 0.62, Math.cos(y) * 0.62, y + Math.PI))
  return out
}
function foodCourt(): Part[] {
  const out: Part[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push(...place(cafeTable(r === 1 ? 2 : 4), (c - 1.5) * 2.4, (r - 1) * 2.4))
  // long communal bench along the back with high table
  out.push(box([8.4, 1.05, 0.7], [0, 0.525, -4.0], 'oak'), box([8.6, 0.05, 0.8], [0, 1.07, -4.0], 'walnut'))
  for (let i = 0; i < 9; i++) out.push(cyl([0.38, 0.05, 0.38], [-3.8 + i * 0.95, 0.75, -3.35], 'leather'), cyl([0.05, 0.72, 0.05], [-3.8 + i * 0.95, 0.37, -3.35], 'chrome'))
  for (const x of [-4.6, 4.6]) out.push(...place(plant(1.1, 'walnut'), x, 3.2))
  out.push(...place(binUnit(), 4.6, -2.6, -H))
  out.push(box([3, 0.5, 0.06], [0, 3.6, -4.4], 'sgnFood'))
  for (let x = -3.6; x <= 3.6; x += 2.4) out.push(cyl([0.5, 0.6, 0.5], [x, 3.1, 0], 'amber'), cyl([0.01, 1.3, 0.01], [x, 4.0, 0], 'black'))
  return out
}

// ---------- gates ----------
function seatBeam(n = 5, upholstery = 'seatBlue'): Part[] {
  const pitch = 0.62
  const len = n * pitch
  const out: Part[] = [box([len + 0.1, 0.08, 0.1], [0, 0.32, 0], 'brushed')]
  for (const x of [-len / 2 + 0.25, len / 2 - 0.25]) {
    out.push(box([0.08, 0.32, 0.08], [x, 0.16, 0], 'brushed'), box([0.08, 0.04, 0.6], [x, 0.02, 0], 'brushed'))
  }
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch
    out.push(
      box([0.54, 0.06, 0.5], [x, 0.43, 0.04], 'darkSteel'),
      box([0.5, 0.06, 0.46], [x, 0.48, 0.05], upholstery),
      box([0.54, 0.5, 0.05], [x, 0.76, -0.24], 'darkSteel', [-0.15, 0, 0]),
      box([0.5, 0.44, 0.05], [x, 0.77, -0.2], upholstery, [-0.15, 0, 0]),
    )
  }
  for (let i = 0; i <= n; i++) {
    const x = (i - n / 2) * pitch
    out.push(box([0.05, 0.04, 0.46], [x, 0.66, 0.02], 'chrome'), box([0.04, 0.2, 0.04], [x, 0.55, 0.2], 'chrome'))
  }
  return out
}
function chargingPost(): Part[] {
  return [
    box([0.35, 0.02, 0.35], [0, 0.01, 0], 'brushed'),
    box([0.22, 1.05, 0.22], [0, 0.53, 0], 'white'),
    box([0.24, 0.04, 0.24], [0, 1.07, 0], 'granite'),
    ...[0, H, Math.PI, -H].flatMap((y) => [
      box([0.12, 0.05, 0.005], [Math.sin(y) * 0.112, 0.85, Math.cos(y) * 0.112], 'black', [0, y, 0]),
      box([0.03, 0.03, 0.005], [Math.sin(y) * 0.113, 0.95, Math.cos(y) * 0.113], 'lampCool', [0, y, 0]),
    ]),
    box([0.06, 0.06, 0.004], [0, 0.72, 0.112], 'screenGreen'),
  ]
}
function gateSeating(): Part[] {
  const out: Part[] = []
  for (let r = 0; r < 3; r++) {
    out.push(...place(seatBeam(6, r === 1 ? 'seatGrey' : 'seatBlue'), -2.1, r * 1.9))
    out.push(...place(seatBeam(6, r === 1 ? 'seatGrey' : 'seatBlue'), 2.1, r * 1.9 - 0.75, Math.PI))
    out.push(...place(chargingPost(), 0, r * 1.9 - 0.35))
  }
  out.push(...place(plant(0.9), 5.0, 3.0))
  out.push(...place(suitcase('bagRed'), -1.0, 0.6), ...place(suitcase('bagSilver', 0.36, 0.5), 2.6, 1.4))
  // gate podium + gate number pylon
  out.push(...place(gatePodium(), 0, -2.6))
  return out
}
function gatePodium(): Part[] {
  return [
    box([2.2, 1.05, 0.7], [0, 0.53, 0], 'hatchBlue'),
    box([2.26, 0.04, 0.76], [0, 1.07, 0], 'granite'),
    ...place(monitor(0.45, 0.3), -0.5, -0.1, Math.PI, 1.3),
    box([0.4, 0.2, 0.3], [0.5, 1.18, -0.1], 'black'),
    box([2.6, 1.0, 0.08], [0, 2.6, -0.6], 'fids'),
    box([2.7, 1.1, 0.06], [0, 2.6, -0.66], 'black'),
    box([0.8, 0.8, 0.1], [-1.9, 2.6, -0.6], 'signYellow'),
    cyl([0.1, 2.2, 0.1], [-1.9, 1.1, -0.6], 'darkSteel'),
  ]
}

// ---------- restrooms ----------
function restroom(): Part[] {
  const w = 7, d = 5, h = 3
  const out: Part[] = [
    box([w, h, 0.2], [0, h / 2, -d], 'tileGreen'),
    box([0.2, h, d], [-w / 2, h / 2, -d / 2], 'tileGreen'),
    box([0.2, h, d], [w / 2, h / 2, -d / 2], 'tileGreen'),
    box([0.2, h, d], [0, h / 2, -d / 2], 'tileGreen'),
    box([w, 0.02, d], [0, 0.01, -d / 2], 'pebble'),
    // front wall with two baffle entrances
    box([w, 0.6, 0.25], [0, h - 0.3, 0], 'cream'),
    box([1.6, h - 0.6, 0.25], [-2.6, (h - 0.6) / 2, 0], 'cream'),
    box([1.6, h - 0.6, 0.25], [2.6, (h - 0.6) / 2, 0], 'cream'),
    box([0.7, h - 0.6, 0.25], [0, (h - 0.6) / 2, 0], 'cream'),
    box([1.4, 2.0, 0.12], [-1.3, 1.0, -1.2], 'cream'),
    box([1.4, 2.0, 0.12], [1.3, 1.0, -1.2], 'cream'),
    box([0.9, 0.45, 0.04], [-1.3, 2.75, 0.14], 'sgnMen'),
    box([0.9, 0.45, 0.04], [1.3, 2.75, 0.14], 'sgnWomen'),
    box([1.2, 0.3, 0.04], [0, 2.75, 0.14], 'sgnWC'),
  ]
  for (const side of [-1, 1]) {
    // vanity with basins + mirror
    out.push(box([2.4, 0.08, 0.55], [side * 1.75, 0.85, -2.0], 'granite'), box([2.4, 0.9, 0.04], [side * 1.75, 1.6, -2.3], 'chrome'))
    for (let i = 0; i < 3; i++) out.push(cyl([0.4, 0.12, 0.35], [side * 1.75 - 0.75 + i * 0.75, 0.86, -2.0], 'porcelain'), cyl([0.03, 0.2, 0.03], [side * 1.75 - 0.75 + i * 0.75, 1.0, -2.2], 'chrome'))
    out.push(box([2.4, 0.04, 0.55], [side * 1.75, 2.6, -2.0], 'lamp'))
    // cubicles
    for (let i = 0; i < 3; i++) {
      const x = side * 1.75 - 0.8 + i * 0.8
      out.push(box([0.03, 2.0, 1.4], [x - 0.4, 1.1, -4.2], 'greyPanel'), box([0.76, 1.9, 0.04], [x, 1.1, -3.5], 'hatchBlue'))
      out.push(box([0.4, 0.4, 0.6], [x, 0.2, -4.5], 'porcelain'))
    }
  }
  out.push(...place(plant(0.8), -3.9, 0.6), ...place(plant(0.8), 3.9, 0.6))
  return out
}

// ---------- baggage claim ----------
function carousel(): Part[] {
  const out: Part[] = []
  const L = 9, R = 1.6
  // straight runs
  for (const z of [-R, R]) {
    out.push(box([L, 0.42, 0.9], [0, 0.21, z], 'brushed'))
    out.push(box([L, 0.04, 0.95], [0, 0.44, z * 1.04], 'plate', [z > 0 ? 0.18 : -0.18, 0, 0]))
    out.push(box([L, 0.06, 0.04], [0, 0.3, z * 1.32], 'rubber'))
  }
  // curved ends: radial plate segments
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const a = -H + (i / 8) * Math.PI
      const x = side * (L / 2 + Math.cos(a) * R)
      const z = Math.sin(a) * R
      out.push(box([0.9, 0.42, 0.7], [x, 0.21, z], 'brushed', [0, -a * side + (side < 0 ? Math.PI : 0), 0]))
      out.push(box([0.95, 0.04, 0.72], [x, 0.44, z], 'plate', [0, -a * side + (side < 0 ? Math.PI : 0), 0]))
    }
  }
  // centre island + feed hood with strip curtain
  out.push(box([L, 0.32, 1.6], [0, 0.16, 0], 'darkSteel'), box([L + 0.2, 0.04, 1.7], [0, 0.34, 0], 'brushed'))
  out.push(box([2.2, 2.4, 1.6], [-L / 2 - 2.2, 1.2, 0], 'greyPanel'), box([1.6, 0.9, 0.02], [-L / 2 - 1.39, 0.8, 0], 'rubber', [0, H, 0]))
  out.push(box([2.6, 0.8, 0.1], [0, 2.9, 0], 'black'), box([2.5, 0.7, 0.02], [0, 2.9, 0.06], 'sgnBelt'), box([2.5, 0.7, 0.02], [0, 2.9, -0.06], 'sgnBelt', [0, Math.PI, 0]))
  out.push(cyl([0.12, 2.5, 0.12], [0, 1.4, 0], 'darkSteel'))
  out.push(box([0.3, 0.3, 0.3], [-L / 2 - 1.5, 2.6, 0.9], 'amber'), cyl([0.2, 0.1, 0.2], [-L / 2 - 1.5, 2.8, 0.9], 'amber'))
  // bags on the belt
  const mats = ['bagBlack', 'bagRed', 'bagTeal', 'bagSilver', 'bagBlack', 'navy']
  for (let i = 0; i < 9; i++) {
    const z = i % 2 ? R : -R
    out.push(...place(bagFlat(mats[i % mats.length]), -L / 2 + 0.6 + i * 1.0, z, 0.3 * ((i % 3) - 1), 0.46))
  }
  // trolleys bay
  for (let i = 0; i < 4; i++) out.push(...place(trolley(), L / 2 + 2.6, -1.2 + i * 0.25))
  return out
}
function trolley(): Part[] {
  return [
    box([0.6, 0.04, 0.95], [0, 0.32, 0], 'chrome'),
    box([0.6, 0.6, 0.03], [0, 0.62, -0.45], 'chrome', [0.2, 0, 0]),
    box([0.55, 0.04, 0.04], [0, 0.95, -0.55], 'red'),
    cyl([0.12, 0.04, 0.12], [-0.25, 0.06, 0.35], 'rubber', [0, 0, H]),
    cyl([0.12, 0.04, 0.12], [0.25, 0.06, 0.35], 'rubber', [0, 0, H]),
    cyl([0.12, 0.04, 0.12], [-0.25, 0.06, -0.35], 'rubber', [0, 0, H]),
    cyl([0.12, 0.04, 0.12], [0.25, 0.06, -0.35], 'rubber', [0, 0, H]),
  ]
}

// ---------- signage ----------
function departuresBoard(): Part[] {
  return [
    box([0.6, 0.04, 0.6], [0, 0.02, 0], 'brushed'),
    box([0.4, 2.2, 0.3], [0, 1.1, 0], 'navy'),
    box([3.4, 2.1, 0.22], [0, 3.15, 0], 'black'),
    box([3.2, 1.9, 0.02], [0, 3.15, 0.12], 'fids'),
    box([3.2, 1.9, 0.02], [0, 3.15, -0.12], 'fids', [0, Math.PI, 0]),
    box([3.5, 0.18, 0.3], [0, 4.28, 0], 'hatchBlue'),
    box([3.0, 0.03, 0.06], [0, 4.2, 0.16], 'lampCool'),
  ]
}
function wayfindingSign(mat = 'sgnGates'): Part[] {
  return [
    cyl([0.02, 1.2, 0.02], [-1.3, 4.0, 0], 'chrome'),
    cyl([0.02, 1.2, 0.02], [1.3, 4.0, 0], 'chrome'),
    box([3.0, 0.62, 0.16], [0, 3.1, 0], 'signDark'),
    box([2.9, 0.52, 0.02], [0, 3.1, 0.085], mat),
    box([2.9, 0.52, 0.02], [0, 3.1, -0.085], mat, [0, Math.PI, 0]),
    box([3.0, 0.03, 0.18], [0, 2.78, 0], 'signYellow'),
  ]
}
function wayfindingTotem(): Part[] {
  return [
    box([0.9, 2.6, 0.25], [0, 1.3, 0], 'signDark'),
    box([0.8, 0.3, 0.02], [0, 2.3, 0.13], 'signYellow'),
    box([0.76, 0.2, 0.02], [0, 1.9, 0.13], 'sgnGates'),
    box([0.76, 0.2, 0.02], [0, 1.6, 0.13], 'sgnBags'),
    box([0.76, 0.2, 0.02], [0, 1.3, 0.13], 'sgnWC'),
    box([0.76, 0.2, 0.02], [0, 1.0, 0.13], 'sgnExit'),
    box([0.76, 0.4, 0.02], [0, 0.45, 0.13], 'screen'),
  ]
}

// ---------- small furniture ----------
function planterLong(): Part[] {
  const out: Part[] = [box([2.4, 0.55, 0.8], [0, 0.28, 0], 'walnut'), box([2.46, 0.04, 0.86], [0, 0.57, 0], 'brushed'), box([2.3, 0.02, 0.7], [0, 0.55, 0], 'pebble')]
  for (let i = 0; i < 5; i++) {
    out.push(part('sphere', [0.55, 0.5, 0.55], [-0.95 + i * 0.47, 0.82, (i % 2 ? 0.12 : -0.12)], i % 2 ? 'leaf' : 'leafDark'))
    out.push(part('cone', [0.2, 0.9, 0.2], [-0.95 + i * 0.47, 1.2, 0], 'leaf'))
  }
  return out
}
function binUnit(): Part[] {
  const mats = ['hatchBlue', 'green', 'darkSteel']
  const out: Part[] = [box([1.3, 0.04, 0.45], [0, 0.02, 0], 'brushed')]
  mats.forEach((m, i) => {
    const x = -0.42 + i * 0.42
    out.push(box([0.4, 0.95, 0.42], [x, 0.5, 0], 'brushed'))
    out.push(box([0.36, 0.3, 0.01], [x, 0.75, 0.212], m))
    out.push(cyl([0.2, 0.02, 0.2], [x, 0.98, 0.05], 'black'))
  })
  return out
}
function stanchionQueue(): Part[] {
  return queue(5.4, 4, 1.0, -2)
}

// ---------- registry ----------
export const TERMINAL_PROP_TYPES = [
  'checkin_row',
  'security_lane',
  'walkthrough_arch',
  'xray_machine',
  'shop_coffee',
  'shop_dutyfree',
  'shop_news',
  'shop_fastfood',
  'food_court',
  'cafe_table',
  'gate_seating',
  'seat_row',
  'charging_post',
  'gate_podium',
  'restroom_block',
  'baggage_carousel',
  'baggage_trolley',
  'departures_board',
  'wayfinding_sign',
  'wayfinding_totem',
  'planter',
  'planter_long',
  'bin',
  'stanchion',
  'stanchion_queue',
] as const
export type TerminalPropType = (typeof TERMINAL_PROP_TYPES)[number]

export const PROP_BUILDERS: Record<TerminalPropType, () => Part[]> = {
  checkin_row: () => checkinRow(4),
  security_lane: securityLane,
  walkthrough_arch: archDetector,
  xray_machine: xray,
  shop_coffee: () => shop('coffee'),
  shop_dutyfree: () => shop('dutyfree'),
  shop_news: () => shop('news'),
  shop_fastfood: () => shop('fastfood'),
  food_court: foodCourt,
  cafe_table: () => cafeTable(4),
  gate_seating: gateSeating,
  seat_row: () => seatBeam(5),
  charging_post: chargingPost,
  gate_podium: gatePodium,
  restroom_block: restroom,
  baggage_carousel: carousel,
  baggage_trolley: trolley,
  departures_board: departuresBoard,
  wayfinding_sign: () => wayfindingSign('sgnGates'),
  wayfinding_totem: wayfindingTotem,
  planter: () => plant(1),
  planter_long: planterLong,
  bin: binUnit,
  stanchion: stanchionPost,
  stanchion_queue: stanchionQueue,
}
