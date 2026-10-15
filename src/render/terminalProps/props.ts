/**
 * Detailed terminal prop models. Every builder returns parts in metres with
 * the origin at the floor centre and the passenger-facing side toward +Z.
 * Dimensions follow real kit: 1.0 m check-in desks, 0.9 m x-ray tunnels,
 * 0.76 m bench seats, 2.1 m arches, 0.75 m tables.
 */
import { box, cyl, markNear, part, place, type Part } from './parts'

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

// ---------- round 4: staff figures ----------
type Look = { top: string; legs: string; skin: string; hair: string; vest?: boolean; cap?: string }
const AGENT: Look[] = [
  { top: 'lacquerBlue', legs: 'pantsNavy', skin: 'skin', hair: 'hair' },
  { top: 'shirtWhite', legs: 'pantsNavy', skin: 'skinDark', hair: 'hair', cap: undefined },
  { top: 'red', legs: 'pantsBlack', skin: 'skin', hair: 'hairBrown' },
  { top: 'lacquerBlue', legs: 'pantsNavy', skin: 'skinDark', hair: 'hairBrown' },
]
const OFFICER: Look = { top: 'shirtNavy', legs: 'pantsBlack', skin: 'skin', hair: 'hair', vest: true, cap: 'navy' }
/**
 * Low-poly standing person, facing +Z, feet at y=0 (1.74 m). `arms` raised
 * forward puts hands on a counter / screen in front. Seated drops the hips to stool height.
 */
function person(look: Look, opts: { arms?: 'side' | 'forward'; seated?: boolean } = {}): Part[] {
  const sit = !!opts.seated
  const hip = sit ? 0.66 : 0.92
  const out: Part[] = []
  // legs (seated: thighs forward + shins down)
  for (const x of [-0.1, 0.1]) {
    if (sit) {
      out.push(box([0.13, 0.13, 0.42], [x, hip, 0.16], look.legs))
      out.push(box([0.12, hip - 0.04, 0.13], [x, (hip - 0.04) / 2, 0.36], look.legs))
      out.push(box([0.12, 0.07, 0.24], [x, 0.035, 0.42], 'black'))
    } else {
      out.push(cyl([0.14, hip - 0.06, 0.14], [x, (hip - 0.06) / 2 + 0.06, 0], look.legs))
      out.push(box([0.12, 0.07, 0.26], [x, 0.035, 0.04], 'black'))
    }
  }
  // torso, shoulders, neck, head, hair
  out.push(box([0.4, 0.12, 0.24], [0, hip + 0.04, 0], look.legs))
  out.push(cyl([0.38, 0.52, 0.24], [0, hip + 0.34, 0], look.top))
  out.push(part('sphere', [0.46, 0.14, 0.26], [0, hip + 0.6, 0], look.top))
  if (look.vest) {
    out.push(box([0.4, 0.4, 0.27], [0, hip + 0.34, 0], 'vestYellow'))
    out.push(box([0.2, 0.08, 0.01], [0, hip + 0.44, 0.14], 'signDark'))
  } else out.push(box([0.06, 0.18, 0.01], [0, hip + 0.42, 0.125], look.top === 'shirtWhite' ? 'lacquerBlue' : 'shirtWhite'))
  out.push(cyl([0.09, 0.08, 0.09], [0, hip + 0.7, 0], look.skin))
  out.push(part('sphere', [0.2, 0.24, 0.22], [0, hip + 0.84, 0.01], look.skin))
  out.push(part('sphere', [0.215, 0.14, 0.23], [0, hip + 0.92, -0.01], look.hair))
  if (look.cap) {
    out.push(cyl([0.23, 0.07, 0.23], [0, hip + 0.97, 0], look.cap))
    out.push(box([0.18, 0.015, 0.1], [0, hip + 0.94, 0.13], 'black'))
  }
  // arms
  for (const sx of [-1, 1]) {
    if (opts.arms === 'forward') {
      out.push(cyl([0.09, 0.3, 0.09], [sx * 0.24, hip + 0.44, 0.02], look.top, [0.2, 0, 0]))
      out.push(cyl([0.08, 0.3, 0.08], [sx * 0.22, hip + 0.28, 0.17], look.top, [H * 0.95, 0, 0]))
      out.push(part('sphere', [0.08, 0.08, 0.1], [sx * 0.2, hip + 0.28, 0.34], look.skin))
    } else {
      out.push(cyl([0.09, 0.56, 0.09], [sx * 0.25, hip + 0.3, 0], look.top, [0, 0, sx * 0.06]))
      out.push(part('sphere', [0.08, 0.1, 0.08], [sx * 0.27, hip + 0.0, 0], look.skin))
    }
  }
  return out
}
/** Retractable-belt stanchion with the belt cassette head and a ribbed base. */
function beltPost(): Part[] {
  return [
    cyl([0.36, 0.03, 0.36], [0, 0.015, 0], 'chrome'),
    cyl([0.3, 0.02, 0.3], [0, 0.035, 0], 'rubber'),
    cyl([0.06, 0.88, 0.06], [0, 0.48, 0], 'chrome'),
    cyl([0.1, 0.1, 0.1], [0, 0.96, 0], 'chrome'),
    cyl([0.11, 0.02, 0.11], [0, 0.92, 0], 'hatchBlue'),
    part('sphere', [0.08, 0.04, 0.08], [0, 1.02, 0], 'chrome'),
  ]
}

