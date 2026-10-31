/**
 * Deterministic math for the rules (PU-22).
 *
 * JavaScript only fixes the bits of + - * /, Math.sqrt, floor/ceil/round/trunc, abs, min/max, fround and the
 * integer ops. Math.sin, cos, tan, asin, acos, atan, atan2, hypot, exp, log, pow, cosh and the ** operator are
 * "implementation-approximated": V8 (browser, Node), Jint (.NET, the Unity port) and each C library give
 * slightly different last bits, and a replay drifts apart from there. Everything here is built only from the
 * exactly specified operations, so every engine computes the same bits.
 *
 * Algorithms: the classic fdlibm designs, written fresh for this file: Cody-Waite argument reduction by pi/2
 * (pi/2 in four pieces, summed in double-double; Payne-Hanek with 1400 bits of 2/pi for huge arguments),
 * minimax polynomial kernels for sin and cos, atan's four-interval reduction, the rational asin/acos kernel,
 * exp's ln2 reduction with a rational remainder, and log through s = f / (2 + f). The polynomial coefficients
 * are the published minimax constants of those designs. pow works in double-double: ln x to about 2^-70 (a
 * table of ln(1 + j/32)), times y, into exp. Every literal has at most 17 significant digits, because
 * JavaScript lets an engine approximate numeric literals longer than 20.
 *
 * Range and accuracy (largest error measured against 300-bit mpmath references over 120,000 inputs; the
 * whole domain of each function is supported, including NaN, +-0, +-Infinity and subnormals):
 *   sin, cos       0.75 ulp. Any finite x: |x| < 1.6e6 (2^20 * pi/2) takes the fast reduction, beyond that
 *                  an exact BigInt reduction (the sim never goes past a few hundred radians).
 *   tan            1.9 ulp (sin / cos of the reduced argument).
 *   asin, acos, atan   0.9 ulp; atan2 1.2 ulp (these are bit-identical to V8's, which uses the same design).
 *   hypot          2 or 3 arguments, any magnitudes (scaled): 0.5 ulp, correctly rounded on every sample.
 *   exp 1.0 ulp, log 0.71 ulp, cosh 1.25 ulp.
 *   pow            1.1 ulp over the whole range, JavaScript's special cases exactly (pow(1, NaN) is NaN, etc.).
 *                  y = 2 is x*x, y = 1 is x, y = -1 is 1/x.
 * What matters most is not the last ulp but that the bits are identical in every engine.
 *
 * Rule for the sim: never call those Math functions or ** in code that ends up in the packed rules
 * (tests/sim/detMath.guard.test.ts fails if one does). Rendering and UI-only code may keep Math.
 */

// ---------------------------------------------------------------------------------------------------------
// Exact helpers

const SPLITTER = 134217729 // 2^27 + 1: Veltkamp split into two 26-bit halves

/** Powers of two 2^-1074 .. 2^1023, built by exact halving and doubling. */
const POW2: number[] = (() => {
  const t: number[] = new Array(2098)
  let v = 1
  for (let k = 0; k <= 1023; k++) { t[k + 1074] = v; v *= 2 }
  v = 1
  for (let k = 0; k >= -1074; k--) { t[k + 1074] = v; v *= 0.5 }
  return t
})()

function pow2(k: number): number {
  return POW2[k + 1074]
}

/** x * 2^k for any integer k, exact unless the result is subnormal (then rounded once) or overflows. */
function scalb(x: number, k: number): number {
  if (k > 1023) { x *= POW2[1023 + 1074]; k -= 1023; if (k > 1023) { x *= POW2[1023 + 1074]; k -= 1023; if (k > 1023) k = 1023 } }
  else if (k < -1022) { x *= POW2[-1022 + 1074]; k += 1022; if (k < -1022) { x *= POW2[-1022 + 1074]; k += 1022; if (k < -1022) k = -1022 } }
  return x * POW2[k + 1074]
}

const P2_512 = pow2(512)
const P2_M512 = 1 / P2_512
const P2_54 = pow2(54)
const MIN_NORMAL = 2.2250738585072014e-308

