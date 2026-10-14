/**
 * Shared builders for the vehicle bakeoff.
 * Metres, Y up, front is +X, wheels rest on y = 0.
 * Every mesh is constructed as `new Mesh(geometry, material)`.
 * Wheel cylinders use `rotateX(Math.PI / 2)` so the end caps face ±Z (outward).
 * Lengthwise cylinders use `rotateZ(Math.PI / 2)` so their caps face ±X (outward).
 */
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  CylinderGeometry,
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  ExtrudeGeometry,
  Shape,
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  DoubleSide,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  white: '#f4f5f3',
  cab: '#f7f7f5',
  tank: '#e4e7ea',
  gray: '#c5c9ce',
  grayMid: '#9aa3ab',
  grayDark: '#6a737c',
  skirt: '#b7bcc2',
  chassis: '#2b3036',
  black: '#17191c',
  tyre: '#24272b',
  rim: '#d5dbe1',
  hub: '#5e676f',
  glass: '#243238',
  mirror: '#c5d2da',
  yellow: '#f0c218',
  red: '#d10e16',
  amber: '#ff9a14',
  head: '#fff4cc',
  orange: '#e36f12',
  hose: '#e4c43a',
  steel: '#a0a8b0',
  steelDark: '#6e777f',
  seat: '#1b1e22',
  blue: '#2f5f8f',
  text: '#1c1e21',
  muted: '#5c656e',
  shuttle: '#8b939b',
};

const cache = new Map();

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

export function paint(hex, opts = {}) {
  const key = `p|${hex}|${opts.rough ?? ''}|${opts.metal ?? ''}|${opts.coat ?? ''}`;
  return cached(key, () => new MeshPhysicalMaterial({
    color: hex,
    roughness: opts.rough ?? 0.42,
    metalness: opts.metal ?? 0.05,
    clearcoat: opts.coat ?? 0.4,
    clearcoatRoughness: opts.coatRough ?? 0.34,
  }));
}

export function std(hex, opts = {}) {
  const key = `s|${hex}|${opts.rough ?? ''}|${opts.metal ?? ''}|${opts.emissive ?? ''}|${opts.ei ?? ''}`;
  return cached(key, () => new MeshStandardMaterial({
    color: hex,
    roughness: opts.rough ?? 0.55,
    metalness: opts.metal ?? 0.04,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.ei ?? (opts.emissive ? 1 : 0),
  }));
}

export const MAT = {
  get cab() { return paint(C.cab, { rough: 0.4, coat: 0.5 }); },
  get white() { return paint(C.white, { rough: 0.43, coat: 0.42 }); },
  get tank() { return paint(C.tank, { rough: 0.48, metal: 0.18, coat: 0.35, coatRough: 0.4 }); },
  get gray() { return paint(C.gray, { rough: 0.5, coat: 0.25 }); },
  get grayMid() { return paint(C.grayMid, { rough: 0.48, metal: 0.08, coat: 0.3 }); },
  get grayDark() { return paint(C.grayDark, { rough: 0.5, metal: 0.12, coat: 0.2 }); },
  get skirt() { return paint(C.skirt, { rough: 0.55, coat: 0.2 }); },
  get chassis() { return std(C.chassis, { rough: 0.72, metal: 0.35 }); },
  get black() { return std(C.black, { rough: 0.55, metal: 0.15 }); },
  get steel() { return std(C.steel, { rough: 0.38, metal: 0.72 }); },
  get steelDark() { return std(C.steelDark, { rough: 0.42, metal: 0.6 }); },
  get tyre() { return std(C.tyre, { rough: 0.96, metal: 0 }); },
  get rim() { return std(C.rim, { rough: 0.32, metal: 0.82 }); },
  get hub() { return std(C.hub, { rough: 0.4, metal: 0.7 }); },
  get glass() { return std(C.glass, { rough: 0.08, metal: 0.55 }); },
  get mirror() { return std(C.mirror, { rough: 0.08, metal: 0.9 }); },
  get hose() { return std(C.hose, { rough: 0.7, metal: 0.02 }); },
  get seat() { return std(C.seat, { rough: 0.85, metal: 0 }); },
  get yellow() { return paint(C.yellow, { rough: 0.45, coat: 0.3 }); },
  get red() { return paint(C.red, { rough: 0.4, coat: 0.35 }); },
  get orange() { return paint(C.orange, { rough: 0.45, coat: 0.25 }); },
  get head() { return std(C.head, { rough: 0.2, metal: 0.05, emissive: '#fff1b8', ei: 1.35 }); },
  get tail() { return std(C.red, { rough: 0.28, metal: 0.05, emissive: '#ff2218', ei: 0.85 }); },
  get amber() { return std(C.amber, { rough: 0.28, metal: 0.05, emissive: '#ff8a00', ei: 0.95 }); },
  get blueLite() { return std('#2a6cff', { rough: 0.3, emissive: '#1a4cff', ei: 0.7 }); },
};