// ---------- check-in ----------
function checkinDesk(i: number): Part[] {
  const logo = `logo${i % 4}`
  return [
    // counter body + granite top + bag-drop step
    box([1.6, 1.05, 0.7], [0, 0.525, -0.2], 'oak'),
    box([1.64, 0.04, 0.78], [0, 1.07, -0.2], 'granite'),
    box([1.5, 0.12, 0.02], [0, 0.85, 0.16], 'lacquerBlue'),
    box([1.56, 0.02, 0.02], [0, 0.06, 0.16], 'ledBlue'),
    box([0.25, 0.16, 0.03], [-0.4, 0.95, 0.17], 'screen'),
    // agent monitor, printer, keyboard
    ...place(monitor(0.48, 0.3), -0.35, -0.38, Math.PI, 1.3),
    box([0.3, 0.12, 0.25], [0.25, 1.15, -0.4], 'black'),
    box([0.42, 0.02, 0.14], [-0.35, 1.1, -0.3], 'black'),
    // bag-drop weigh scale: stainless frame, powered belt with rollers, side
    // guards, weight readout on a post, injection belt to the collector
    box([0.9, 0.3, 0.86], [1.25, 0.15, -0.15], 'stainless'),
    box([0.84, 0.035, 0.8], [1.25, 0.32, -0.15], 'belt'),
    cyl([0.07, 0.84, 0.07], [1.25, 0.31, 0.25], 'chrome', [0, 0, H]),
    cyl([0.07, 0.84, 0.07], [1.25, 0.31, -0.55], 'chrome', [0, 0, H]),
    box([0.03, 0.22, 0.86], [0.81, 0.42, -0.15], 'brushed'),
    box([0.03, 0.22, 0.86], [1.69, 0.42, -0.15], 'brushed'),
    box([0.92, 0.3, 0.02], [1.25, 0.15, 0.285], 'plate'),
    box([0.9, 0.025, 0.02], [1.25, 0.31, 0.29], 'signYellow'),
    cyl([0.05, 0.62, 0.05], [1.66, 0.62, 0.22], 'chrome'),
    box([0.3, 0.16, 0.07], [1.66, 1.0, 0.22], 'black', [-0.25, 0, 0]),
    box([0.25, 0.1, 0.01], [1.66, 1.0, 0.26], 'screenGreen', [-0.25, 0, 0]),
    box([0.9, 0.035, 0.6], [1.25, 0.5, -0.85], 'belt', [0.32, 0, 0]),
    box([0.9, 0.12, 0.03], [1.25, 0.55, -0.56], 'rubber'),
    // passenger-facing kit: customer display, card/boarding-pass reader, tag printer, desk number
    box([0.3, 0.2, 0.03], [-0.35, 1.22, 0.06], 'black', [-0.35, 0, 0]),
    box([0.26, 0.16, 0.005], [-0.35, 1.22, 0.08], 'kiosk', [-0.35, 0, 0]),
    box([0.1, 0.05, 0.14], [0.1, 1.115, 0.05], 'black'),
    box([0.06, 0.01, 0.06], [0.1, 1.145, 0.07], 'screenGreen'),
    box([0.22, 0.16, 0.22], [0.52, 1.17, -0.35], 'greyPanel'),
    box([0.04, 0.04, 0.12], [-0.79, 1.24, 0.1], 'chrome'),
    box([0.3, 0.44, 0.02], [-0.72, 1.42, 0.12], `desk${(i % 6) + 1}`),
    // anti-fatigue mat where the agent stands
    box([1.0, 0.012, 0.6], [-0.2, 0.006, -0.8], 'rubber'),
    // back-wall airline screen (slim bezel) with OPEN strip + desk number box
    box([1.3, 0.76, 0.05], [0.3, 2.35, -1.66], 'black'),
    box([1.22, 0.62, 0.01], [0.3, 2.39, -1.63], logo),
    box([1.22, 0.1, 0.01], [0.3, 2.02, -1.63], 'deskOpen'),
    box([0.34, 0.34, 0.06], [-0.6, 2.35, -1.64], 'signDark'),
    box([0.34, 0.5, 0.01], [-0.62, 2.38, -1.605], `desk${(i % 6) + 1}`),
    // agent standing at the counter, hands on the keyboard
    ...place(person(AGENT[i % AGENT.length], { arms: 'forward' }), -0.2, -0.75),
  ]
}
function checkinRow(n = 6): Part[] {
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
  out.push(box([2.2, 1.02, 0.03], [0.4, 3.15, -0.55], 'sgnCheckin'))
  out.push(box([1.8, 0.42, 0.03], [-2.2, 2.55, -1.66], 'sgnArrivals'))
  out.push(box([len + 0.4, 0.06, 0.06], [0.4, 3.0 - 0.3, -1.6], 'lamp'))
  // strip curtain opening where the belt exits
  out.push(box([0.9, 0.6, 0.3], [len / 2 + 0.55, 0.75, -1.15], 'darkSteel'))
  out.push(box([0.8, 0.5, 0.02], [len / 2 + 0.5, 0.7, -1.0], 'rubber'))
  // soffit over the desks with a hanging FIDS monitor per desk
  out.push(box([len + 0.4, 0.3, 0.9], [0.4, 3.55, -1.3], 'lacquerWhite'))
  out.push(box([len + 0.4, 0.04, 0.04], [0.4, 3.39, -0.86], 'ledBlue'))
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch
    out.push(cyl([0.03, 0.22, 0.03], [x - 0.2, 3.3, -0.95], 'chrome'), cyl([0.03, 0.22, 0.03], [x + 0.2, 3.3, -0.95], 'chrome'))
    out.push(box([0.72, 0.42, 0.05], [x, 3.0, -0.95], 'black'), box([0.66, 0.36, 0.01], [x, 3.0, -0.92], 'fids'))
  }
  // serpentine queue in front with retractable-belt posts
  out.push(...queue(len - 1.2, 3, 1.1, 2.6, beltPost))
  // queue entry sign
  out.push(cyl([0.06, 1.6, 0.06], [-(len - 1.2) / 2 - 0.6, 0.8, 2.6 + 3 * 1.1], 'chrome'))
  out.push(box([0.78, 0.36, 0.03], [-(len - 1.2) / 2 - 0.6, 1.6, 2.6 + 3 * 1.1], 'sgnCheckin'))
  return out
}

/** Stanchion serpentine; w = lane length, lanes deep, posts at pitch. */
function queue(w: number, lanes: number, gap: number, z0: number, post: () => Part[] = stanchionPost): Part[] {
  const out: Part[] = []
  const nx = Math.max(2, Math.round(w / 1.8) + 1)
  const pitch = w / (nx - 1)
  for (let l = 0; l <= lanes; l++) {
    const z = z0 + l * gap
    for (let i = 0; i < nx; i++) {
      const x = -w / 2 + i * pitch
      out.push(...place(post(), x, z))
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
    // lead curtain strips at both mouths
    ...[-1.11, 1.11].flatMap((cx) => Array.from({ length: 6 }, (_, k) => box([0.02, 0.6, 0.13], [cx, 1.0, -0.33 + k * 0.132], 'rubber'))),
    box([0.02, 0.06, 0.84], [-1.11, 1.32, 0], 'darkSteel'),
    box([0.02, 0.06, 0.84], [1.11, 1.32, 0], 'darkSteel'),
    // control panel with e-stop, warning labels, vent, casters, plinth shadow gap
    box([0.4, 0.16, 0.06], [-0.75, 1.32, 0.56], 'darkSteel'),
    cyl([0.07, 0.04, 0.07], [-0.65, 1.32, 0.6], 'red', [H, 0, 0]),
    box([0.1, 0.04, 0.01], [-0.82, 1.32, 0.595], 'screenGreen'),
    box([0.16, 0.16, 0.01], [0.75, 0.75, 0.556], 'signYellow'),
    box([0.12, 0.08, 0.01], [0.95, 0.75, 0.556], 'red'),
    cyl([0.3, 0.02, 0.3], [-0.5, 0.35, 0.556], 'darkSteel', [H, 0, 0]),
    box([2.1, 0.06, 1.0], [0, 0.03, 0], 'darkSteel'),
    ...[-0.9, 0.9].flatMap((x) => [-0.42, 0.42].map((z) => cyl([0.08, 0.06, 0.08], [x, 0.03, z], 'rubber', [H, 0, 0]))),
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
    ...place(person(OFFICER, { arms: 'forward', seated: true }), 0.2, -1.62),
  ]
  // trays in flight are animated (see MOVING_TRAYS); one parked on the out-feed
  out.push(box([0.55, 0.1, 0.4], [3.4, 0.85, 0], 'tray'), box([0.4, 0.14, 0.26], [3.4, 0.95, 0], 'bagRed'))
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
  const out: Part[] = [box([14.2, 0.012, 6.2], [-0.4, 0.004, 0.3], 'intRubber'), ...place(xray(), 0, 0)]
  // divesting tables (rear) with tray stacks
  for (const x of [-4.2, -5.3]) {
    out.push(box([1.0, 0.82, 0.7], [x, 0.41, 0], 'corian'), box([1.04, 0.03, 0.74], [x, 0.84, 0], 'brushed'))
    for (let k = 0; k < 6; k++) out.push(box([0.55, 0.06, 0.4], [x, 0.89 + k * 0.065, 0], 'tray'))
  }
  // walk-through arch beside the tunnel; body scanner pad
  out.push(...place(archDetector(), 1.0, 1.6))
  out.push(...place(bodyScanner(), -1.4, 1.6))
  out.push(box([1.0, 0.4, 0.04], [1.0, 2.6, 1.6], 'lbSecurity'))
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
  out.push(...place(beltPost(), -6.4, 2.2), ...place(beltPost(), -6.4, 0.9))
  // officers: divest helper, arch officer, scanner officer, bag-search at reclaim
  out.push(...place(person(OFFICER), -4.75, 0.9, Math.PI))
  out.push(...place(person(OFFICER), 1.0, 2.35, -H))
  out.push(...place(person(OFFICER, { arms: 'forward' }), -1.4, 0.55, Math.PI))
  out.push(...place(person(OFFICER, { arms: 'forward' }), 4.6, -0.75))
  // lane floor: yellow edge lines + walk arrows
  for (const z of [0.9, 2.3]) out.push(box([5.0, 0.004, 0.06], [-3.6, 0.003, z], 'signYellow'))
  for (const x of [-5.6, -4.0, -2.4]) out.push(box([0.4, 0.004, 0.12], [x, 0.003, 1.6], 'white', [0, 0, 0]))
  return out
}

// ---------- shops ----------
type ShopKind = 'coffee' | 'dutyfree' | 'news' | 'fastfood'
const SHOP: Record<ShopKind, { sign: string; lb: string; accent: string; floor: string }> = {
  coffee: { sign: 'sgnCoffee', lb: 'lbCoffee', accent: 'walnut', floor: 'intPlank' },
  dutyfree: { sign: 'sgnDuty', lb: 'lbDuty', accent: 'black', floor: 'intPlank' },
  news: { sign: 'sgnNews', lb: 'lbNews', accent: 'red', floor: 'intPlank' },
  fastfood: { sign: 'sgnBurger', lb: 'lbBurger', accent: 'red', floor: 'intPlank' },
}
function shopShell(kind: ShopKind, w = 8, d = 6, h = 4): Part[] {
  const s = SHOP[kind]
  const out: Part[] = [
    box([w, 0.02, d], [0, 0.01, -d / 2], s.floor),
    box([w, h, 0.2], [0, h / 2, -d], 'intWall'),
    box([0.25, h, d], [-w / 2, h / 2, -d / 2], 'intWall'),
    box([0.25, h, d], [w / 2, h / 2, -d / 2], 'intWall'),
    // fascia + illuminated sign. The wordmark is a plane facing +Z so the letters stay left to right.
    box([w + 0.3, 0.9, 0.35], [0, h - 0.45, 0.05], s.accent),
    part('plane', [w * 0.62, 0.55, 0.02], [0, h - 0.45, 0.28], s.sign),
    box([w + 0.3, 0.04, 0.06], [0, h - 0.92, 0.2], 'ledWarm'),
    box([0.08, 0.9, 0.9], [w / 2 + 0.05, h - 1.6, 0.5], 'darkSteel'),
    box([0.02, 0.7, 0.75], [w / 2 + 0.1, h - 1.6, 0.5], s.sign, [0, H, 0]),
    box([0.02, 0.7, 0.75], [w / 2, h - 1.6, 0.5], s.sign, [0, -H, 0]),
    box([0.3, h - 0.9, 0.3], [-w / 2 + 0.15, (h - 0.9) / 2, 0.1], 'stainless'),
    box([0.3, h - 0.9, 0.3], [w / 2 - 0.15, (h - 0.9) / 2, 0.1], 'stainless'),
    box([2.4, 0.18, 0.12], [0, h - 1.0, 0.12], 'darkSteel'),
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
function counterUnit(len: number, top = 'granite', face = 'brushed'): Part[] {
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
    out.push(...place(cafeCounter(), 0.9, -4.2))
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
    out.push(...place(counterUnit(2, 'granite', 'brushed'), -3, -1.4, H))
    out.push(box([0.6, 1.7, 0.1], [0, 0.85, -1.2], 'lbDuty'))
    out.push(...place(gondola(['bottle', 'goodsA', 'bottle', 'goodsB']), 0, -4.2))
  } else if (kind === 'news') {
    out.push(...place(shelfUnit(['goodsC', 'red', 'goodsD', 'signYellow']), -2.6, -5.6), ...place(shelfUnit(['goodsD', 'goodsC', 'hatchBlue']), -0.7, -5.6))
    out.push(...place(shelfUnit(['red', 'goodsD', 'goodsC']), 1.2, -5.6))
    // magazine wall: angled racks
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) out.push(box([0.22, 0.3, 0.02], [-3.6, 0.6 + k * 0.42, -4.4 + i * 0.3], ['red', 'goodsC', 'signYellow', 'goodsD'][(i + k) % 4], [0, H, -0.25]))
    // drinks fridge
    out.push(box([1.4, 2.0, 0.7], [3.1, 1.0, -5.4], 'darkSteel'), box([1.3, 1.8, 0.02], [3.1, 1.05, -5.04], 'glass'))
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) out.push(cyl([0.07, 0.22, 0.07], [2.6 + i * 0.2, 0.4 + k * 0.45, -5.2], i % 2 ? 'bagTeal' : 'red'))
    out.push(box([1.4, 0.04, 0.6], [3.1, 2.05, -5.4], 'lampCool'))
    out.push(...place(counterUnit(1.8, 'corian', 'brushed'), 2.4, -1.6))
    out.push(...place(gondola(['goodsC', 'red', 'goodsD', 'signYellow']), -1.2, -3.0))
    out.push(box([0.4, 0.3, 0.3], [2.4, 1.2, -1.6], 'black'))
  } else {
    out.push(...place(counterUnit(5.6, 'brushed', 'brushed'), 0, -2.6))
    for (let i = 0; i < 3; i++) out.push(...place(monitor(0.3, 0.22), -1.8 + i * 1.8, -2.45, 0, 1.2))
    // kitchen line behind
    out.push(box([6.6, 0.95, 0.8], [0, 0.48, -5.3], 'brushed'), box([6.6, 0.6, 0.6], [0, 2.6, -5.4], 'steel'))
    for (let i = 0; i < 3; i++) out.push(box([0.9, 0.3, 0.6], [-2 + i * 2, 1.15, -5.3], 'darkSteel'))
    out.push(box([5.4, 0.9, 0.05], [0, 3.0, -5.85], 'black'))
    for (let i = 0; i < 4; i++) out.push(part('plane', [1.2, 0.72, 0.02], [-1.8 + i * 1.2, 3.0, -5.7], i % 2 ? 'lbBurger' : 'screen'))
    for (let i = 0; i < 4; i++) out.push(part('sphere', [0.14, 0.08, 0.14], [-1 + i * 0.3, 1.1, -2.5], 'bun'))
    out.push(box([0.6, 1.8, 0.4], [3.4, 0.9, -1.0], 'signYellow'), box([0.5, 0.5, 0.02], [3.4, 1.3, -0.79], 'screen'))
  }
  return out
}