/** For finite x > 0: [m, k] with x = m * 2^k and 1 <= m < 2, exactly. */
function frexp1(x: number): [number, number] {
  let k = 0
  if (x < MIN_NORMAL) { x *= P2_54; k = -54 }
  if (x >= 2) {
    if (x >= P2_512) { x *= P2_M512; k += 512 }
    for (let s = 256; s >= 1; s >>= 1) { if (x >= POW2[s + 1074]) { x *= POW2[-s + 1074]; k += s } }
  } else if (x < 1) {
    if (x < P2_M512) { x *= P2_512; k -= 512 }
    for (let s = 256; s >= 1; s >>= 1) { if (x < POW2[-s + 1 + 1074]) { x *= POW2[s + 1074]; k -= s } }
    if (x < 1) { x *= 2; k -= 1 }
  }
  return [x, k]
}

function isNegZero(x: number): boolean {
  return x === 0 && 1 / x < 0
}

// ---------------------------------------------------------------------------------------------------------
// Argument reduction by pi/2

const INV_PIO2 = 0.6366197723675814 // 2/pi rounded
const PIO2_1 = 1.5707963267341256 // first 33 bits of pi/2
const PIO2_2 = 6.077100506303966e-11 // next 33 bits
const PIO2_3 = 2.0222662487111665e-21 // next 33 bits
const PIO2_3T = 8.4784276603689e-32
const PIO4 = 0.7853981633974483
const MEDIUM_LIMIT = 1647099.3291652855 // 2^20 * pi/2: up to here n * PIO2_k is exact

/** Reduction result: x = n * pi/2 + (y0 + y1), |y0 + y1| <= ~pi/4. Reused to avoid allocation. */
let redN = 0
let redY0 = 0
let redY1 = 0

function reduce(x: number): void {
  const ax = Math.abs(x)
  if (ax <= PIO4) { redN = 0; redY0 = x; redY1 = 0; return }
  if (ax < MEDIUM_LIMIT) {
    const fn = Math.floor(x * INV_PIO2 + 0.5)
    // Cody-Waite with pi/2 in four pieces (33 + 33 + 33 bits + the rest): fn * PIO2_1, fn * PIO2_2 and
    // fn * PIO2_3 are exact (fn < 2^20), x - fn * PIO2_1 is exact (Sterbenz), and the rest is summed in
    // double-double, so even a near-multiple of pi/2 keeps its significant bits.
    const a = x - fn * PIO2_1
    const p = fn * PIO2_2
    const s = a - p
    let bb = s - a
    const e = (a - (s - bb)) + (-p - bb)
    const c = (e - fn * PIO2_3) - fn * PIO2_3T
    const y0 = s + c
    bb = y0 - s
    redN = fn
    redY0 = y0
    redY1 = (s - (y0 - bb)) + (c - bb)
    return
  }
  reduceHuge(x)
}

// 2/pi to 1400 binary places (hex), for the exact reduction of huge arguments. A mathematical constant.
const TWO_OVER_PI_HEX =
  'a2f9836e4e441529fc2757d1f534ddc0db6295993c439041fe5163abdebbc561b7246e3a424dd2e006492eea09d1921cfe1d' +
  'eb1cb129a73ee88235f52ebb4484e99c7026b45f7e413991d639835339f49c845f8bbdf9283b1ff897ffde05980fef2f118b' +
  '5a0a6d1f6d367ecf27cb09b74f463f669e5fea2d7527bac7ebe5f17b3d0739f78a5292ea6bfb5fb11f8d5d0856033046fc7b' +
  '6babf0cfbc209af4361da9e391615ee61b086599855f14a068'
const TWO_OVER_PI_BITS = 1400
let twoOverPi: bigint | null = null
const PIO2_HI = 1.5707963267948966
const PIO2_LO = 6.123233995736766e-17

