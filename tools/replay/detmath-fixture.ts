/**
 * tools/replay/detmath-fixture.ts: the cross-engine proof for src/game/detMath.ts (PU-22).
 *
 * About 100,000 seeded inputs (special values, the sim's everyday ranges, extremes) go through every detMath
 * function; each line of the fixture is the function, its inputs and its output as IEEE-754 bit patterns (hex).
 * Another engine (Jint in the Unity port: SimCli detmath-check) plays the same inputs through the packed rules
 * and must produce every output bit for bit.
 *
 *   node tools/replay/detmath-fixture.ts                  write dist-sim/detmath-fixture.txt (ignored by Git)
 *   node tools/replay/detmath-fixture.ts --check          compare with tests/sim/detmath-expected.json (exit 1 if not)
 *   node tools/replay/detmath-fixture.ts --update         rewrite tests/sim/detmath-expected.json (hash per function
 *                                                         and a sample; commit it with any change to detMath.ts)
 *   node tools/replay/detmath-fixture.ts --unity <project>  also copy the fixture to <project>/Rules~/ (ignored there)
 *
 * The inputs come from bit patterns (SimRng words), not from Math, so the same fixture comes out on any machine.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as D from '../../src/game/detMath.ts'
import { SimRng } from '../../src/game/simRng.ts'

export const FIXTURE_FORMAT = 'hatchfield-detmath/1'
export const FIXTURE_SEED = 0x22d3a7

type Fn = (...a: number[]) => number
/** Name in the fixture → [the packed export the other engine calls, arity, the function]. */
export const FUNCTIONS: Record<string, [string, number, Fn]> = {
  sin: ['detSin', 1, D.detSin],
  cos: ['detCos', 1, D.detCos],
  tan: ['detTan', 1, D.detTan],
  asin: ['detAsin', 1, D.detAsin],
  acos: ['detAcos', 1, D.detAcos],
  atan: ['detAtan', 1, D.detAtan],
  atan2: ['detAtan2', 2, D.detAtan2],
  hypot: ['detHypot', 3, D.detHypot],
  exp: ['detExp', 1, D.detExp],
  log: ['detLog', 1, D.detLog],
  pow: ['detPow', 2, D.detPow],
  cosh: ['detCosh', 1, D.detCosh],
}

const view = new DataView(new ArrayBuffer(8))
export function hex(x: number): string {
  view.setFloat64(0, x)
  if (x !== x) return '7ff8000000000000' // one NaN: engines may differ in NaN payloads, JavaScript can't tell them apart
  return view.getUint32(0).toString(16).padStart(8, '0') + view.getUint32(4).toString(16).padStart(8, '0')
}
export function fromHex(h: string): number {
  view.setUint32(0, parseInt(h.slice(0, 8), 16))
  view.setUint32(4, parseInt(h.slice(8), 16))
  return view.getFloat64(0)
}

/** Seeded inputs, built from bits. */
class Inputs {
  private r: SimRng
  constructor(seed: number) { this.r = new SimRng(seed) }
  u32(): number { return (this.r.next() * 4294967296) >>> 0 }
  unit(): number { return this.r.next() }
  /** A double with a uniformly random exponent in [eMin, eMax] (unbiased exponents) and random mantissa. */
  logUniform(eMin: number, eMax: number, signed = true): number {
    const e = eMin + (this.u32() % (eMax - eMin + 1))
    view.setUint32(0, ((((e + 1023) & 0x7ff) << 20) | (this.u32() & 0xfffff)) >>> 0)
    view.setUint32(4, this.u32())
    const v = view.getFloat64(0)
    return signed && (this.u32() & 1) ? -v : v
  }
  uniform(a: number, b: number): number { return a + (b - a) * this.unit() }
  /** Any bit pattern at all (NaNs, infinities, subnormals included). */
  anyBits(): number {
    view.setUint32(0, this.u32())
    view.setUint32(4, this.u32())
    return view.getFloat64(0)
  }
}

