# Ground traffic control

Code: `src/atc/groundControl.ts` (pure controller), `src/atc/trafficHarness.ts`
(headless traffic sim), wired into `Game` in `src/game/sim.ts` (`tickAtc`,
`atcFollow`, `goAround`, `divertFlight`, `atcQueues`).

## Rules
- Every taxi and stand cell is a node with a FIFO reservation queue. A route is
  queued on all its ground cells when the aircraft is cleared (approach, pushback,
  taxi out, hangar tow). An aircraft rolls into a cell only at the head of its
  queue and gives it up once fully past. Two aircraft never share a cell, and a
  single head-on lane is safe: the first cleared goes first through every shared cell.
- Each runway strip is one exclusive lock. Right of way when several ask in the same
  tick: arrival on short final, vacating aircraft, departures, taxi crossings.
- A lock is only granted when the holder already heads every queue beyond the
  runway (to its stand or next runway), so the runway holder can never be stopped
  and always clears the runway.
- Departures hold short while an arrival that could actually land is inside the
  final window. An arrival whose exit is blocked does not hold departures; that is
  what keeps a single taxiway onto the runway from deadlocking.
- Arrivals stay in the stack while a departure has waited 30 s at a hold line.
- No clearance on short final → go-around: fuel charge (260 + 1.2 × seats),
  −0.6 airline standing, −0.25 reputation, 25 s slot delay. Third go-around diverts
  (same path as the 95 s hold watchdog).
- Queue waits only point at earlier clearances and a lock holder never waits, so the
  wait graph is acyclic by construction. `deadlocks()` still runs every tick; the
  weakest aircraft in a cycle yields (re-queued at the back), and a departure that
  is gridlocked a third time is towed back to its stand.

## Player-facing
- Flight cards say "Holding short of the runway" / "Holding for BA123".
- Alerts with pan-to: `N departures holding short`, `Taxi queue: N aircraft`,
  `Go-around`, `Taxiway gridlock`, `Inbound flight diverted`.

## Stress results (headless harness, 3 sim days × 86,400 s, arrival every ~10 s, 60 s turns)
| Layout | Movements/h | Go-arounds | Diversions | Max ground wait | Deadlocks / incursions / overlaps |
|---|---|---|---|---|---|
| 1 runway, single taxiway entry | 268.6 | 0 | 0 | 31.5 s | 0 / 0 / 0 |
| 1 runway, parallel taxiway, 2 entries | 194.5 | 233 | 0 | 57 s | 0 / 0 / 0 |
| 2 runways, shared apron | 343.2 | 0 | 0 | 44.5 s | 0 / 0 / 0 |

Throughput is bounded by runway occupancy time, not taxiing. Entry position
matters: the parallel layout puts entries at the ends, so departures roll the full
strip and occupy it longer than the single mid-field stub. A second runway lifts
capacity by about 28–75% depending on layout. Sim speeds are the game's (landing
1.35, taxi 1.1, roll 1.2 cells/s), so movements/h are in game seconds.

## Known edge cases
- Parked aircraft are not reserved. A stand that is also a through-route (stand
  cells in the middle of a taxi line) can still be driven over by legacy layouts.
- A plane registered on a cell already queued by others (save load mid-taxi) jumps
  the queue there; that is the only way a cycle can form, and the yield/tow
  resolution handles it.
- The legacy `groundBusy()` gate still limits pushback while anything moves without a
  tower. With the controller in place it could be relaxed for more throughput; left
  alone to keep balance and existing tests.