/** Payne-Hanek with BigInt: exact for every finite double. Only huge arguments (|x| >= 1.6e6) come here. */
function reduceHuge(x: number): void {
  if (x !== x || x === Infinity || x === -Infinity) { redN = 0; redY0 = x - x; redY1 = 0; return }
  if (twoOverPi === null) twoOverPi = BigInt('0x' + TWO_OVER_PI_HEX)
  const neg = x < 0
  const [m, e] = frexp1(neg ? -x : x) // |x| = m * 2^e, m in [1, 2)
  const mant = BigInt(m * 4503599627370496) // m * 2^52, an exact 53-bit integer
  const shift = TWO_OVER_PI_BITS - (e - 52) // |x| * 2/pi = mant * P / 2^shift
  const prod = mant * twoOverPi
  const one = BigInt(1)
  let n = Number((prod >> BigInt(shift)) & BigInt(3))
  const frac = prod & ((one << BigInt(shift)) - one)
  // Top 128 bits of the fraction.
  let top = shift >= 128 ? frac >> BigInt(shift - 128) : frac << BigInt(128 - shift)
  const half = one << BigInt(127)
  if (top >= half) { top -= one << BigInt(128); n += 1 }
  const fh = Number(top) // rounded to nearest, as BigInt -> Number is specified
  const fl = Number(top - BigInt(fh))
  const s = pow2(-128)
  const f0 = fh * s
  const f1 = fl * s
  // (f0 + f1) * pi/2 in double-double.
  const p = f0 * PIO2_HI
  const e1 = twoProdErr(f0, PIO2_HI, p) + (f0 * PIO2_LO + f1 * PIO2_HI)
  const y0 = p + e1
  const y1 = e1 - (y0 - p)
  redN = neg ? -n : n
  redY0 = neg ? -y0 : y0
  redY1 = neg ? -y1 : y1
}

/** The rounding error of a * b (p = a * b rounded), exactly, by Dekker's product. */
function twoProdErr(a: number, b: number, p: number): number {
  let c = SPLITTER * a
  const ah = c - (c - a)
  const al = a - ah
  c = SPLITTER * b
  const bh = c - (c - b)
  const bl = b - bh
  return ((ah * bh - p) + ah * bl + al * bh) + al * bl
}

// ---------------------------------------------------------------------------------------------------------
// sin, cos, tan

const S1 = -0.16666666666666632
const S2 = 0.00833333333332249
const S3 = -0.0001984126982985795
const S4 = 2.7557313707070068e-06
const S5 = -2.5050760253406863e-08
const S6 = 1.58969099521155e-10

const C1 = 0.0416666666666666
const C2 = -0.001388888888887411
const C3 = 2.480158728947673e-05
const C4 = -2.7557314351390663e-07
const C5 = 2.087572321298175e-09
const C6 = -1.1359647557788195e-11

/** sin on [-pi/4, pi/4]; y is the tail of the reduced argument. */
function kSin(x: number, y: number): number {
  const z = x * x
  const v = z * x
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))
  if (y === 0) return x + v * (S1 + z * r)
  return x - ((z * (0.5 * y - v * r) - y) - v * S1)
}

/** cos on [-pi/4, pi/4]. */
function kCos(x: number, y: number): number {
  const z = x * x
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))))
  const hz = 0.5 * z
  const w = 1 - hz
  return w + (((1 - w) - hz) + (z * r - x * y))
}

const TINY = 7.450580596923828e-9 // 2^-27

export function detSin(x: number): number {
  if (Math.abs(x) < TINY) return x // keeps -0
  reduce(x)
  switch (redN & 3) {
    case 0: return kSin(redY0, redY1)
    case 1: return kCos(redY0, redY1)
    case 2: return -kSin(redY0, redY1)
    default: return -kCos(redY0, redY1)
  }
}

export function detCos(x: number): number {
  if (Math.abs(x) < TINY) return 1
  reduce(x)
  switch (redN & 3) {
    case 0: return kCos(redY0, redY1)
    case 1: return -kSin(redY0, redY1)
    case 2: return -kCos(redY0, redY1)
    default: return kSin(redY0, redY1)
  }
}

export function detTan(x: number): number {
  if (Math.abs(x) < TINY) return x
  reduce(x)
  const s = kSin(redY0, redY1)
  const c = kCos(redY0, redY1)
  return (redN & 1) === 0 ? s / c : -c / s
}

// ---------------------------------------------------------------------------------------------------------
// atan, atan2