export function paintCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

let hazardBase;
function hazardTexture() {
  if (hazardBase !== undefined) return hazardBase;
  hazardBase = paintCanvas(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2c31a';
    const stripe = 34;
    for (let x = -h; x < w + h; x += stripe * 2) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.lineTo(x + h + stripe, 0);
      ctx.lineTo(x + stripe, h);
      ctx.closePath();
      ctx.fill();
    }
  });
  if (hazardBase) {
    hazardBase.wrapS = RepeatWrapping;
    hazardBase.wrapT = RepeatWrapping;
  }
  return hazardBase;
}

export function hazardMaterial(repeats) {
  const src = hazardTexture();
  const map = src ? src.clone() : null;
  if (map) {
    map.repeat.set(repeats, 1);
    map.needsUpdate = true;
  }
  return new MeshStandardMaterial({
    map,
    color: map ? '#ffffff' : C.yellow,
    roughness: 0.58,
    metalness: 0.02,
  });
}

export function decalMaterial(draw, cw, ch, fallback = C.text) {
  const map = paintCanvas(cw, ch, draw);
  return new MeshStandardMaterial({
    map,
    color: map ? '#ffffff' : fallback,
    transparent: true,
    roughness: 0.62,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: DoubleSide,
  });
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

const FONT = '"Arial Black", Arial, "Liberation Sans", "DejaVu Sans", sans-serif';
const FONT_UI = 'Arial, "Liberation Sans", "DejaVu Sans", sans-serif';

export function fillSpaced(ctx, text, x, y, tracking) {
  if (!tracking) {
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cx = x;
  if (ctx.textAlign === 'center') cx = x - total / 2;
  else if (ctx.textAlign === 'right') cx = x - total;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + tracking;
  });
  ctx.textAlign = prev;
}

/** lines: { t, size, color, weight, font, tracking, align } */
export function textPainter(lines, bg) {
  return (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (bg) {
      ctx.fillStyle = bg;
      roundRect(ctx, 1, 1, w - 2, h - 2, Math.min(w, h) * 0.12);
      ctx.fill();
    }
    const n = lines.length;
    lines.forEach((ln, i) => {
      const size = ln.size ?? Math.floor(h / (n + 0.45));
      ctx.font = `${ln.weight ?? 700} ${size}px ${ln.font ?? FONT}`;
      ctx.fillStyle = ln.color ?? C.text;
      ctx.textAlign = ln.align ?? 'center';
      ctx.textBaseline = 'middle';
      const x = ctx.textAlign === 'left' ? w * 0.08 : ctx.textAlign === 'right' ? w * 0.92 : w / 2;
      const y = n === 1 ? h / 2 + (ln.dy ?? 0) : ((i + 0.5) / n) * h;
      fillSpaced(ctx, ln.t, x, y, ln.tracking ?? 0);
    });
  };
}

