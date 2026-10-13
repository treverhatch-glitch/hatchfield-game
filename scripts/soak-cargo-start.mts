/**
 * Slice 3 — cargo start focus, cargo kit (no hall), volume letters.
 */
import { Game } from '../src/game/sim.ts'
import { tilesOf } from '../src/game/path.ts'

const issues: string[] = []

const g = new Game()
g.beginNew('easy')
g.startFocus = 'cargo'
g.buyLand('factory')
g.buildStarterKit()
g.takeLoan()
g.cash += 20_000
g.speed = 5

if (g.fits.length) issues.push('cargo kit should not stamp a pax hall')
if (!tilesOf(g.tiles, 'guard').length) issues.push('cargo kit missing guard')
if (!tilesOf(g.tiles, 'cargo').length) issues.push('cargo kit missing shed')
if (!tilesOf(g.tiles, 'stand').length) issues.push('cargo kit missing stand')
if (!tilesOf(g.tiles, 'fuel').length) issues.push('cargo kit missing fuel')

let signedCargo = false
let sawVolume = false
let volumeProgress = false
let volumeCleared = false

for (let i = 0; i < 2200; i++) {
  g.tick(0.25)
  if (g.offer) {
    const a = g.airline(g.offer.airline)
    if (a.kind === 'cargo' || g.signed.length === 0) g.acceptOffer()
    else g.declineOffer()
  }
  if (g.signed.some((id) => g.airline(id).kind === 'cargo')) signedCargo = true
  if (g.cargoVolume) {
    sawVolume = true
    if (g.cargoVolume.delivered > 0) volumeProgress = true
  }
  if (g.news.some((n) => /volume clear/i.test(n.text))) volumeCleared = true
}

if (!signedCargo) issues.push('cargo focus never signed a freighter carrier')
if (!sawVolume) {
  // Force a window if cool blocked it.
  g.cargoVolumeCool = 0
  g.considerCargoVolume()
  if (!g.cargoVolume) issues.push('never saw cargo volume letter')
  else sawVolume = true
}
// Drive intake against an open window.
if (g.cargoVolume) {
  const need = g.cargoVolume.targetUnits - g.cargoVolume.delivered
  g.creditCargoVolume(Math.max(need, 1))
  if (g.cargoVolume) issues.push('creditCargoVolume did not clear the window')
  else volumeCleared = true
}
if (!volumeProgress && !volumeCleared) {
  issues.push('volume window never received progress')
}

// Pax kit still works.
const p = new Game()
p.beginNew('easy')
p.startFocus = 'pax'
p.buyLand('city')
p.buildStarterKit()
if (!p.fits.length) issues.push('pax kit missing hall')
if (!tilesOf(p.tiles, 'bags').length) issues.push('pax kit missing bags')

const out = {
  ok: issues.length === 0,
  issues,
  cargoHalls: g.fits.length,
  signedCargo,
  sawVolume,
  volumeCleared,
  warehouse: g.cargoWarehouse,
  paxHalls: p.fits.length,
}
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