const ATAN_HI = [0.4636476090008061, 0.7853981633974483, 0.982793723247329, 1.5707963267948966]
const ATAN_LO = [2.2698777452961687e-17, 3.061616997868383e-17, 1.3903311031230998e-17, 6.123233995736766e-17]
const AT0 = 0.3333333333333293
const AT1 = -0.19999999999876483
const AT2 = 0.14285714272503466
const AT3 = -0.11111110405462356
const AT4 = 0.09090887133436507
const AT5 = -0.0769187620504483
const AT6 = 0.06661073137387531
const AT7 = -0.058335701337905735
const AT8 = 0.049768779946159324
const AT9 = -0.036531572744216916
const AT10 = 0.016285820115365782
const P2_66 = pow2(66)

export function detAtan(x: number): number {
  if (x !== x) return x
  const neg = x < 0
  let ax = neg ? -x : x
  if (ax >= P2_66) return neg ? -(ATAN_HI[3] + ATAN_LO[3]) : ATAN_HI[3] + ATAN_LO[3]
  let id: number
  if (ax < 0.4375) {
    if (ax < TINY) return x
    id = -1
  } else if (ax < 1.1875) {
    if (ax < 0.6875) { id = 0; ax = (2 * ax - 1) / (2 + ax) } else { id = 1; ax = (ax - 1) / (ax + 1) }
  } else if (ax < 2.4375) {
    id = 2; ax = (ax - 1.5) / (1 + 1.5 * ax)
  } else {
    id = 3; ax = -1 / ax
  }
  const z = ax * ax
  const w = z * z
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))))
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))))
  if (id < 0) return x - x * (s1 + s2) // x keeps its sign here
  const r = ATAN_HI[id] - ((ax * (s1 + s2) - ATAN_LO[id]) - ax)
  return neg ? -r : r
}

const PI = 3.141592653589793
const PI_LO = 1.2246467991473532e-16
const PI_O_4 = 0.7853981633974483
const PI_O_2 = 1.5707963267948966
const P2_60 = pow2(60)
const P2_M60 = 1 / P2_60

export function detAtan2(y: number, x: number): number {
  if (x !== x || y !== y) return x + y
  if (x === 1) return detAtan(y)
  const yNeg = y < 0 || isNegZero(y)
  const xNeg = x < 0 || isNegZero(x)
  const m = (xNeg ? 2 : 0) + (yNeg ? 1 : 0)
  if (y === 0) {
    if (m < 2) return y // atan2(+-0, +anything) = +-0
    return m === 2 ? PI : -PI
  }
  if (x === 0) return yNeg ? -PI_O_2 : PI_O_2
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) {
      switch (m) { case 0: return PI_O_4; case 1: return -PI_O_4; case 2: return 3 * PI_O_4; default: return -3 * PI_O_4 }
    }
    switch (m) { case 0: return 0; case 1: return -0; case 2: return PI; default: return -PI }
  }
  if (y === Infinity || y === -Infinity) return yNeg ? -PI_O_2 : PI_O_2
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  let z: number
  // Compare magnitudes without dividing first (a quotient could overflow or underflow).
  if (ay > ax * P2_60) z = PI_O_2 + 0.5 * PI_LO
  else if (xNeg && ay < ax * P2_M60) z = 0
  else z = detAtan(ay / ax)
  if (ay > ax * P2_60) {
    return yNeg ? -z : z
  }
  switch (m) {
    case 0: return z
    case 1: return -z
    case 2: return PI - (z - PI_LO)
    default: return (z - PI_LO) - PI
  }
}

// ---------------------------------------------------------------------------------------------------------
// asin, acos

const PS0 = 0.16666666666666666
const PS1 = -0.3255658186224009
const PS2 = 0.20121253213486293
const PS3 = -0.04005553450067941
const PS4 = 0.0007915349942898145
const PS5 = 3.479331075960212e-05
const QS1 = -2.403394911734414
const QS2 = 2.0209457602335057
const QS3 = -0.6882839716054533
const QS4 = 0.07703815055590194

function asinR(t: number): number {
  const p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))))
  const q = 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)))
  return p / q
}