export function drawDiamond(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 4);
  const s = Math.min(w, h) * 0.6;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#e10600';
  ctx.lineWidth = Math.max(4, s * 0.08);
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  ctx.fillStyle = '#e10600';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.22);
  ctx.bezierCurveTo(w * 0.78, h * 0.48, w * 0.66, h * 0.62, w * 0.58, h * 0.78);
  ctx.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.42, h * 0.8);
  ctx.bezierCurveTo(w * 0.32, h * 0.58, w * 0.22, h * 0.46, w * 0.5, h * 0.22);
  ctx.fill();
}

export function drawSkyChefs(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const cy = h * 0.42;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = h * 0.11;
  ctx.strokeStyle = '#8b97a3';
  ctx.beginPath();
  ctx.moveTo(w * 0.03, cy - h * 0.2);
  ctx.lineTo(w * 0.11, cy + h * 0.02);
  ctx.lineTo(w * 0.03, cy + h * 0.24);
  ctx.stroke();
  ctx.strokeStyle = '#3d6e9c';
  ctx.beginPath();
  ctx.moveTo(w * 0.09, cy - h * 0.2);
  ctx.lineTo(w * 0.17, cy + h * 0.02);
  ctx.lineTo(w * 0.09, cy + h * 0.24);
  ctx.stroke();
  ctx.fillStyle = '#3a4652';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.floor(h * 0.28)}px ${FONT}`;
  ctx.fillText('SKY', w * 0.22, h * 0.32);
  ctx.fillText('CHEFS', w * 0.22, h * 0.6);
  ctx.fillStyle = '#8d96a0';
  ctx.font = `600 ${Math.floor(h * 0.16)}px ${FONT_UI}`;
  fillSpaced(ctx, 'CATERING', w * 0.22, h * 0.84, 2);
  ctx.textAlign = 'left';
}

export function drawJetTug(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const r = h * 0.36;
  const cx = h * 0.42;
  const cy = h * 0.5;
  ctx.strokeStyle = '#2c333a';
  ctx.lineWidth = h * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.4, Math.PI * 1.7);
  ctx.stroke();
  ctx.strokeStyle = '#2c333a';
  ctx.lineWidth = h * 0.045;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.2, cy);
  ctx.quadraticCurveTo(cx + r * 1.3, cy - r * 0.1, cx + r * 1.7, cy - r * 0.55);
  ctx.stroke();
  ctx.fillStyle = '#2c333a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.floor(h * 0.34)}px ${FONT}`;
  ctx.fillText('JET TUG', cx + r * 0.85, cy + h * 0.02);
}

export function drawGroundSupport(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#5c6770';
  ctx.lineWidth = h * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.02, h * 0.62);
  ctx.lineTo(w * 0.1, h * 0.38);
  ctx.lineTo(w * 0.18, h * 0.62);
  ctx.moveTo(w * 0.06, h * 0.5);
  ctx.lineTo(w * 0.14, h * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#5c6770';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.floor(h * 0.42)}px ${FONT_UI}`;
  ctx.fillText('GROUND', w * 0.24, h * 0.38);
  ctx.fillText('SUPPORT', w * 0.24, h * 0.72);
}

/** Bevelled side profile of a forward-control cab. Origin at mid-length, y = 0 at the floor. */
export function cabProfile(length, height) {
  const s = new Shape();
  const x0 = -length / 2;
  const x1 = length / 2;
  s.moveTo(x0, 0);
  s.lineTo(x1 - length * 0.04, 0);
  s.lineTo(x1, height * 0.12);
  s.lineTo(x1, height * 0.42);
  s.lineTo(x1 - length * 0.26, height * 0.98);
  s.lineTo(x0 + length * 0.06, height);
  s.lineTo(x0, height * 0.86);
  s.lineTo(x0, 0);
  return s;
}

function clampRadius(w, h, d, rad) {
  const m = Math.min(w, h, d);
  return Math.max(0.002, Math.min(rad ?? Math.min(0.08, m * 0.16), m * 0.48));
}

export class Rig {
  constructor(name) {
    this.group = new Group();
    this.group.name = name;
  }