/** Glass counter of phones and small boxes. Origin on the floor, front +Z. */
function glassCase(w = 1.4): Part[] {
  const out: Part[] = [
    box([w, 0.72, 0.52], [0, 0.36, 0], 'white'),
    box([w + 0.02, 0.04, 0.56], [0, 0.74, 0], 'brushed'),
    box([w - 0.06, 0.36, 0.46], [0, 0.96, 0], 'glass'),
  ]
  const n = Math.max(3, Math.floor(w / 0.22))
  const mats = ['black', 'goodsC', 'white', 'red']
  for (let i = 0; i < n; i++) out.push(box([0.1, 0.16, 0.02], [(i - (n - 1) / 2) * 0.2, 0.86, 0], mats[i % mats.length]))
  return out
}

/**
 * Airside gadget shop from the shop_gadget sheet: oak plank floor, cream
 * walls, white island cases, a brushed-steel checkout.
 */
function shopGadget(): Part[] {
  const w = 7.4
  const d = 5.6
  const h = 3.2
  const out: Part[] = [
    box([w, 0.02, d], [0, 0.01, -d / 2], 'intPlank'),
    box([w, h, 0.14], [0, h / 2, -d], 'intWall'),
    box([0.14, h, d], [-w / 2, h / 2, -d / 2], 'intWall'),
    box([0.14, h, d], [w / 2, h / 2, -d / 2], 'intWall'),
    box([w, 0.42, 0.18], [0, h - 0.22, 0.02], 'white'),
    part('plane', [2.4, 0.28, 0.02], [0, h - 0.22, 0.14], 'sgnGadget'),
    box([w, 0.04, 0.08], [0, h - 0.48, 0.08], 'ledWarm'),
    box([2.2, 2.35, 0.04], [-2.4, 1.2, 0.02], 'glass'),
    box([2.2, 2.35, 0.04], [2.4, 1.2, 0.02], 'glass'),
  ]
  for (const x of [-3.6, -1.2, 1.2, 3.6]) out.push(box([0.06, 2.4, 0.08], [x, 1.2, 0.02], 'brushed'))
  for (const x of [-2.2, -0.7, 0.8, 2.3]) out.push(...place(glassCase(1.25), x, -4.85))
  out.push(...place(glassCase(1.7), -1.4, -2.7))
  out.push(...place(glassCase(1.7), 0.5, -2.7))
  out.push(...place(counterUnit(1.7, 'white', 'intCounter'), 2.55, -1.15, -H))
  for (let x = -2.4; x <= 2.4; x += 1.6) out.push(cyl([0.16, 0.04, 0.16], [x, h - 0.04, -2.4], 'lamp'))
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
/** White top, brushed pedestal, dark chairs. Food-court seating only. */
function foodTable(): Part[] {
  const out: Part[] = [
    box([0.86, 0.04, 0.86], [0, 0.74, 0], 'white'),
    cyl([0.06, 0.7, 0.06], [0, 0.36, 0], 'brushed'),
    cyl([0.26, 0.03, 0.26], [0, 0.02, 0], 'brushed'),
  ]
  for (const y of [0, H, Math.PI, -H]) out.push(...place(chair('black', 'brushed'), Math.sin(y) * 0.62, Math.cos(y) * 0.62, y + Math.PI))
  return out
}

/**
 * Food court from the food_court sheet: terrazzo floor, four brushed-steel
 * stalls with menu boards, white tables, baffle ceiling.
 */
function foodCourt(): Part[] {
  const w = 9.2
  const out: Part[] = [
    box([w, 0.02, 7.4], [0, 0.01, -0.6], 'intFloor'),
    box([w, 2.8, 0.12], [0, 1.4, -4.3], 'intWall'),
    box([0.12, 2.8, 7.2], [-w / 2, 1.4, -0.7], 'intWall'),
    box([0.12, 2.8, 7.2], [w / 2, 1.4, -0.7], 'intWall'),
  ]
  const menus = ['sgnGrill', 'sgnNoodle', 'sgnBrew', 'sgnGrab'] as const
  for (let i = 0; i < menus.length; i++) {
    const x = -3.3 + i * 2.2
    out.push(
      box([2.0, 1.05, 0.62], [x, 0.52, -3.55], 'intCounter'),
      box([2.05, 0.045, 0.68], [x, 1.07, -3.52], 'white'),
      box([1.7, 0.55, 0.04], [x, 2.05, -4.16], menus[i]),
      box([1.85, 0.05, 0.04], [x, 1.65, -4.16], 'ledWarm'),
    )
  }
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) out.push(...place(foodTable(), (c - 1) * 2.5, 0.15 + r * 2.15))
  for (let i = 0; i < 4; i++) out.push(box([w - 0.8, 0.08, 0.42], [0, 3.05, -2.8 + i * 1.45], 'intCeiling'))
  for (const x of [-2.4, 0, 2.4]) out.push(cyl([0.16, 0.05, 0.16], [x, 2.55, -0.4], 'lamp'), cyl([0.02, 0.45, 0.02], [x, 2.8, -0.4], 'brushed'))
  out.push(...place(binUnit(), 4.0, 1.6, -H))
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
    out.push(box([0.07, 0.07, 0.46], [x, 0.56, 0.02], 'leather'), box([0.045, 0.16, 0.045], [x, 0.48, 0.18], 'chrome'))
    if (i % 2 === 0) out.push(...markNear([box([0.05, 0.016, 0.07], [x, 0.605, 0.1], 'lampCool')]))
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
    box([2.2, 1.05, 0.7], [0, 0.53, 0], 'lacquerBlue'),
    box([2.2, 0.03, 0.02], [0, 0.08, 0.36], 'ledBlue'),
    box([2.26, 0.04, 0.76], [0, 1.07, 0], 'granite'),
    ...place(monitor(0.45, 0.3), -0.5, -0.1, Math.PI, 1.3),
    box([0.4, 0.2, 0.3], [0.5, 1.18, -0.1], 'black'),
    box([2.6, 1.0, 0.08], [0, 2.6, -0.6], 'fids'),
    box([2.7, 1.1, 0.06], [0, 2.6, -0.66], 'black'),
    box([0.8, 0.8, 0.1], [-1.9, 2.6, -0.6], 'sgnGateA12'),
    cyl([0.1, 2.2, 0.1], [-1.9, 1.1, -0.6], 'darkSteel'),
  ]
}