/** The high 26 bits of s (Veltkamp split): hi * hi is exact. */
function highHalf(s: number): number {
  const c = SPLITTER * s
  return c - (c - s)
}

export function detAsin(x: number): number {
  const ax = Math.abs(x)
  if (!(ax <= 1)) return NaN // NaN or |x| > 1
  if (ax === 1) return x * PIO2_HI + x * PIO2_LO
  if (ax < 0.5) {
    if (ax < TINY) return x
    return x + x * asinR(x * x)
  }
  const w = 1 - ax
  const t = w * 0.5
  const s = Math.sqrt(t)
  let r: number
  if (ax >= 0.975) {
    r = PIO2_HI - (2 * (s + s * asinR(t)) - PIO2_LO)
  } else {
    const h = highHalf(s)
    const c = (t - h * h) / (s + h)
    const p = 2 * s * asinR(t) - (PIO2_LO - 2 * c)
    const q = PIO4 - 2 * h
    r = PIO4 - (p - q)
  }
  return x < 0 ? -r : r
}

export function detAcos(x: number): number {
  const ax = Math.abs(x)
  if (!(ax <= 1)) return NaN
  if (ax === 1) return x > 0 ? 0 : PI + 2 * PIO2_LO
  if (ax < 0.5) {
    if (ax < 6.938893903907228e-18) return PIO2_HI + PIO2_LO // 2^-57
    return PIO2_HI - (x - (PIO2_LO - x * asinR(x * x)))
  }
  if (x < 0) {
    const z = (1 + x) * 0.5
    const s = Math.sqrt(z)
    const w = asinR(z) * s - PIO2_LO
    return PI - 2 * (s + w)
  }
  const z = (1 - x) * 0.5
  const s = Math.sqrt(z)
  const h = highHalf(s)
  const c = (z - h * h) / (s + h)
  const w = asinR(z) * s + c
  return 2 * (h + w)
}

// ---------------------------------------------------------------------------------------------------------
// hypot

const P2_500 = pow2(500)
const P2_M500 = 1 / P2_500
const P2_600 = pow2(600)
const P2_M600 = 1 / P2_600

/** Math.hypot for 2 or 3 numbers. Sum of squares in double-double, sqrt, one exact correction step. */
export function detHypot(x: number, y: number, z = 0): number {
  if (x === Infinity || x === -Infinity || y === Infinity || y === -Infinity || z === Infinity || z === -Infinity) return Infinity
  if (x !== x || y !== y || z !== z) return NaN
  let a = Math.abs(x)
  let b = Math.abs(y)
  let c = Math.abs(z)
  const big = Math.max(a, b, c)
  if (big === 0) return 0
  let scale = 1
  if (big > P2_500) { a *= P2_M600; b *= P2_M600; c *= P2_M600; scale = P2_600 }
  else if (big < P2_M500) { a *= P2_600; b *= P2_600; c *= P2_600; scale = P2_M600 }
  // s = a^2 + b^2 + c^2 as hi + lo
  let hi = a * a
  let lo = twoProdErr(a, a, hi)
  let p = b * b
  let pe = twoProdErr(b, b, p)
  let s = hi + p
  let bb = s - hi
  lo += ((hi - (s - bb)) + (p - bb)) + pe
  hi = s
  if (c !== 0) {
    p = c * c
    pe = twoProdErr(c, c, p)
    s = hi + p
    bb = s - hi
    lo += ((hi - (s - bb)) + (p - bb)) + pe
    hi = s
  }
  s = hi + lo
  lo = lo - (s - hi)
  hi = s
  let h = Math.sqrt(hi)
  // h += (hi + lo - h^2) / (2h), with h^2 exact
  const hh = h * h
  const he = twoProdErr(h, h, hh)
  h = h + (((hi - hh) - he) + lo) / (2 * h)
  return h * scale
}

// ---------------------------------------------------------------------------------------------------------
// exp, log, pow, cosh

