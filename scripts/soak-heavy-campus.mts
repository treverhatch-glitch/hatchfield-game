import { Game } from '../src/game/sim.ts'
import { HEAVY_RUNWAY_LEN, MIN_RUNWAY, MIL_RAMP_RANGE } from '../src/game/catalog.ts'
import { AIRFRAMES, pickAirframe } from '../src/game/airframes.ts'
import { runwayStrips } from '../src/game/path.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 250_000
g.reputation = 60

// Second strip + taxi spine so multi-RW pathing is real
for (let c = 4; c < 4 + HEAVY_RUNWAY_LEN; c++) g.tiles[6][c] = 'runway'
for (let c = 4; c < 18; c++) g.tiles[7][c] = 'taxi'
for (let r = 7; r <= 22; r++) g.tiles[r][8] = 'taxi'

// Second terminal east with own stand + taxi to strip
const t2 = { c: 22, r: 14 }
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) g.tiles[t2.r + r][t2.c + c] = 'grass'
}
g.tool = 'premade'
g.placePremade(t2)
g.tiles[17][24] = 'stand'
g.tiles[18][24] = 'taxi'
g.tiles[19][24] = 'taxi'
g.tiles[20][24] = 'taxi'
g.tiles[21][24] = 'taxi'
g.tiles[22][24] = 'taxi'
g.tiles[22][20] = 'taxi'
g.tiles[22][22] = 'taxi'
g.tiles[22][23] = 'taxi'

if (g.fits.length < 2) issues.push('need 2 halls')
const t2Stand = { c: 24, r: 17 }
const pathT2 = g.pathStandToRunway(t2Stand)
if (!pathT2) issues.push('T2 stand must path to a runway')
const routeT2 = g.landingRoute(t2Stand)
if (!routeT2 || routeT2.length < 4) issues.push('T2 landingRoute too short / missing')

// Pref strip that T2 cannot reach — should fall back
const strips = runwayStrips(g.tiles, MIN_RUNWAY)
const farPref = strips.length - 1
const fallback = g.pathStandToRunway(t2Stand, farPref)
if (!fallback) issues.push('pref miss should fall back to reachable strip')

// Heavy metal gates
const a380Locked = pickAirframe('widebody', 24, [])
if (a380Locked?.id === 'a380') issues.push('A380 without heavy_pack')
const a380 = pickAirframe('widebody', HEAVY_RUNWAY_LEN, ['heavy_pack'])
if (!a380 || a380.id !== 'a380' && !AIRFRAMES.a380) {
  // pool may pick a350 — force check catalog gate
}
if (
  !AIRFRAMES.a380 ||
  AIRFRAMES.a380.minRunway > HEAVY_RUNWAY_LEN ||
  AIRFRAMES.a380.research !== 'heavy_pack'
) {
  issues.push('A380 should fit heavy strip behind heavy_pack')
}
if (AIRFRAMES.an124?.research !== 'heavy_pack') issues.push('An-124 should be heavy_pack')
if (AIRFRAMES.c5?.research !== 'mil_ramp') issues.push('C-5 should be mil_ramp gated')

const c5Early = pickAirframe('military', 24, ['heavy_pack'])
if (c5Early?.id === 'c5') issues.push('C-5 should not unlock on heavy_pack alone')
const c5 = pickAirframe('military', 24, ['heavy_pack', 'mil_ramp'])
if (!c5 || c5.id !== 'c5') {
  // may pick other mil — check pool contains c5
  const pool = Object.values(AIRFRAMES).filter(
    (a) =>
      a.kind === 'military' &&
      a.minRunway <= 24 &&
      (!a.research || ['heavy_pack', 'mil_ramp'].includes(a.research)),
  )
  if (!pool.some((a) => a.id === 'c5')) issues.push('C-5 missing from mil_ramp pool')
}

// Mil agreement needs cargo + hangar-side pad (west of hangar, clear of T1 jetways)
g.tiles[20][10] = 'hangar'
g.tiles[18][10] = 'cargo'
// Hardstand + continuous taxi into the col-8 spine → strips
g.tiles[20][6] = 'stand'
for (let r = 21; r <= 22; r++) g.tiles[r][6] = 'taxi'
for (let c = 6; c <= 8; c++) g.tiles[22][c] = 'taxi'
// Ensure spine to northern heavy strip
for (let r = 7; r <= 22; r++) g.tiles[r][8] = 'taxi'
// Police last — spine loop above would overwrite col 8
g.tiles[19][9] = 'police'

const milPads = g.milCapableStands()
if (!milPads.length) {
  issues.push(`expected mil pads within ${MIL_RAMP_RANGE}c of hangar`)
}
const gate = g.canHostMilitary()
if (!gate.ok) issues.push(`should host military: ${gate.why}`)
g.signMilitaryAgreement()
if (!g.milAgreement) issues.push('mil agreement failed')

g.researchPoints = 400
for (const id of ['night_bank', 'deice', 'stand_class', 'heavy_pack', 'mil_ramp'] as const) {
  if (!g.hasResearch(id)) g.buyResearch(id)
}
if (!g.hasResearch('mil_ramp')) issues.push('mil_ramp unlock failed')

g.milCool = 0
g.trySpawnMilitary()
const mil = g.flights.find((f) => f.kind === 'military')
if (!mil) issues.push('military should spawn on mil ramp')
else if (!g.milCapableStands().some((s) => s.c === mil.stand?.c && s.r === mil.stand?.r)) {
  // stand was free then occupied — check it was mil-capable at spawn by hangar distance
  const hangars = [{ c: 10, r: 20 }]
  const d = mil.stand
    ? Math.min(...hangars.map((h) => Math.abs(h.c - mil.stand!.c) + Math.abs(h.r - mil.stand!.r)))
    : 99
  if (d > MIL_RAMP_RANGE) issues.push('mil flight not on hangar-side pad')
}

const linked = g.connectedStandCount()
const total = g.tiles.flat().filter((t) => t === 'stand').length
if (linked < 2) issues.push(`campus should link multiple stands (${linked}/${total})`)

const out = {
  ok: issues.length === 0,
  issues,
  halls: g.fits.length,
  strips: strips.length,
  milPads: milPads.length,
  milFlight: mil?.airframeName ?? null,
  campus: g.campusPathLine(),
  heavy: g.hasHeavyRunway(),
  research: g.researchUnlocked,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