// ---------- restrooms ----------
function restroom(): Part[] {
  const w = 7, d = 5, h = 3
  const out: Part[] = [
    box([w, h, 0.2], [0, h / 2, -d], 'intTile'),
    box([0.2, h, d], [-w / 2, h / 2, -d / 2], 'intTile'),
    box([0.2, h, d], [w / 2, h / 2, -d / 2], 'intTile'),
    box([0.2, h, d], [0, h / 2, -d / 2], 'intStall'),
    box([w, 0.02, d], [0, 0.01, -d / 2], 'intRestroomFloor'),
    // front wall with two baffle entrances
    box([w, 0.6, 0.25], [0, h - 0.3, 0], 'cream'),
    box([1.6, h - 0.6, 0.25], [-2.6, (h - 0.6) / 2, 0], 'tileTeal'),
    box([1.6, h - 0.6, 0.25], [2.6, (h - 0.6) / 2, 0], 'tileTeal'),
    box([w, 0.04, 0.05], [0, h - 0.62, 0.15], 'ledWarm'),
    box([0.7, h - 0.6, 0.25], [0, (h - 0.6) / 2, 0], 'cream'),
    box([1.4, 2.0, 0.12], [-1.3, 1.0, -1.2], 'cream'),
    box([1.4, 2.0, 0.12], [1.3, 1.0, -1.2], 'cream'),
    box([0.9, 0.45, 0.04], [-1.3, 2.75, 0.14], 'sgnMen'),
    box([0.9, 0.45, 0.04], [1.3, 2.75, 0.14], 'sgnWomen'),
    box([1.2, 0.3, 0.04], [0, 2.75, 0.14], 'sgnWC'),
  ]
  for (const side of [-1, 1]) {
    // vanity with basins + mirror
    out.push(box([2.4, 0.08, 0.55], [side * 1.75, 0.85, -2.0], 'granite'), box([2.4, 0.9, 0.04], [side * 1.75, 1.6, -2.3], 'mirror'), box([0.25, 0.3, 0.12], [side * 3.1, 1.3, -2.2], 'stainless'))
    for (let i = 0; i < 3; i++) out.push(cyl([0.4, 0.12, 0.35], [side * 1.75 - 0.75 + i * 0.75, 0.86, -2.0], 'porcelain'), cyl([0.03, 0.2, 0.03], [side * 1.75 - 0.75 + i * 0.75, 1.0, -2.2], 'chrome'))
    out.push(box([2.4, 0.04, 0.55], [side * 1.75, 2.6, -2.0], 'lamp'))
    // cubicles
    for (let i = 0; i < 3; i++) {
      const x = side * 1.75 - 0.8 + i * 0.8
      out.push(box([0.03, 2.0, 1.4], [x - 0.4, 1.1, -4.2], 'intStall'), box([0.76, 1.9, 0.04], [x, 1.1, -3.5], 'intStall'))
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
    out.push(box([L, 0.04, 0.95], [0, 0.44, z * 1.04], 'intBelt', [z > 0 ? 0.18 : -0.18, 0, 0]))
    out.push(box([L, 0.06, 0.04], [0, 0.3, z * 1.32], 'rubber'))
  }
  // curved ends: radial plate segments
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const a = -H + (i / 8) * Math.PI
      const x = side * (L / 2 + Math.cos(a) * R)
      const z = Math.sin(a) * R
      out.push(box([0.9, 0.42, 0.7], [x, 0.21, z], 'brushed', [0, -a * side + (side < 0 ? Math.PI : 0), 0]))
      out.push(box([0.95, 0.04, 0.72], [x, 0.44, z], 'intBelt', [0, -a * side + (side < 0 ? Math.PI : 0), 0]))
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
    box([3.6, 2.05, 0.22], [0, 3.15, 0], 'black'),
    box([3.42, 1.8, 0.02], [0, 3.15, 0.12], 'fids'),
    box([3.42, 1.8, 0.02], [0, 3.15, -0.12], 'fids', [0, Math.PI, 0]),
    box([3.5, 0.18, 0.3], [0, 4.28, 0], 'hatchBlue'),
    box([3.0, 0.03, 0.06], [0, 4.2, 0.16], 'lampCool'),
  ]
}
function wayfindingSign(mat = 'sgnGates'): Part[] {
  return [
    cyl([0.02, 1.2, 0.02], [-1.3, 4.0, 0], 'chrome'),
    cyl([0.02, 1.2, 0.02], [1.3, 4.0, 0], 'chrome'),
    box([2.7, 1.32, 0.16], [0, 3.35, 0], 'signDark'),
    box([2.46, 1.14, 0.02], [0, 3.35, 0.09], mat),
    box([2.46, 1.14, 0.02], [0, 3.35, -0.09], mat, [0, Math.PI, 0]),
    box([3.0, 0.03, 0.18], [0, 2.78, 0], 'signYellow'),
  ]
}
function wayfindingTotem(): Part[] {
  return [
    box([0.9, 2.6, 0.25], [0, 1.3, 0], 'signDark'),
    box([0.8, 0.3, 0.02], [0, 2.3, 0.13], 'signYellow'),
    box([0.78, 0.36, 0.02], [0, 1.9, 0.13], 'sgnGates'),
    box([0.78, 0.36, 0.02], [0, 1.48, 0.13], 'sgnBags'),
    box([0.78, 0.36, 0.02], [0, 1.06, 0.13], 'sgnWC'),
    box([0.78, 0.36, 0.02], [0, 0.64, 0.13], 'sgnExit'),
    box([0.76, 0.28, 0.02], [0, 0.22, 0.13], 'screen'),
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


// ---------- pass 2: desktop-tier props ----------
/** Self-service check-in kiosk with portrait screen, card reader and tag printer. */
function selfKiosk(): Part[] {
  return [
    box([0.62, 0.04, 0.5], [0, 0.02, 0], 'stainless'),
    box([0.5, 1.0, 0.36], [0, 0.52, -0.02], 'lacquerWhite'),
    box([0.52, 0.06, 0.4], [0, 1.03, 0], 'lacquerBlue'),
    box([0.52, 0.78, 0.1], [0, 1.45, -0.08], 'lacquerWhite', [-0.18, 0, 0]),
    box([0.42, 0.62, 0.01], [0, 1.46, -0.02], 'kiosk', [-0.18, 0, 0]),
    box([0.2, 0.08, 0.12], [-0.12, 1.08, 0.13], 'black'),
    box([0.14, 0.02, 0.01], [0.12, 0.9, 0.17], 'black'),
    box([0.08, 0.04, 0.005], [-0.12, 1.12, 0.19], 'screenGreen'),
    box([0.46, 0.02, 0.02], [0, 1.86, -0.15], 'ledBlue'),
  ]
}
function kioskBank(): Part[] {
  const out: Part[] = []
  for (let i = 0; i < 4; i++) out.push(...place(selfKiosk(), (i - 1.5) * 0.85, 0))
  out.push(...place(person(AGENT[1]), 2.1, 0.5, -0.6))
  out.push(box([3.6, 0.5, 0.06], [0, 2.4, -0.2], 'sgnCheckin'), cyl([0.04, 0.6, 0.04], [-1.6, 2.85, -0.2], 'chrome'), cyl([0.04, 0.6, 0.04], [1.6, 2.85, -0.2], 'chrome'))
  return out
}

/** Departures wall: three 86" panels in a lit frame on a lacquered pylon. */
function departuresWall(): Part[] {
  const out: Part[] = [
    box([1.0, 0.06, 0.8], [0, 0.03, 0], 'stainless'),
    box([0.7, 2.4, 0.5], [0, 1.2, 0], 'lacquerBlue'),
    box([0.72, 0.03, 0.52], [0, 2.4, 0], 'led'),
    box([6.4, 1.5, 0.3], [0, 3.25, 0], 'black'),
    box([6.6, 0.25, 0.4], [0, 4.13, 0], 'navy'),
    box([6.0, 0.22, 0.02], [0, 4.13, 0.21], 'sgnDepartures'),
    box([6.6, 0.03, 0.03], [0, 2.48, 0.17], 'led'),
  ]
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 2.1
    out.push(box([2.0, 1.05, 0.02], [x, 3.25, 0.16], i === 2 ? 'fidsArr' : 'fids'))
    out.push(box([2.0, 1.05, 0.02], [x, 3.25, -0.16], 'fids', [0, Math.PI, 0]))
  }
  return out
}

/** Gate pylon: lit gate number cube on a tall post, visible across the pier. */
function gatePylon(sign = 'sgnGateA12'): Part[] {
  return [
    box([0.5, 0.05, 0.5], [0, 0.025, 0], 'stainless'),
    cyl([0.16, 3.4, 0.16], [0, 1.75, 0], 'darkSteel'),
    box([1.3, 0.75, 0.9], [0, 3.85, 0], 'signDark'),
    box([1.2, 0.62, 0.02], [0, 3.85, 0.46], sign),
    box([1.2, 0.62, 0.02], [0, 3.85, -0.46], sign, [0, Math.PI, 0]),
    box([0.02, 0.62, 0.8], [0.66, 3.85, 0], 'signYellow'),
    box([0.02, 0.62, 0.8], [-0.66, 3.85, 0], 'signYellow'),
    box([1.32, 0.03, 0.92], [0, 3.46, 0], 'led'),
  ]
}

/**
 * Apron-drive jet bridge, +Z = aircraft end. Rotunda at the origin (meets the
 * gate-room wall), two telescoping tunnels, cab with bellows canopy, drive
 * column with bogie wheels and a service stair. About 18 m long.
 */
function jetBridge(): Part[] {
  const fy = 3.6 // floor height at the rotunda
  const out: Part[] = [
    // rotunda + its column
    cyl([3.6, 3.0, 3.6], [0, fy + 1.4, 0], 'corrugated'),
    cyl([3.8, 0.2, 3.8], [0, fy + 3.0, 0], 'lacquerWhite'),
    cyl([0.7, fy, 0.7], [0, fy / 2, 0], 'lacquerWhite'),
    cyl([1.4, 0.15, 1.4], [0, 0.08, 0], 'apronConcrete'),
    box([1.15, 2.05, 0.08], [0, fy + 1.15, 1.72], 'intJet'),
    box([0.9, 1.7, 0.02], [0, fy + 1.1, 1.77], 'darkSteel'),
  ]
  // tunnels: A (outer, larger) then B (inner telescoping), sloping down 0.4 m
  const segs: [number, number, number, number][] = [[1.6, 8.4, 2.9, 2.8], [8.6, 14.6, 2.7, 2.6]]
  const slope = -0.4 / 14
  for (const [z0, z1, w, h] of segs) {
    const L = z1 - z0, zc = (z0 + z1) / 2, y = fy + 1.4 + zc * slope
    const tilt = -Math.atan(slope)
    const deck = y - h / 2
    // Open top so the hall camera reads the runner. Walls keep the silhouette.
    out.push(box([w, 0.1, L], [0, deck + 0.05, zc], 'darkSteel', [tilt, 0, 0]))
    out.push(box([0.1, h * 0.9, L], [w / 2 - 0.05, y, zc], 'corrugated', [tilt, 0, 0]))
    out.push(box([0.1, h * 0.9, L], [-(w / 2 - 0.05), y, zc], 'corrugated', [tilt, 0, 0]))
    out.push(box([0.14, 0.08, L], [w / 2 - 0.07, y + h * 0.42, zc], 'lacquerWhite', [tilt, 0, 0]))
    out.push(box([0.14, 0.08, L], [-(w / 2 - 0.07), y + h * 0.42, zc], 'lacquerWhite', [tilt, 0, 0]))
    out.push(box([1.15, 0.03, L - 0.25], [0, deck + 0.12, zc], 'intRunner', [tilt, 0, 0]))
    out.push(
      ...markNear([
        box([0.04, 0.05, L - 0.5], [w / 2 - 0.32, deck + 0.9, zc], 'chrome', [tilt, 0, 0]),
        box([0.04, 0.05, L - 0.5], [-(w / 2 - 0.32), deck + 0.9, zc], 'chrome', [tilt, 0, 0]),
      ]),
    )
    out.push(box([0.05, h * 0.55, 0.08], [w / 2 + 0.02, y + 0.05, zc - L * 0.28], 'intJet', [tilt, 0, 0]))
    out.push(box([0.05, h * 0.55, 0.08], [-w / 2 - 0.02, y + 0.05, zc - L * 0.28], 'intJet', [tilt, 0, 0]))
    out.push(box([0.02, 0.7, L - 0.8], [w / 2 + 0.02, y + 0.15, zc], 'jbGlass', [tilt, 0, 0]))
    out.push(box([0.02, 0.7, L - 0.8], [-(w / 2 + 0.02), y + 0.15, zc], 'jbGlass', [tilt, 0, 0]))
    out.push(box([0.03, 0.05, L], [w / 2 + 0.04, deck + 0.35, zc], 'hatchBlue', [tilt, 0, 0]))
    out.push(box([0.03, 0.05, L], [-(w / 2 + 0.04), deck + 0.35, zc], 'hatchBlue', [tilt, 0, 0]))
  }
  // Cab is open on top. The aircraft door closes the far end of the runner.
  const cz = 16.0, cy = fy + 1.0
  const deck = cy - 1.28
  out.push(
    box([3.2, 0.1, 2.5], [0, deck, cz], 'darkSteel'),
    box([0.12, 2.4, 2.5], [1.54, cy - 0.05, cz], 'lacquerWhite'),
    box([0.12, 2.4, 2.5], [-1.54, cy - 0.05, cz], 'lacquerWhite'),
    box([3.05, 2.4, 0.1], [0, cy - 0.05, cz - 1.2], 'lacquerWhite'),
    box([1.15, 0.03, 2.0], [0, deck + 0.08, cz], 'intRunner'),
    box([1.55, 2.1, 0.08], [0, deck + 1.1, cz + 1.12], 'jbDoor'),
    box([0.48, 0.36, 0.02], [0.05, deck + 1.45, cz + 1.17], 'jbGlass'),
    box([0.08, 0.18, 0.05], [0.52, deck + 1.05, cz + 1.17], 'chrome'),
    box([1.9, 0.08, 0.08], [0, deck + 2.16, cz + 1.12], 'brushed'),
    box([3.0, 2.3, 0.4], [0, cy, cz + 1.48], 'bellows'),
    box([3.15, 0.12, 0.45], [0, cy + 1.2, cz + 1.55], 'bellows'),
    box([0.02, 0.85, 1.5], [1.62, cy + 0.15, cz], 'jbGlass'),
    box([0.02, 0.85, 1.5], [-1.62, cy + 0.15, cz], 'jbGlass'),
    box([1.6, 0.3, 0.02], [0, cy + 0.95, cz - 1.16], 'sgnGateA12'),
    box([0.3, 0.12, 0.12], [1.4, cy + 1.25, cz + 0.7], 'amber'),
    box([2.8, 0.05, 0.05], [0, deck + 0.04, cz + 1.05], 'ledWarm'),
  )
  // drive column (wheel bogie) under tunnel B
  const dz = 12.6, dy = fy + 1.4 + dz * slope - 1.4
  out.push(
    box([0.5, dy - 0.7, 0.5], [-0.6, (dy - 0.7) / 2 + 0.7, dz], 'darkSteel'),
    box([0.5, dy - 0.7, 0.5], [0.6, (dy - 0.7) / 2 + 0.7, dz], 'darkSteel'),
    box([2.4, 0.4, 0.9], [0, 0.75, dz], 'signYellow'),
    box([1.6, 0.18, 0.7], [0, dy - 0.05, dz], 'darkSteel'),
  )
  for (const x of [-0.9, 0.9]) out.push(cyl([0.9, 0.45, 0.9], [x, 0.45, dz], 'rubber', [0, 0, H]), cyl([0.5, 0.47, 0.5], [x, 0.45, dz], 'steel', [0, 0, H]))
  // hydraulic rams
  for (const x of [-0.6, 0.6]) out.push(cyl([0.12, dy - 0.8, 0.12], [x, (dy - 0.8) / 2 + 0.8, dz + 0.4], 'chrome'))
  // service stair from cab to apron
  const sx = 2.3
  for (let i = 0; i < 12; i++) out.push(box([0.9, 0.04, 0.28], [sx, 0.2 + i * 0.36, cz - 3.4 + i * 0.27], 'plate'))
  out.push(box([0.05, 4.6, 0.05], [sx + 0.45, 2.6, cz - 1.0], 'signYellow'), box([0.05, 0.05, 3.4], [sx + 0.45, 3.0, cz - 1.8], 'signYellow', [-0.92, 0, 0]))
  out.push(box([1.0, 0.06, 1.0], [sx, cy - 1.3, cz - 0.1], 'plate'))
  return out
}


// ---------- round 3: security + retail detail ----------
/** Millimetre-wave body scanner: two curved glass pods on a plinth, hands-up floor marks, operator screen. */
function bodyScanner(): Part[] {
  const out: Part[] = [
    box([2.0, 0.06, 1.7], [0, 0.03, 0], 'lacquerWhite'),
    box([1.9, 0.01, 1.6], [0, 0.065, 0], 'rubber'),
    box([0.34, 0.02, 0.5], [-0.25, 0.08, 0], 'signYellow', [0, 0.25, 0]),
    box([0.34, 0.02, 0.5], [0.25, 0.08, 0], 'signYellow', [0, -0.25, 0]),
    box([2.0, 0.22, 1.7], [0, 2.3, 0], 'lacquerWhite'),
    box([1.9, 0.03, 1.6], [0, 2.18, 0], 'led'),
    box([1.2, 0.18, 0.02], [0, 2.3, 0.86], 'lacquerBlue'),
  ]
  // curved pods: 7 facets per side
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a = (-0.75 + (i / 6) * 1.5)
      const x = side * Math.cos(a) * 0.85, z = Math.sin(a) * 0.75
      out.push(box([0.06, 2.1, 0.24], [x, 1.12, z], i === 0 || i === 6 ? 'lacquerWhite' : 'glassTint', [0, -side * a, 0]))
    }
    out.push(box([0.12, 2.1, 0.12], [side * 0.62, 1.12, 0.62], 'stainless'), box([0.12, 2.1, 0.12], [side * 0.62, 1.12, -0.62], 'stainless'))
    out.push(box([0.02, 1.6, 0.02], [side * 0.78, 1.1, 0], 'ledBlue'))
  }
  out.push(cyl([0.08, 1.2, 0.08], [1.25, 0.6, 0.7], 'stainless'), box([0.4, 0.3, 0.05], [1.25, 1.35, 0.7], 'black', [-0.4, 0, 0]), box([0.36, 0.26, 0.01], [1.25, 1.36, 0.73], 'screenGreen', [-0.4, 0, 0]))
  return out
}