const SPECIAL = [0, -0, Infinity, -Infinity, NaN, 5e-324, -5e-324, 2.2250738585072014e-308, 1.7976931348623157e308, -1.7976931348623157e308,
  1, -1, 0.5, -0.5, 2, -2, 3, 0.1, 1e-300, 1e300, -1e300, 7.450580596923828e-9, 3.725290298461914e-9,
  Math.PI, -Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 2 * Math.PI, 1647099.3291652855, 1647099.329165286,
  709.782712893384, 709.79, -745.1332191019411, -745.14, 710.4758600739439, 22, 0.975, -0.975, 0.4375, 2.4375, 1.1875, 0.6875,
  1.4142135623730951, 0.7071067811865476, 1e22, 1e100, 6.123233995736766e-17]

/** Inputs per function: specials, the sim's everyday ranges, extremes. */
function inputsFor(name: string, g: Inputs): number[][] {
  const out: number[][] = []
  const N = (n: number, f: () => number[]) => { for (let i = 0; i < n; i++) out.push(f()) }
  const arity = FUNCTIONS[name][1]
  if (arity === 1) for (const s of SPECIAL) out.push([s])
  else if (arity === 2) for (const a of SPECIAL.slice(0, 24)) for (const b of SPECIAL.slice(0, 24)) out.push([a, b])
  else for (const a of SPECIAL.slice(0, 14)) for (const b of SPECIAL.slice(0, 14)) out.push([a, b, (g.u32() & 3) === 0 ? SPECIAL[g.u32() % 14] : 0])
  switch (name) {
    case 'sin': case 'cos': case 'tan':
      N(4000, () => [g.uniform(-2 * Math.PI, 2 * Math.PI)]) // headings, angles
      N(2000, () => [g.uniform(-2000, 2000)])
      N(1500, () => [g.logUniform(-60, 20)])
      N(1000, () => [g.logUniform(20, 1023)]) // huge: the exact reduction
      N(800, () => [Math.round(g.uniform(-1e6, 1e6)) * (Math.PI / 2)]) // near multiples of pi/2
      N(300, () => [g.anyBits()])
      break
    case 'asin': case 'acos':
      N(3000, () => [g.uniform(-1, 1)]); N(1000, () => [g.logUniform(-60, -1)]); N(500, () => [1 - g.logUniform(-53, -2, false)]); N(300, () => [g.anyBits()])
      break
    case 'atan':
      N(3000, () => [g.uniform(-4, 4)]); N(2000, () => [g.logUniform(-80, 80)]); N(300, () => [g.anyBits()])
      break
    case 'atan2':
      N(6000, () => [g.uniform(-2000, 2000), g.uniform(-2000, 2000)]) // dx, dz in metres
      N(3000, () => [g.logUniform(-300, 300), g.logUniform(-300, 300)])
      N(1000, () => [g.anyBits(), g.anyBits()])
      break
    case 'hypot':
      N(5000, () => [g.uniform(-2000, 2000), g.uniform(-2000, 2000), 0])
      N(3000, () => [g.uniform(-500, 500), g.uniform(-500, 500), g.uniform(-50, 50)])
      N(2500, () => [g.logUniform(-1074, 1023), g.logUniform(-1074, 1023), (g.u32() & 1) ? g.logUniform(-1074, 1023) : 0])
      N(500, () => [g.anyBits(), g.anyBits(), (g.u32() & 1) ? g.anyBits() : 0])
      break
    case 'exp':
      N(3000, () => [g.uniform(-20, 20)]); N(3000, () => [g.uniform(-750, 712)]); N(1000, () => [g.logUniform(-60, -1)]); N(300, () => [g.anyBits()])
      break
    case 'log':
      N(3000, () => [g.uniform(0, 4)]); N(3000, () => [g.logUniform(-1074, 1023, false)]); N(1000, () => [1 + g.logUniform(-53, -3)]); N(300, () => [g.anyBits()])
      break
    case 'pow':
      N(3000, () => [g.uniform(0, 3), g.uniform(-10, 10)]) // decays: 0.15^dt, (1-p)^(dt/1440)
      N(2000, () => [g.uniform(0.5, 2.5), Math.round(g.uniform(-12, 12))]) // integer tiers
      N(2000, () => [g.uniform(-3, 3), Math.round(g.uniform(-12, 12))]) // negative bases
      N(2000, () => [g.logUniform(-30, 30, false), g.uniform(-30, 30)])
      N(1500, () => { const x = g.logUniform(-12, 12, false); return [x, g.uniform(-740, 705) / Math.abs(D.detLog(x) || 1)] }) // near the edges
      N(1000, () => [g.anyBits(), g.anyBits()])
      break
    case 'cosh':
      N(3000, () => [g.uniform(-25, 25)]); N(1000, () => [g.uniform(-712, 712)]); N(300, () => [g.anyBits()])
      break
  }
  return out
}

