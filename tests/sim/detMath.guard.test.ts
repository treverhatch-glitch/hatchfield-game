// PU-22 guard: nothing in the packed rules may use JavaScript's inexact math. Math.sin, cos, tan, asin, acos, atan,
// atan2, hypot, exp, log, pow, cosh (and the rest of that family) and the ** operator give different last bits in
// V8, Jint/.NET and each C library, so a replay played in the Unity port would drift. The rules use
// src/game/detMath.ts instead (detSin, detHypot, ..., and sq(v) for v ** 2).
//
//   1. Static: builds the packed rules the way npm run pack:rules does (three.js left out: it is the renderer's
//      library) and reads every bundled module's code after tree-shaking. Only code that ends up in the pack
//      counts, so a render helper the sim doesn't use may keep Math.
//   2. At run time: plays a replay day with those Math functions wrapped and expects not one call (this also
//      covers three.js and anything the static check could miss).
import { resolve } from 'node:path'
import ts from 'typescript'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { play } from '../../tools/replay/replay.ts'
import { forceSimRandom } from '../../src/game/simRng.ts'

// Waiting on another workstream (Hatch, 2026-11-01): src/diplomacy belongs to the diplomacy workstream, so its three
// Math.pow calls (departure.ts, engine.ts, standing.ts; two run every tick) stay until that workstream swaps them for
// detPow. Only Math.pow, only in src/diplomacy/. Take the entry out once they're gone; nothing else may be added here.
const WAITING_ELSEWHERE: { dir: string; fn: string }[] = [{ dir: 'src/diplomacy/', fn: 'pow' }]
const waiting = (file: string, what: string) => WAITING_ELSEWHERE.some((w) => file.includes(w.dir) && what === `Math.${w.fn}`)

const INEXACT = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'hypot', 'cbrt']

/** Each use of an inexact Math function or of ** in a piece of code: "Math.sin", "**". */
export function inexactUses(code: string, file = 'x.js'): { what: string; line: number }[] {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true)
  const out: { what: string; line: number }[] = []
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const walk = (n: ts.Node): void => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Math' && INEXACT.includes(n.name.text)) out.push({ what: `Math.${n.name.text}`, line: at(n) })
    if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Math' && !ts.isNumericLiteral(n.argumentExpression)) out.push({ what: 'Math[...]', line: at(n) })
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken || n.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken)) out.push({ what: '**', line: at(n) })
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return out
}

describe('the packed rules use only exact math (PU-22)', () => {
  it('finds the inexact uses it is meant to find', () => {
    expect(inexactUses('const a = Math.sin(x) + Math.floor(y) + z ** 2; // Math.cos in a comment\nconst f = Math.hypot').map((u) => u.what)).toEqual(['Math.sin', '**', 'Math.hypot'])
    expect(inexactUses("const s = 'Math.pow(2, 3) ** 4'; const r = Math.sqrt(2) * Math.PI")).toEqual([])
  })

  it('no module in the pack calls Math.sin, cos, atan2, hypot, pow, exp, log ... or uses **', { timeout: 120_000 }, async () => {
    const root = process.cwd()
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      build: {
        write: false,
        target: 'es2022',
        minify: false,
        lib: { entry: resolve(root, 'tools/replay/host.ts'), formats: ['es'], fileName: () => 'hatchfield-sim.mjs' },
        rollupOptions: { external: [/^node:/, /^three(\/|$)/] },
      },
    })
    type Bundle = { output: { modules: Record<string, { code: string | null }> }[] }
    const chunk = (Array.isArray(out) ? out[0] : out as unknown as Bundle).output[0]
    const modules = Object.entries(chunk.modules).filter(([id, m]) => !id.includes('node_modules') && !id.startsWith('\0') && typeof m.code === 'string' && m.code.length > 0)
    expect(modules.length, 'the pack has the rules in it').toBeGreaterThan(200)
    expect(modules.some(([id]) => id.endsWith('src/game/sim.ts'))).toBe(true)
    const found: string[] = []
    for (const [id, m] of modules) for (const u of inexactUses(m.code!, id)) if (!waiting(id, u.what)) found.push(`${id.replace(root + '/', '')}: ${u.what} (line ${u.line} of its bundled code)`)
    expect(found, `use src/game/detMath.ts instead:\n${found.join('\n')}`).toEqual([])
  })

  const saved: [string, unknown][] = []
  afterEach(() => {
    for (const [k, f] of saved.splice(0)) (Math as unknown as Record<string, unknown>)[k] = f
    forceSimRandom(() => Math.random())
  })

  it('a replay day never calls the inexact Math functions', { timeout: 120_000 }, () => {
    forceSimRandom(null) // the game's own dice, as in tests/sim/replay.test.ts
    const calls: Record<string, number> = {}
    const M = Math as unknown as Record<string, (...a: number[]) => number>
    for (const k of INEXACT) {
      const f = M[k]
      saved.push([k, f])
      M[k] = (...a: number[]) => {
        const from = new Error().stack ?? ''
        const caller = from.split('\n').slice(2).find((l) => l.includes('/src/')) ?? ''
        if (!WAITING_ELSEWHERE.some((w) => w.fn === k && caller.includes(`/${w.dir}`))) calls[k] = (calls[k] ?? 0) + 1
        return f.apply(Math, a)
      }
    }
    const days = play('city-start', 2, 1)
    for (const [k, f] of saved.splice(0)) M[k] = f as (...a: number[]) => number
    expect(days.at(-1)!.flightsDone + days.at(-1)!.paxServed, 'the day did something').toBeGreaterThan(0)
    expect(calls).toEqual({})
  })
})