/** Divest station: stainless counter with powered rollers, tray dispenser and number light. */
function divestStation(n: number): Part[] {
  const out: Part[] = [
    box([1.2, 0.8, 0.8], [0, 0.4, 0], 'stainless'),
    box([1.24, 0.04, 0.84], [0, 0.82, 0], 'brushed'),
    box([0.24, 0.24, 0.02], [0, 1.5, 0.4], n % 2 ? 'screenGreen' : 'ledBlue'),
    cyl([0.04, 0.7, 0.04], [0, 1.15, 0.38], 'chrome'),
  ]
  for (let i = 0; i < 8; i++) out.push(cyl([0.05, 0.7, 0.05], [-0.52 + i * 0.15, 0.87, 0], 'chrome', [H, 0, 0]))
  for (let k = 0; k < 3; k++) out.push(box([0.6, 0.07, 0.42], [0, 0.95 + k * 0.075, 0], 'tray'))
  return out
}

/** Automated tray return lane (ATRS) with CT scanner gantry, 4 divest stations, reject line, recompose bench. */
function securityLaneCT(): Part[] {
  const out: Part[] = [box([16.2, 0.012, 7.4], [-0.4, 0.004, 0.4], 'intRubber')]
  for (let i = 0; i < 4; i++) out.push(...place(divestStation(i), -6.4 + i * 1.3, 0))
  // CT scanner: deep housing with ring gantry face and lead curtains
  out.push(box([2.6, 1.7, 1.4], [-0.6, 0.85, 0], 'lacquerWhite'), box([2.64, 0.12, 1.44], [-0.6, 1.76, 0], 'lacquerBlue'))
  out.push(part('torus', [1.5, 1.5, 0.8], [-1.92, 0.95, 0], 'stainless', [0, H, 0]))
  for (let i = 0; i < 6; i++) {
    out.push(box([0.02, 0.6, 0.14], [-1.93, 0.98, -0.35 + i * 0.14], 'rubber'))
    out.push(box([0.02, 0.6, 0.14], [0.72, 0.98, -0.35 + i * 0.14], 'rubber'))
  }
  out.push(box([2.6, 0.04, 0.72], [-0.6, 0.76, 0], 'belt'), box([0.8, 0.06, 0.06], [-0.6, 1.83, 0.6], 'screenGreen'))
  // out-feed rollers splitting to reject (lower) and clear lines
  out.push(box([3.4, 0.08, 0.72], [2.5, 0.78, 0], 'steel'))
  for (let i = 0; i < 22; i++) out.push(cyl([0.05, 0.66, 0.05], [0.9 + i * 0.15, 0.83, 0], 'chrome', [H, 0, 0]))
  out.push(box([2.2, 0.08, 0.72], [2.0, 0.78, -0.95], 'steel'), box([2.2, 0.7, 0.04], [2.0, 0.4, -1.3], 'red'))
  out.push(box([1.0, 0.75, 0.6], [3.4, 0.38, -2.0], 'stainless'), box([1.04, 0.03, 0.64], [3.4, 0.77, -2.0], 'granite'), ...place(monitor(0.5, 0.32), 3.4, -2.1, 0, 1.05))
  // recompose bench + tray return under the lane
  out.push(box([2.6, 0.45, 0.5], [5.2, 0.23, 1.2], 'oak'), box([2.6, 0.06, 0.6], [5.2, 0.46, 1.2], 'lacquerBlue'))
  out.push(box([12.4, 0.32, 0.5], [-0.5, 0.17, -0.55], 'darkSteel'), box([12.4, 0.03, 0.44], [-0.5, 0.34, -0.55], 'belt'))
  for (const x of [-5, -2, 1.5, 4]) out.push(box([0.6, 0.07, 0.42], [x, 0.39, -0.55], 'tray'))
  // trays with bags in flight
  // in-flight trays are animated (MOVING_TRAYS); one held on the reject line
  out.push(box([0.6, 0.1, 0.42], [2.0, 0.9, -0.95], 'tray'), box([0.42, 0.16, 0.28], [2.0, 1.02, -0.95], 'navy'))
  // officers: divest helpers, CT operator at reject, scanner + arch officers
  out.push(...place(person(OFFICER), -5.8, 1.0, Math.PI), ...place(person(OFFICER), -3.2, 1.0, Math.PI))
  out.push(...place(person(OFFICER, { arms: 'forward' }), 3.4, -2.55))
  out.push(...place(person(OFFICER, { arms: 'forward' }), -1.0, 1.35, Math.PI))
  out.push(...place(person(OFFICER), 1.4, 3.15, -H))
  // people side: body scanner + arch, glass screens, lane light
  out.push(...place(bodyScanner(), -1.0, 2.4))
  out.push(...place(archDetector(), 1.4, 2.4))
  out.push(box([0.3, 2.4, 0.3], [-7.3, 1.2, 1.4], 'lacquerBlue'), box([0.32, 0.4, 0.02], [-7.3, 2.1, 1.56], 'screenGreen'))
  for (const z of [-2.6, 3.6]) {
    out.push(box([14.4, 1.1, 0.03], [-0.6, 0.65, z], 'glass'), box([14.4, 0.05, 0.06], [-0.6, 1.22, z], 'chrome'))
    for (let x = -7.6; x <= 6.6; x += 2.4) out.push(cyl([0.05, 1.2, 0.05], [x, 0.6, z], 'chrome'))
  }
  return out
}

