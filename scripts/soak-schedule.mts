import { Game } from '../src/game/sim.ts'

const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.scheduleAuto = true

let delayedNews = 0
for (let i = 0; i < 1400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.news[0]?.text.includes('delayed') || g.news[0]?.text.includes('slow boarding')) {
    delayedNews += 1
  }
  // Force a storm window mid-soak
  if (i === 400) {
    g.weather = 'storm'
    g.weatherCool = 40
  }
  // Force a slow board on a live flight
  if (i === 600) {
    const f = g.flights.find((x) => x.phase === 'board' || x.phase === 'servicing')
    if (f) {
      f.phase = 'board'
      f.boardingSlow = true
      f.phaseTime = 8.1
      f.waitingOn.paxIn = 2
    }
  }
}

console.log(
  JSON.stringify(
    {
      signed: g.signed,
      open: g.openSchedule().map((s) => ({
        no: s.flightNo,
        eta: Math.round(s.eta - g.clock),
        status: s.status,
        delay: Math.round(s.delaySec),
        reason: s.delayReason,
      })),
      live: g.flights.map((f) => `${f.flightNo}:${f.phase}:${f.scheduleId ? 'sched' : 'free'}`),
      heat: Object.fromEntries(g.signed.map((id) => [id, Math.round(g.heatOf(id))])),
      delayedNewsHits: delayedNews,
      news: g.news.slice(0, 8).map((n) => n.text),
    },
    null,
    2,
  ),
)
