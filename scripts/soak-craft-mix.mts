import { Game } from '../src/game/sim.ts'

const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
// Unlock Guard host — hangar + police may be missing from starter; stamp them.
g.tiles[20][10] = 'hangar'
g.tiles[20][14] = 'police'
g.reputation = 55
g.cash += 50000
g.signMilitaryAgreement()
g.budgets.ambulance = 80
// Helipad for rotary
g.tiles[18][10] = 'helipad'
g.speed = 3

// Stamp cargo shed so UPPS can call, then force-sign if ready.
g.tiles[21][16] = 'cargo'
if (g.meetsReq('upps') && !g.signed.includes('upps')) {
  g.signed.push('upps')
  g.airlineHeat.upps = 70
}

for (let i = 0; i < 1600; i++) {
  g.tick(0.25)
  if (g.offer) {
    const a = g.airline(g.offer.airline)
    if (a.kind === 'cargo' || g.signed.length < 4) g.acceptOffer()
    else g.declineOffer()
  }
}

console.log(
  JSON.stringify(
    {
      signed: g.signed.map((id) => `${g.airline(id).name}(${g.airline(id).kind})`),
      mil: g.milAgreement,
      fleet: g.fleetMixLine(),
      craftSeen: g.craftSeen,
      live: g.flights.map(
        (f) => `${g.roleLabel(f.kind)}:${f.airframeName}:${f.phase}`,
      ),
      news: g.news
        .filter((n) =>
          /Passenger|Cargo|Emergency|Military|medevac|fighter|freighter|ambulance|Executive/i.test(
            n.text,
          ),
        )
        .slice(0, 10)
        .map((n) => n.text),
    },
    null,
    2,
  ),
)