/** Specialty coffee counter: espresso machine with group heads, grinders, tiered pastry case, till, menu boards. */
function cafeCounter(): Part[] {
  const out: Part[] = [
    box([4.4, 1.0, 0.75], [0, 0.5, 0], 'brushed'),
    box([4.46, 0.05, 0.82], [0, 1.03, 0], 'granite'),
    box([4.4, 0.1, 0.02], [0, 0.07, 0.38], 'ledWarm'),
    ...Array.from({ length: 11 }, (_, i) => box([0.06, 0.86, 0.03], [-2.0 + i * 0.4, 0.5, 0.385], 'oakSlat')),
    // espresso machine
    box([1.0, 0.45, 0.55], [-0.8, 1.28, -0.05], 'stainless'),
    box([1.0, 0.06, 0.55], [-0.8, 1.53, -0.05], 'chrome'),
    box([0.9, 0.12, 0.02], [-0.8, 1.4, 0.23], 'lacquerBlue'),
  ]
  for (let i = 0; i < 3; i++) out.push(cyl([0.08, 0.1, 0.08], [-1.1 + i * 0.3, 1.1, 0.18], 'chrome'), cyl([0.07, 0.08, 0.07], [-1.1 + i * 0.3, 1.09, 0.32], 'cup'))
  for (const x of [-1.6, 0.0]) out.push(cyl([0.18, 0.3, 0.18], [x, 1.25, -0.1], 'darkSteel'), part('cone', [0.2, 0.25, 0.2], [x, 1.53, -0.1], 'glassTint', [Math.PI, 0, 0]))
  // pastry case: 3 lit tiers behind curved glass
  out.push(box([1.4, 0.55, 0.6], [1.3, 1.33, 0.02], 'glass'), box([1.4, 0.02, 0.6], [1.3, 1.6, 0.02], 'ledWarm'))
  for (let k = 0; k < 2; k++) {
    out.push(box([1.3, 0.02, 0.5], [1.3, 1.1 + k * 0.22, 0], 'chrome'))
    for (let i = 0; i < 5; i++) out.push(part('sphere', [0.16, 0.08, 0.14], [0.8 + i * 0.25, 1.15 + k * 0.22, 0], k ? 'bun' : 'goodsD'))
  }
  out.push(box([0.35, 0.25, 0.3], [2.0, 1.18, 0.15], 'black'), box([0.28, 0.18, 0.01], [2.0, 1.33, 0.25], 'screen', [-0.4, 0, 0]))
  // back bar: shelves of cups + three menu boards + pendants
  out.push(box([4.4, 2.6, 0.12], [0, 1.3, -1.2], 'oakSlat'), box([4.3, 0.04, 0.3], [0, 1.6, -1.08], 'oak'), box([4.3, 0.04, 0.3], [0, 1.95, -1.08], 'oak'))
  for (let i = 0; i < 12; i++) out.push(cyl([0.09, 0.11, 0.09], [-2.0 + i * 0.36, 1.68, -1.06], i % 3 ? 'cup' : 'goodsD'))
  for (let i = 0; i < 3; i++) out.push(box([1.3, 0.75, 0.04], [-1.4 + i * 1.4, 2.6, -1.12], 'black'), box([1.2, 0.66, 0.01], [-1.4 + i * 1.4, 2.6, -1.09], i === 1 ? 'lbCoffee' : 'sgnCoffee'))
  for (const x of [-1.5, 0, 1.5]) out.push(cyl([0.01, 0.9, 0.01], [x, 3.25, 0], 'black'), part('cone', [0.32, 0.26, 0.32], [x, 2.7, 0], 'black'), cyl([0.12, 0.02, 0.12], [x, 2.57, 0], 'ledWarm'))
  return out
}

