import { Game } from '../src/game/sim.ts'
import {
  hasBeltNetwork,
  standBeltLinked,
  tilesOf,
} from '../src/game/path.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.cash += 20_000

if (!hasBeltNetwork(g.tiles)) issues.push('starter kit missing belt tiles')
const stands = tilesOf(g.tiles, 'stand')
const bags = tilesOf(g.tiles, 'bags')
const snack = tilesOf(g.tiles, 'snack')
if (!bags.length) issues.push('starter missing bag sort')
if (!snack.length) issues.push('starter snack overwritten by belt paint')
if (!stands.length) issues.push('starter missing stands')

for (const s of stands) {
  if (!standBeltLinked(g.tiles, s)) {
    issues.push(`stand ${s.c},${s.r} not belt-linked after starter kit`)
  }
}

// Break the chain beside makeup — hall/sort/stand should fail.
const belts = tilesOf(g.tiles, 'belt')
const cut = belts.find((b) => b.c === 11 && b.r === 21)
if (!cut) {
  issues.push('expected belt at 11,21 between bags and stand')
} else {
  g.tiles[cut.r][cut.c] = 'grass'
  g.bumpMap()
  const near = stands.find((s) => s.c === 12 && s.r === 21)
  if (near && standBeltLinked(g.tiles, near)) {
    issues.push('stand 12,21 still linked after cutting belt at 11,21')
  }
  // Far stand may still reach hall via east belts — only near stand must break.
}

// Stamp a repair belt and confirm reconnect.
g.tool = 'belt'
g.placeSingle({ c: 11, r: 21 })
const repaired = stands.find((s) => s.c === 12 && s.r === 21)
if (repaired && !standBeltLinked(g.tiles, repaired)) {
  issues.push('stand 12,21 not relinked after restamping belt')
}

// Broken-chain penalty: force note on a fake on-stand flight shape via sim path.
g.tiles[21][11] = 'grass'
g.bumpMap()
let sawNews = false
let sawSlow = false
const beforeHeat = Object.values(g.airlineHeat).reduce((a, b) => a + b, 0)
g.speed = 5
g.takeLoan()
for (let i = 0; i < 1200; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  for (const f of g.flights) {
    if (f.boardingSlow) sawSlow = true
  }
  if (g.news.some((n) => /bags late|belt broken/i.test(n.text))) sawNews = true
}
const afterHeat = Object.values(g.airlineHeat).reduce((a, b) => a + b, 0)
if (!sawSlow && !sawNews && afterHeat >= beforeHeat) {
  issues.push('broken belt never slowed boarding, nicked heat, or posted news')
}

const out = {
  ok: issues.length === 0,
  issues,
  beltCount: tilesOf(g.tiles, 'belt').length,
  sawSlow,
  sawNews,
  heatDelta: afterHeat - beforeHeat,
}
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