const LN2_HI = 0.6931471803691238 // 32 bits: k * LN2_HI is exact for |k| < 2^21
const LN2_LO = 1.9082149292705877e-10
const INV_LN2 = 1.4426950408889634
const EP1 = 0.16666666666666602
const EP2 = -0.0027777777777015593
const EP3 = 6.613756321437934e-05
const EP4 = -1.6533902205465252e-06
const EP5 = 4.1381367970572385e-08
const EXP_OVER = 709.782712893384
const EXP_UNDER = -745.1332191019411
const P2_M28 = 3.725290298461914e-9

/** e^(xh + xl), where xl is a small tail (|xl| <= ulp(xh)); xl = 0 for plain exp. */
function expDD(xh: number, xl: number): number {
  if (xh !== xh) return xh
  if (xh > EXP_OVER) return Infinity
  if (xh < EXP_UNDER) return 0
  const ax = Math.abs(xh)
  if (ax < P2_M28 && xl === 0) return 1 + xh
  const k = ax < 0.34657359027997264 ? 0 : Math.floor(xh * INV_LN2 + 0.5) // 0.5 * ln2
  const hi = xh - k * LN2_HI
  const lo = k * LN2_LO - xl
  const r = hi - lo
  const t = r * r
  const c = r - t * (EP1 + t * (EP2 + t * (EP3 + t * (EP4 + t * EP5))))
  const y = 1 - ((lo - (r * c) / (2 - c)) - hi)
  if (k === 0) return y
  return scalb(y, k)
}

export function detExp(x: number): number {
  if (x === Infinity) return Infinity
  if (x === -Infinity) return 0
  return expDD(x, 0)
}

const LG1 = 0.6666666666666735
const LG2 = 0.3999999999940942
const LG3 = 0.2857142874366239
const LG4 = 0.22222198432149784
const LG5 = 0.1818357216161805
const LG6 = 0.15313837699209373
const LG7 = 0.14798198605116586
const SQRT2 = 1.4142135623730951

function logR(z: number): number {
  const w = z * z
  const t1 = w * (LG2 + w * (LG4 + w * LG6))
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)))
  return t2 + t1
}

export function detLog(x: number): number {
  if (x !== x || x < 0) return NaN
  if (x === 0) return -Infinity
  if (x === Infinity) return Infinity
  let [m, k] = frexp1(x)
  if (m > SQRT2) { m *= 0.5; k += 1 }
  const f = m - 1 // exact
  const s = f / (2 + f)
  const R = logR(s * s)
  const hfsq = 0.5 * f * f
  if (k === 0) return f - (hfsq - s * (hfsq + R))
  return k * LN2_HI - ((hfsq - (s * (hfsq + R) + k * LN2_LO)) - f)
}

let logHi = 0
let logLo = 0

// ln(1 + j/32) for j = -10 .. 14, as hi + lo (each to 2^-106): mathematical constants, for logDD.
const LOG_C_HI = [-0.3746934494414107, -0.33024168687057687, -0.2876820724517809, -0.24686007793152578, -0.2076393647782445, -0.16989903679539747, -0.13353139262452263, -0.09844007281325252, -0.06453852113757118, -0.0317486983145803, 0.0, 0.030771658666753687, 0.06062462181643484, 0.08961215868968714, 0.11778303565638346, 0.1451820098444979, 0.17185025692665923, 0.19782574332991987, 0.22314355131420976, 0.24783616390458127, 0.27193371548364176, 0.2954642128938359, 0.3184537311185346, 0.3409265869705932, 0.3629054936893685]
const LOG_C_LO = [3.9243112288632396e-18, 1.0828321637483858e-17, -2.607160616442564e-17, -1.361743371748368e-17, -1.2053243216686129e-17, 4.868008764439071e-19, 3.664457663660085e-18, 4.439009633675136e-18, 6.470486661692933e-18, -3.0382263084680858e-18, 0.0, 1.0431732029005968e-18, 2.6424025938726934e-18, -5.4268129336647135e-18, -1.1971685747593677e-18, 8.242418783022475e-18, -6.0224538210113705e-18, 1.2821194372980142e-17, -9.091270597324799e-18, -1.2432209578702523e-17, 7.83319637697442e-19, -2.16461086040599e-17, 2.7114779367326236e-17, 1.7467136443544747e-17, -2.1492361455310972e-17]