/** Double-sided retail gondola with end cap, price strips and stocked shelves. */
function gondola(goods: string[] = ['goodsA', 'goodsB', 'goodsC', 'goodsD']): Part[] {
  const L = 2.4
  const out: Part[] = [
    box([L, 0.12, 0.9], [0, 0.06, 0], 'black'),
    box([L, 1.6, 0.06], [0, 0.9, 0], 'lacquerWhite'),
    box([0.08, 1.7, 0.95], [-L / 2, 0.85, 0], 'black'),
    box([0.08, 1.7, 0.95], [L / 2, 0.85, 0], 'black'),
    box([L + 0.1, 0.18, 0.95], [0, 1.78, 0], 'lacquerBlue'),
  ]
  for (const zs of [1, -1])
    for (let k = 0; k < 4; k++) {
      const y = 0.3 + k * 0.4
      out.push(box([L - 0.1, 0.03, 0.4], [0, y, zs * 0.24], 'chrome'), box([L - 0.1, 0.04, 0.01], [0, y - 0.02, zs * 0.445], 'led'))
      for (let i = 0; i < 7; i++) {
        const m = goods[(i + k) % goods.length]
        const tall = m === 'bottle'
        out.push(tall ? cyl([0.09, 0.28, 0.09], [-1.0 + i * 0.33, y + 0.15, zs * 0.26], m) : box([0.26, 0.22, 0.28], [-1.0 + i * 0.33, y + 0.13, zs * 0.25], m))
      }
    }
  return out
}

/** Island coffee kiosk with canopy, menu board and stools (the plan's shop kiosk). */
function shopKiosk(): Part[] {
  return [
    box([2.2, 1.0, 1.2], [0, 0.5, 0], 'walnut'),
    box([2.3, 0.05, 1.3], [0, 1.03, 0], 'granite'),
    box([2.2, 0.08, 0.02], [0, 0.07, 0.61], 'ledWarm'),
    box([0.6, 0.4, 0.45], [-0.5, 1.25, -0.2], 'stainless'),
    box([0.6, 0.35, 0.45], [0.55, 1.23, 0], 'glass'),
    cyl([0.08, 1.6, 0.08], [-1.0, 1.85, -0.5], 'darkSteel'),
    cyl([0.08, 1.6, 0.08], [1.0, 1.85, -0.5], 'darkSteel'),
    box([2.5, 0.12, 1.6], [0, 2.7, 0], 'walnut'),
    box([1.4, 0.4, 0.04], [0, 2.95, 0.6], 'sgnCoffee'),
    ...[-0.6, 0.6].flatMap((x) => [cyl([0.36, 0.04, 0.36], [x, 0.75, 0.95], 'leather'), cyl([0.05, 0.75, 0.05], [x, 0.38, 0.95], 'chrome')]),
  ]
}

/** Single check-in desk (for the in-game plan's per-desk counters). */
function checkinDeskSingle(): Part[] {
  return [...checkinDesk(0), box([1.7, 2.6, 0.12], [0, 1.3, -0.75], 'cream'), box([1.2, 0.36, 0.03], [0, 2.3, -0.68], 'logo0'), box([1.7, 0.04, 0.05], [0, 2.62, -0.68], 'led')]
}

