import { Game } from '../src/game/sim.ts'

const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
for (let i = 0; i < 1200; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.layoverOffer) g.acceptLayover()
}

if (g.signed.length && !g.layover && g.hallReadyForLayover()) {
  const id = g.signed.find((x) => g.airline(x).likesLayovers) ?? g.signed[0]
  g.layoverOffer = {
    airline: id,
    age: 0,
    fee: 8000,
    duration: 45,
    transferPax: 22,
  }
  g.acceptLayover()
  for (let i = 0; i < 250; i++) g.tick(0.25)
}

console.log(
  JSON.stringify(
    {
      cash: Math.round(g.cash),
      signed: g.signed,
      extra: g.extraAirlines.map((a) => a.name),
      heat: Object.fromEntries(g.signed.map((id) => [id, Math.round(g.heatOf(id))])),
      bans: Object.keys(g.airlineBanUntil).filter((id) => g.isBanned(id)),
      layover: g.layover
        ? {
            a: g.layover.airline,
            spawned: g.layover.spawned,
            rem: Math.round(g.layover.remaining),
          }
        : null,
      flights: g.flights.map((f) => `${f.flightNo}:${f.phase}:${g.gateLabel(f.stand)}`),
      holds: g.holdingCount(),
      hall: g.hallGuests.length,
      transfers: g.hallGuests.filter((x) => x.transfer).length,
      news: g.news.slice(0, 6).map((n) => n.text),
    },
    null,
    2,
  ),
)