export interface FixtureLine { fn: string; args: number[]; out: number; line: string }

export function generate(): FixtureLine[] {
  const g = new Inputs(FIXTURE_SEED)
  const lines: FixtureLine[] = []
  for (const name of Object.keys(FUNCTIONS)) {
    const [, arity, f] = FUNCTIONS[name]
    for (const args of inputsFor(name, g)) {
      const a = args.slice(0, arity)
      const out = f(...a)
      lines.push({ fn: name, args: a, out, line: `${name} ${a.map(hex).join(' ')} ${hex(out)}` })
    }
  }
  return lines
}

export interface Expected {
  format: string
  seed: number
  total: number
  functions: Record<string, { export: string; arity: number; count: number; sha256: string }>
  sample: string[]
}

export function summarize(lines: FixtureLine[]): Expected {
  const functions: Expected['functions'] = {}
  const sample: string[] = []
  for (const name of Object.keys(FUNCTIONS)) {
    const mine = lines.filter((l) => l.fn === name)
    const h = createHash('sha256')
    for (const l of mine) h.update(l.line + '\n')
    functions[name] = { export: FUNCTIONS[name][0], arity: FUNCTIONS[name][1], count: mine.length, sha256: h.digest('hex') }
    // A spread-out sample: every k-th line, so specials, everyday and extreme inputs are all in it.
    const k = Math.max(1, Math.floor(mine.length / 40))
    for (let i = 0; i < mine.length; i += k) sample.push(mine[i].line)
  }
  return { format: FIXTURE_FORMAT, seed: FIXTURE_SEED, total: lines.length, functions, sample }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const EXPECTED_FILE = path.join(root, 'tests', 'sim', 'detmath-expected.json')

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const lines = generate()
  const sum = summarize(lines)
  const outFile = path.join(root, 'dist-sim', 'detmath-fixture.txt')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, `# ${FIXTURE_FORMAT} seed ${FIXTURE_SEED}: function, inputs, output (IEEE-754 bits, hex)\n` + lines.map((l) => l.line).join('\n') + '\n')
  console.log(`[detmath] ${lines.length} lines → ${path.relative(root, outFile)}`)
  for (const [n, f] of Object.entries(sum.functions)) console.log(`  ${n.padEnd(6)} ${String(f.count).padStart(6)}  sha256 ${f.sha256.slice(0, 16)}`)
  if (args.includes('--update')) {
    fs.writeFileSync(EXPECTED_FILE, JSON.stringify(sum, null, 1) + '\n')
    console.log(`[detmath] wrote ${path.relative(root, EXPECTED_FILE)}`)
  }
  if (args.includes('--check')) {
    const want = JSON.parse(fs.readFileSync(EXPECTED_FILE, 'utf8')) as Expected
    const bad = Object.keys(sum.functions).filter((n) => want.functions[n]?.sha256 !== sum.functions[n].sha256)
    if (bad.length) { console.error(`[detmath] FAIL differs from ${path.relative(root, EXPECTED_FILE)}: ${bad.join(', ')}`); process.exit(1) }
    console.log('[detmath] matches the committed hashes')
  }
  const at = args.indexOf('--unity')
  if (at >= 0) {
    const project = path.resolve(args[at + 1] ?? '')
    const ignore = fs.existsSync(path.join(project, '.gitignore')) ? fs.readFileSync(path.join(project, '.gitignore'), 'utf8') : ''
    if (!/^\/?Rules~\/?\s*$/m.test(ignore)) { console.error(`[detmath] FAIL ${project}/.gitignore does not ignore Rules~/; not copying`); process.exit(1) }
    fs.mkdirSync(path.join(project, 'Rules~'), { recursive: true })
    fs.copyFileSync(outFile, path.join(project, 'Rules~', 'detmath-fixture.txt'))
    console.log(`[detmath] copied to ${path.join(project, 'Rules~', 'detmath-fixture.txt')}`)
  }
}