/** Food-court stall sized to the plan kiosk. `sign` is a generic menu band, not a brand. */
function menuCounter(sign: string): Part[] {
  return [
    box([1.08, 0.92, 0.5], [0, 0.46, 0], 'intWood'),
    box([1.12, 0.045, 0.56], [0, 0.94, 0.02], 'granite'),
    box([0.86, 0.38, 0.02], [0, 1.26, 0.2], sign),
    box([0.9, 0.035, 0.02], [0, 1.48, 0.2], 'ledWarm'),
    box([0.96, 0.2, 0.015], [0, 0.7, 0.255], 'glass'),
    box([0.14, 0.1, 0.1], [0.32, 1.02, 0.04], 'stainless'),
  ]
}

/** One tiled stall that fits the plan restroom block. */
function restroomStall(): Part[] {
  return [
    box([1.22, 1.9, 0.05], [0, 0.98, -0.28], 'intTile'),
    box([0.05, 1.9, 0.58], [-0.6, 0.98, 0], 'intTile'),
    box([0.05, 1.9, 0.58], [0.6, 0.98, 0], 'intTile'),
    box([0.52, 1.55, 0.035], [-0.28, 0.85, 0.26], 'intStall'),
    box([0.52, 1.55, 0.035], [0.28, 0.85, 0.26], 'intStall'),
    box([1.15, 0.02, 0.55], [0, 0.01, 0], 'intRestroomFloor'),
    box([0.7, 0.06, 0.22], [0, 0.86, -0.16], 'granite'),
    cyl([0.22, 0.08, 0.18], [-0.18, 0.9, -0.14], 'porcelain'),
    cyl([0.03, 0.14, 0.03], [-0.18, 1.02, -0.2], 'chrome'),
    box([0.5, 0.28, 0.015], [0, 1.32, -0.25], 'mirror'),
    box([0.42, 0.16, 0.02], [0, 1.72, 0.28], 'sgnWC'),
  ]
}

function sofa(len: number): Part[] {
  return [
    box([len, 0.32, 0.7], [0, 0.28, 0], 'seatGrey'),
    box([len, 0.4, 0.1], [0, 0.56, -0.3], 'seatGrey'),
    box([0.1, 0.32, 0.7], [-len / 2, 0.4, 0], 'seatBlue'),
    box([0.1, 0.32, 0.7], [len / 2, 0.4, 0], 'seatBlue'),
    ...markNear([
      box([len * 0.4, 0.07, 0.4], [-len * 0.22, 0.47, 0.02], 'leather'),
      box([len * 0.4, 0.07, 0.4], [len * 0.22, 0.47, 0.02], 'leather'),
    ]),
  ]
}

function armchair(): Part[] {
  return [
    box([0.68, 0.3, 0.66], [0, 0.26, 0], 'seatBlue'),
    box([0.68, 0.36, 0.08], [0, 0.5, -0.28], 'seatBlue'),
    box([0.08, 0.28, 0.66], [-0.32, 0.36, 0], 'intWood'),
    box([0.08, 0.28, 0.66], [0.32, 0.36, 0], 'intWood'),
    ...markNear([box([0.46, 0.06, 0.4], [0, 0.44, 0.02], 'leather')]),
  ]
}

/** Lounge seating for the airside room. Carpet, sofas, chairs, a wood screen. */
function loungeCluster(): Part[] {
  return [
    box([4.4, 0.015, 3.2], [0, 0.008, 0], 'intWood'),
    ...place(sofa(1.8), -0.85, -0.85),
    ...place(sofa(1.5), 0.85, 0.7, Math.PI),
    ...place(armchair(), -1.55, 0.55, 0.5),
    ...place(armchair(), 1.45, -0.45, -0.6),
    box([0.85, 0.04, 0.5], [0, 0.4, 0], 'intWood'),
    cyl([0.08, 0.38, 0.08], [0, 0.19, 0], 'intWood'),
    ...markNear([cyl([0.1, 0.14, 0.1], [0.18, 0.49, 0.04], 'lamp'), box([0.16, 0.02, 0.12], [-0.16, 0.43, 0.06], 'goodsD')]),
    box([0.1, 1.45, 1.5], [2.05, 0.75, 0], 'intWood'),
    ...place(plant(0.8, 'walnut'), -1.9, -1.25),
  ]
}

/** Cubicle bay for the staff office. Desks in the plan stay where they are. */
function staffOffice(): Part[] {
  const out: Part[] = [box([4.2, 0.015, 3.2], [0, 0.008, 0], 'intCarpet')]
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.35
    out.push(
      box([1.2, 1.15, 0.05], [x, 0.7, -0.95], 'intOffice'),
      box([1.1, 0.72, 0.58], [x, 0.36, -0.45], 'intWood'),
      box([1.14, 0.03, 0.62], [x, 0.74, -0.45], 'corian'),
      ...place(monitor(0.4, 0.24), x, -0.55, 0, 0.95),
      ...place(chair('seatGrey'), x, 0.2, Math.PI),
    )
  }
  out.push(...place(plant(0.65), 1.7, 1.15))
  return out
}

/** Arrivals / check-in wayfinding totem. */
function arrivalsSign(): Part[] {
  return [
    box([0.9, 0.04, 0.28], [0, 0.02, 0], 'brushed'),
    box([0.78, 2.55, 0.18], [0, 1.3, 0], 'signDark'),
    box([0.68, 0.38, 0.02], [0, 2.25, 0.1], 'sgnArrivals'),
    box([0.68, 0.34, 0.02], [0, 1.82, 0.1], 'sgnCheckin'),
    box([0.68, 0.34, 0.02], [0, 1.4, 0.1], 'sgnBags'),
    box([0.68, 0.34, 0.02], [0, 0.98, 0.1], 'sgnExit'),
    box([0.64, 0.26, 0.02], [0, 0.55, 0.1], 'screen'),
  ]
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
  'shop_gadget',
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
  'self_checkin_kiosk',
  'kiosk_bank',
  'departures_wall',
  'gate_pylon',
  'jet_bridge',
  'body_scanner',
  'security_lane_ct',
  'divest_station',
  'cafe_counter',
  'shop_gondola',
  'shop_kiosk',
  'checkin_desk',
  'menu_counter',
  'menu_noodle',
  'menu_brew',
  'menu_grab',
  'restroom_stall',
  'lounge_cluster',
  'staff_office',
  'arrivals_sign',
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
  shop_gadget: shopGadget,
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
  self_checkin_kiosk: selfKiosk,
  kiosk_bank: kioskBank,
  departures_wall: departuresWall,
  gate_pylon: () => gatePylon(),
  jet_bridge: jetBridge,
  body_scanner: bodyScanner,
  security_lane_ct: securityLaneCT,
  divest_station: () => divestStation(0),
  cafe_counter: cafeCounter,
  shop_gondola: () => gondola(),
  shop_kiosk: shopKiosk,
  checkin_desk: checkinDeskSingle,
  menu_counter: () => menuCounter('sgnGrill'),
  menu_noodle: () => menuCounter('sgnNoodle'),
  menu_brew: () => menuCounter('sgnBrew'),
  menu_grab: () => menuCounter('sgnGrab'),
  restroom_stall: restroomStall,
  lounge_cluster: loungeCluster,
  staff_office: staffOffice,
  arrivals_sign: arrivalsSign,
}

/**
 * Animated tray tracks in prop-local metres: trays slide x0 → x1 at belt
 * height y on line z, `n` trays evenly spaced, `speed` m/s.
 */
export interface TrayTrack { x0: number; x1: number; y: number; z: number; n: number; speed: number }
export const MOVING_TRAYS: Partial<Record<TerminalPropType, TrayTrack[]>> = {
  xray_machine: [{ x0: -3.0, x1: 3.2, y: 0.85, z: 0, n: 5, speed: 0.35 }],
  security_lane: [
    { x0: -3.0, x1: 3.2, y: 0.85, z: 0, n: 5, speed: 0.35 },
    { x0: 4.2, x1: -4.2, y: 0.39, z: -0.7, n: 4, speed: 0.5 },
  ],
  security_lane_ct: [
    { x0: -6.8, x1: 4.0, y: 0.9, z: 0, n: 7, speed: 0.4 },
    { x0: 5.5, x1: -6.4, y: 0.39, z: -0.55, n: 5, speed: 0.55 },
  ],
}
