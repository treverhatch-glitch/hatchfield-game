/**
 * Starter kit must persist — reload/HMR used to bounce play → title with an empty Game.
 */
import { Game } from '../src/game/sim.ts'
import { SAVE_KEY } from '../src/game/types.ts'

const issues: string[] = []

// jsdom-less: stub localStorage
const mem = new Map<string, string>()
;(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => {
    mem.set(k, v)
  },
  removeItem: (k) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size
  },
}

const g = new Game()
g.beginNew('easy')
g.buyLand('city')
if (!g.site) issues.push('buyLand did not set site')
g.buildStarterKit()
if (g.fits.length < 1) issues.push('starter kit no hall')
if (g.longestRunway() < 8) issues.push('starter kit no strip')

const raw = mem.get(SAVE_KEY)
if (!raw) issues.push('starter kit did not persist')

const g2 = new Game()
if (!g2.load()) issues.push('load failed after starter kit')
if (!g2.site) issues.push('loaded site missing')
if (g2.fits.length < 1) issues.push('loaded fits missing')
if (g2.longestRunway() < 8) issues.push('loaded strip missing')
if (Math.abs(g2.cash - g.cash) > 1) issues.push(`cash mismatch ${g2.cash} vs ${g.cash}`)

const out = { ok: issues.length === 0, issues, cash: g.cash, fits: g2.fits.length }
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
