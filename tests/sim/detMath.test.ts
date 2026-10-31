// src/game/detMath.ts (PU-22): the rules' own math, the same bits in every JavaScript engine.
//   - JavaScript's special values (NaN, +-0, +-Infinity) come out exactly as Math gives them;
//   - everyday values stay within a few ulp of Math (each is within about 1 ulp of the true value);
//   - the cross-engine fixture still hashes to tests/sim/detmath-expected.json, the file the Unity port checks
//     Jint against (SimCli detmath-check). A change to detMath.ts that moves any bit fails here: regenerate with
//     node tools/replay/detmath-fixture.ts --update and copy the JSON to the Unity repo's tools/SimCli/.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as D from '../../src/game/detMath.ts'
import { EXPECTED_FILE, FUNCTIONS, fromHex, generate, summarize, type Expected } from '../../tools/replay/detmath-fixture.ts'

type F = (...a: number[]) => number
const PAIRS: [string, F, F, number][] = [
  // name, detMath, Math, how many ulp apart they may be (each is within ~1 ulp of the truth; tan within 2)
  ['sin', D.detSin, Math.sin, 2],
  ['cos', D.detCos, Math.cos, 2],
  ['tan', D.detTan, Math.tan, 3],
  ['asin', D.detAsin, Math.asin, 2],
  ['acos', D.detAcos, Math.acos, 2],
  ['atan', D.detAtan, Math.atan, 2],
  ['atan2', D.detAtan2, Math.atan2, 2],
  ['hypot', D.detHypot, (a: number, b: number, c: number) => Math.hypot(a, b, c), 2],
  ['exp', D.detExp, Math.exp, 2],
  ['log', D.detLog, Math.log, 2],
  ['pow', D.detPow, Math.pow, 2],
  ['cosh', D.detCosh, Math.cosh, 2],
]

const view = new DataView(new ArrayBuffer(8))
function ulpsApart(a: number, b: number): number {
  if (Object.is(a, b)) return 0
  if (a !== a || b !== b || !Number.isFinite(a) || !Number.isFinite(b)) return Infinity
  const ord = (x: number) => { view.setFloat64(0, x); const v = view.getBigInt64(0); return v < 0n ? -(v & 0x7fffffffffffffffn) : v }
  const d = ord(a) - ord(b)
  return Number(d < 0n ? -d : d)
}

const SPECIAL = [0, -0, Infinity, -Infinity, NaN, 1, -1, 0.5, -0.5, 2, -2, 3, -3, 5e-324, -5e-324, 1e300, -1e300, 0.1, Math.PI, -Math.PI]

describe('detMath', () => {
  it('gives JavaScript\'s special values exactly', () => {
    const isSpecial = (v: number) => v !== v || v === 0 || !Number.isFinite(v)
    for (const [name, det, nat] of PAIRS) {
      const arity = FUNCTIONS[name][1]
      const grid = arity === 1 ? SPECIAL.map((a) => [a]) : arity === 2 ? SPECIAL.flatMap((a) => SPECIAL.map((b) => [a, b])) : SPECIAL.flatMap((a) => SPECIAL.map((b) => [a, b, 0]))
      for (const args of grid) {
        const want = nat(...args)
        const got = det(...args)
        if (isSpecial(want) || isSpecial(got)) expect(Object.is(got, want), `${name}(${args.join(', ')}): ${got}, Math gives ${want}`).toBe(true)
      }
    }
    // a few that JavaScript fixes and C does not
    expect(D.detPow(1, NaN)).toBeNaN()
    expect(D.detPow(-1, Infinity)).toBeNaN()
    expect(D.detPow(NaN, 0)).toBe(1)
    expect(D.detHypot(NaN, Infinity)).toBe(Infinity)
    expect(Object.is(D.detAtan2(-0, -0), -Math.PI)).toBe(true)
    expect(Object.is(D.detSin(-0), -0)).toBe(true)
    expect(Object.is(D.detLog(1), 0)).toBe(true)
  })

  it('stays within a few ulp of Math on the fixture inputs', () => {
    const worst: Record<string, number> = {}
    const nat = Object.fromEntries(PAIRS.map(([n, , m, tol]) => [n, [m, tol] as const]))
    for (const l of generate()) {
      const [m, tol] = nat[l.fn]
      const want = m(...l.args)
      const u = ulpsApart(l.out, want)
      worst[l.fn] = Math.max(worst[l.fn] ?? 0, u)
      // Results in the subnormal range lose relative precision in every library: allow 1 more ulp there.
      const limit = Math.abs(want) < 2.2250738585072014e-308 ? tol + 1 : tol
      if (u > limit) expect.fail(`${l.fn}(${l.args.join(', ')}) = ${l.out}, Math gives ${want}: ${u} ulp apart`)
    }
    expect(Object.keys(worst).length).toBe(PAIRS.length)
  })

  it('squares and simple powers the way the sim relies on', () => {
    for (const x of [0.15, 1.2345, -3.5, 1e-200, 7]) {
      expect(D.sq(x)).toBe(x * x)
      expect(D.detPow(x, 2)).toBe(x * x)
      expect(D.detPow(x, 1)).toBe(x)
      expect(D.detPow(x, -1)).toBe(1 / x)
    }
    expect(D.detPow(2, 10)).toBe(1024)
    expect(D.detPow(2, -3)).toBe(0.125)
    expect(D.detPow(-2, 3)).toBe(-8)
    expect(D.detPow(0.5, 1 / 30)).toBeCloseTo(0.977159968, 9)
    expect(D.detHypot(3, 4)).toBe(5)
    expect(D.detHypot(2, 3, 6)).toBe(7)
  })

  it('still produces the fixture the Unity port checks (tests/sim/detmath-expected.json)', () => {
    const want = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8')) as Expected
    const got = summarize(generate())
    expect(got.format).toBe(want.format)
    for (const name of Object.keys(FUNCTIONS)) expect(got.functions[name], name).toEqual(want.functions[name])
    expect(got.sample).toEqual(want.sample)
    // and the sample lines decode to what detMath computes now
    for (const line of want.sample.slice(0, 50)) {
      const p = line.split(' ')
      const [, arity, f] = FUNCTIONS[p[0]]
      const out = f(...p.slice(1, 1 + arity).map(fromHex))
      const exp = fromHex(p[p.length - 1])
      expect(Object.is(out, exp) || (out !== out && exp !== exp), line).toBe(true)
    }
  })
})