  add(mesh, { shadow = true } = {}) {
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    this.group.add(mesh);
    return mesh;
  }

  rbox(w, h, d, x, y, z, mat, rad, segs = 3) {
    const geo = new RoundedBoxGeometry(w, h, d, segs, clampRadius(w, h, d, rad));
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return this.add(mesh);
  }

  box(w, h, d, x, y, z, mat, { shadow = true } = {}) {
    const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    return this.add(mesh, { shadow });
  }

  /**
   * Cylinder. `axis: 'z'` is the wheel orientation (caps face ±Z).
   * `axis: 'x'` lays the cylinder along X (caps face ±X, outward from the ends).
   */
  cyl(r, len, x, y, z, mat, axis = 'y', seg = 24, { shadow = true } = {}) {
    const geo = new CylinderGeometry(r, r, len, seg);
    const mesh = new Mesh(geo, mat);
    if (axis === 'z') mesh.rotateX(Math.PI / 2);
    else if (axis === 'x') mesh.rotateZ(Math.PI / 2);
    mesh.position.set(x, y, z);
    return this.add(mesh, { shadow });
  }

  /** Circular tube along X with bevelled end caps facing outward. */
  barrel(radius, length, x, y, z, mat) {
    const bevel = Math.min(0.07, radius * 0.07, length * 0.04);
    const shape = new Shape();
    shape.absarc(0, 0, Math.max(0.02, radius - bevel), 0, Math.PI * 2, false);
    const depth = Math.max(0.05, length - bevel * 2);
    const geo = new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 40,
    });
    geo.translate(0, 0, -depth / 2);
    const mesh = new Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, y, z);
    return this.add(mesh);
  }

  /** Extrude a profile in the XY plane through `depth` metres of Z. Caps face ±Z. */
  profile(shape, depth, x, y, z, mat, bevel = 0.04) {
    const extrude = Math.max(0.04, depth - bevel * 2);
    const geo = new ExtrudeGeometry(shape, {
      depth: extrude,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel * 0.9,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geo.translate(0, 0, -extrude / 2);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return this.add(mesh);
  }

  wheel(x, z, radius, width, { hub = true, fancy = false } = {}) {
    const tyre = new Mesh(new CylinderGeometry(radius, radius, width, 28), MAT.tyre);
    tyre.rotateX(Math.PI / 2);
    tyre.position.set(x, radius, z);
    this.add(tyre);
    if (!hub) return tyre;
    const side = z >= 0 ? 1 : -1;
    const rimT = Math.min(0.05, width * 0.2);
    const rim = new Mesh(new CylinderGeometry(radius * 0.58, radius * 0.62, rimT, 22), MAT.rim);
    rim.rotateX(Math.PI / 2);
    rim.position.set(x, radius, z + side * (width / 2 + rimT * 0.08));
    this.add(rim);
    const cap = new Mesh(new CylinderGeometry(radius * 0.16, radius * 0.18, rimT * 0.7, 14), MAT.hub);
    cap.rotateX(Math.PI / 2);
    cap.position.set(x, radius, z + side * (width / 2 + rimT * 0.45));
    this.add(cap);
    if (fancy) {
      const lip = new Mesh(new TorusGeometry(radius * 0.64, radius * 0.02, 8, 22), MAT.rim);
      lip.position.set(x, radius, z + side * (width / 2 + rimT * 0.2));
      this.add(lip);
    }
    return tyre;
  }

  /** Pair of wheels. `dual` adds an inner tyre without a second hub. */
  axle(x, z, radius, width, { dual = false, fancy = false } = {}) {
    for (const s of [1, -1]) {
      const oz = s * z;
      this.wheel(x, oz, radius, width, { fancy });
      if (dual) this.wheel(x, oz - s * (width + 0.03), radius, width, { hub: false });
    }
  }

  stripe(len, h, thick, x, y, z, repeats) {
    const mesh = new Mesh(new BoxGeometry(len, h, thick), hazardMaterial(repeats));
    mesh.position.set(x, y, z);
    return this.add(mesh);
  }

  face(w, h, x, y, z, mat, facing = '-z', { shadow = false } = {}) {
    const mesh = new Mesh(new PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (facing === '-z') mesh.rotation.y = Math.PI;
    else if (facing === '+x') mesh.rotation.y = Math.PI / 2;
    else if (facing === '-x') mesh.rotation.y = -Math.PI / 2;
    else if (facing === '+y') mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 3;
    return this.add(mesh, { shadow });
  }

  decal(w, h, x, y, z, draw, cw, ch, facing = '-z', fallback = C.text) {
    const mat = decalMaterial(draw, cw, ch, fallback);
    return this.face(w, h, x, y, z, mat, facing);
  }

  text(w, h, x, y, z, lines, facing = '-z', bg) {
    const ppm = 320;
    const cw = Math.max(128, Math.round(w * ppm));
    const ch = Math.max(48, Math.round(h * ppm));
    return this.decal(w, h, x, y, z, textPainter(lines, bg), cw, ch, facing, lines[0]?.color ?? C.text);
  }

  mirror(x, y, z, side) {
    const arm = new Mesh(new BoxGeometry(0.08, 0.04, 0.32), MAT.black);
    arm.position.set(x, y, z + side * 0.2);
    this.add(arm);
    const head = new Mesh(new RoundedBoxGeometry(0.1, 0.28, 0.18, 2, 0.02), MAT.black);
    head.position.set(x + 0.02, y - 0.02, z + side * 0.38);
    this.add(head);
    const glass = new Mesh(new PlaneGeometry(0.07, 0.2), MAT.mirror);
    glass.position.set(x + 0.075, y - 0.02, z + side * 0.38);
    if (side < 0) glass.rotation.y = Math.PI;
    glass.rotation.y += side > 0 ? 0.4 : -0.4;
    this.add(glass, { shadow: false });
  }

  beacon(x, y, z) {
    this.cyl(0.07, 0.04, x, y + 0.02, z, MAT.black, 'y', 12);
    const dome = new Mesh(new SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.amber);
    dome.position.set(x, y + 0.04, z);
    this.add(dome, { shadow: false });
  }

  lamp(w, h, d, x, y, z, mat) {
    const rad = clampRadius(w, h, d, Math.min(w, h, d) * 0.35);
    const geo = new RoundedBoxGeometry(w, h, d, 2, rad);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return this.add(mesh, { shadow: false });
  }

  ladder(x, z, y0, y1, rungs, span = 0.28) {
    const h = y1 - y0;
    const mid = (y0 + y1) / 2;
    this.box(0.03, h, 0.03, x, mid, z - span / 2, MAT.steel);
    this.box(0.03, h, 0.03, x, mid, z + span / 2, MAT.steel);
    for (let i = 0; i < rungs; i += 1) {
      const y = y0 + ((i + 0.5) / rungs) * h;
      this.box(0.025, 0.025, span, x, y, z, MAT.steel);
    }
  }

  headPair(x, y, z, w = 0.22, h = 0.12) {
    for (const s of [1, -1]) {
      this.lamp(0.05, h, w, x, y, s * z, MAT.head);
      this.lamp(0.045, h * 0.55, w * 0.45, x, y, s * (z + w * 0.85), MAT.amber);
    }
  }

  tailPair(x, y, z) {
    for (const s of [1, -1]) {
      this.lamp(0.04, 0.14, 0.22, x, y, s * z, MAT.tail);
      this.lamp(0.04, 0.07, 0.1, x, y + 0.12, s * z, MAT.amber);
    }
  }
}

export function countStats(root) {
  let meshes = 0;
  let triangles = 0;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    meshes += 1;
    const geo = obj.geometry;
    if (geo.index) triangles += geo.index.count / 3;
    else triangles += geo.getAttribute('position').count / 3;
  });
  return { meshes, triangles };
}
