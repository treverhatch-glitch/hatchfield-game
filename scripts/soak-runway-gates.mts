import {
  jetAirframesBlocked,
  jetAirframesFitting,
  pickAirframe,
  pickAirframeWithFallback,
  stripTier,
} from '../src/game/airframes.ts'
import { Game } from '../src/game/sim.ts'
import { SHORT_RUNWAY_LEN, RUNWAY_PREFAB_LEN, HEAVY_RUNWAY_LEN } from '../src/game/catalog.ts'

function report(label: string, cells: number) {
  const ok = jetAirframesFitting(cells).map((a) => a.name)
  const no = jetAirframesBlocked(cells).map((a) => a.name)
  const wide = pickAirframe('widebody', cells)
  const nb = pickAirframeWithFallback('narrowbody', cells, false)
  const freight = pickAirframeWithFallback('freighter', cells, true)
  console.log(
    JSON.stringify(
      {
        label,
        cells,
        tier: stripTier(cells),
        okCount: ok.length,
        blockedCount: no.length,
        sampleOk: ok.slice(0, 6),
        sampleBlocked: no.slice(0, 6),
        widebody: wide?.name ?? null,
        fallbackPax: nb?.name ?? null,
        fallbackCargo: freight?.name ?? null,
      },
      null,
      2,
    ),
  )
}

report('short prefab', SHORT_RUNWAY_LEN)
report('regional prefab', RUNWAY_PREFAB_LEN)
report('heavy prefab', HEAVY_RUNWAY_LEN)

// Live field: short-only vs upgrade to heavy
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
// Wipe starter path — stamp short only
g.tiles = g.tiles.map((row) => row.map(() => 'grass' as const))
g.facing = 'h'
for (const p of g.prefabRunway({ c: 8, r: 24 }, 'short')) g.tiles[p.r][p.c] = 'runway'
console.log('live short', {
  longest: g.longestRunway(),
  tier: g.stripTierLabel(),
  line: g.stripCapabilityLine(),
})
for (const p of g.prefabRunway({ c: 6, r: 20 }, 'heavy')) g.tiles[p.r][p.c] = 'runway'
console.log('live after heavy', {
  longest: g.longestRunway(),
  tier: g.stripTierLabel(),
  line: g.stripCapabilityLine(),
})