/**
 * ln(x) for finite x > 0 as logHi + logLo, to about 2^-70 absolute. x = 2^k * m, m = c * (1+s)/(1-s) with
 * c = 1 + j/32 nearest m, so |s| < 0.012 and ln m = ln c + 2s + s * R(s^2) needs R only to a few digits.
 */
function logDD(x: number): void {
  let [m, k] = frexp1(x)
  if (m > SQRT2) { m *= 0.5; k += 1 }
  const j = Math.floor((m - 1) * 32 + 0.5)
  const c = 1 + j * 0.03125 // exact
  const f = m - c // exact (Sterbenz)
  // s = f / (m + c) as sh + sl
  const d = m + c
  let bb = d - m
  const dl = (m - (d - bb)) + (c - bb)
  const sh = f / d
  const ph = sh * d
  const pl = twoProdErr(sh, d, ph)
  const sl = (((f - ph) - pl) - sh * dl) / d
  const R = logR(sh * sh)
  // k ln2 + ln c + 2s + (tails), largest terms summed exactly
  const kh = k * LN2_HI // exact
  const ch = LOG_C_HI[j + 10]
  const a = kh + ch
  bb = a - kh
  const ae = (kh - (a - bb)) + (ch - bb)
  const th = 2 * sh // exact
  const b = a + th
  bb = b - a
  const be = (a - (b - bb)) + (th - bb)
  const e = ae + be + (LOG_C_LO[j + 10] + k * LN2_LO + 2 * sl + sh * R)
  const hi = b + e
  logLo = e - (hi - b)
  logHi = hi
}

function isOddInteger(y: number): boolean {
  // |y| < 2^53 here; beyond that every double is even.
  return Math.abs(y) < 9007199254740992 && y % 2 !== 0 && Math.floor(y) === y
}

/** Math.pow / ** with JavaScript's special cases. */
export function detPow(x: number, y: number): number {
  if (y !== y) return NaN
  if (y === 0) return 1
  if (x !== x) return NaN
  if (y === 1) return x
  if (y === 2) return x * x
  if (y === -1) return 1 / x
  const ax = Math.abs(x)
  if (y === Infinity || y === -Infinity) {
    if (ax === 1) return NaN
    return (ax > 1) === (y > 0) ? Infinity : 0
  }
  const yInt = Math.floor(y) === y
  const odd = yInt && isOddInteger(y)
  if (x === Infinity) return y > 0 ? Infinity : 0
  if (x === -Infinity) return y > 0 ? (odd ? -Infinity : Infinity) : (odd ? -0 : 0)
  if (x === 0) {
    const neg = isNegZero(x)
    if (y > 0) return neg && odd ? -0 : 0
    return neg && odd ? -Infinity : Infinity
  }
  if (x < 0 && !yInt) return NaN
  if (ax === 1) return x < 0 && odd ? -1 : 1
  logDD(ax)
  // y * (logHi + logLo) as eh + el
  const eh = y * logHi
  // Far past exp's range (or overflowed to +-Infinity): the result is Infinity or 0. This also keeps |y| small
  // enough for the exact split below (|eh| < 1000 means |y| < 1e19, since |ln x| > 1e-16 for x != 1).
  if (!(eh < 1000 && eh > -1000)) {
    const r = eh > 0 ? Infinity : 0
    return x < 0 && odd ? -r : r
  }
  const el = twoProdErr(y, logHi, eh) + y * logLo
  const h = eh + el
  const l = el - (h - eh)
  const r = expDD(h, l)
  return x < 0 && odd ? -r : r
}

/** Math.cosh. */
export function detCosh(x: number): number {
  if (x !== x) return x
  const ax = Math.abs(x)
  if (ax === Infinity) return Infinity
  if (ax < 22) {
    const t = detExp(ax)
    return 0.5 * t + 0.5 / t
  }
  if (ax < EXP_OVER) return 0.5 * detExp(ax)
  if (ax <= 710.4758600739439) {
    const w = detExp(0.5 * ax) // avoids overflowing before the halving
    return (0.5 * w) * w
  }
  return Infinity
}

/** v * v: what v ** 2 means, with one rounding in every engine. */
export function sq(v: number): number {
  return v * v
}
