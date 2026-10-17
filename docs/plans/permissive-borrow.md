# Hatchfield — borrowing from permissively licensed projects

*Written 17 Oct 2026 (Asia/Bangkok). Compared against `github/main` 434da2b1. Read-only research: shallow clones only, no browsers, no full test runs.*

Trever approved borrowing from MIT and Apache-2.0 projects. Everything here is **non-graphics** (sim, ATC and economy logic). Each project section gives what to borrow, the exact source files and functions, whether we port code or reimplement, where it lands in Hatchfield, effort, and risks. The Jules task list is at the end.

## 1. Verified licenses

The LICENSE file was read in each shallow clone under `/workspace/research_oss/permissive/`.

| Project | Repo (HEAD cloned 17 Oct 2026) | LICENSE file says | Verdict |
|---|---|---|---|
| openScope | github.com/openscope/openscope | MIT, "Copyright (c) 2014 Jon Ross". The header says "all files MIT unless specifically mentioned below", and nothing is listed below. | **Keep** |
| BlueSky | github.com/TUDelft-CNS-ATM/bluesky (46a2a8a5, 12 Oct 2026) | MIT, "Copyright (c) 2025 TU Delft". README also says MIT. | **Keep, ideas only.** 14 files still carry old *GPL v3* headers: `bluesky/__main__.py` ("Distributed under GNU General Public License v3"), `BlueSky_pygame.py`, `bluesky/test/**`, and `resources/navdata/{awy,fix,nav}.dat`. The relicense is recent and the navdata comes from an X-Plane/GPL source. BADA performance data is EUROCONTROL-licensed. **Port no BlueSky code or data.** Reimplement the textbook math only. |
| Airline Club | github.com/patsonluk/airline | Apache License 2.0 (root, plus airline-data, airline-rest and airline-web). There is no NOTICE file. | **Keep** |
| OpenTaxi | github.com/ATMRI-NTU/OpenTaxi | MIT, "Copyright (c) 2025 OpenTaxi Contributors" | **Keep**. The bundled Changi GraphML map is not needed. |
| OpenLoco | github.com/OpenLoco/OpenLoco | MIT, "Copyright (c) 2018 OpenLoco developers" | **Keep, reimplement only.** The code is a reverse-engineered re-creation of Chris Sawyer's Locomotion (functions are labelled with original addresses like `0x004BA873`). The MIT grant covers the OpenLoco authors' work, but the formulas trace back to a commercial game. We take patterns and write our own code. |

Nothing was dropped. All five are MIT or Apache-2.0 at the root. The caveats are BlueSky (stale GPL headers and data, so ideas only) and OpenLoco (provenance, so reimplement).

**Port vs reimplement summary:** we port small amounts from **openScope** (separation tables and per-type performance numbers), **Airline Club** (fare, demand and passenger-cost formulas) and **OpenTaxi** (heap A* and turn-penalty A* structure). Their license texts go in `THIRD_PARTY_NOTICES.md`. BlueSky and OpenLoco are reimplement-only, so they need no notice, though we credit them as inspiration.

## 2. What Hatchfield already has (baseline)

- **Ground ATC:** `src/atc/groundControl.ts` (`GroundControl`). FIFO cell reservations, one exclusive lock per runway with right-of-way order (arrival on short final, vacating, departure, crossing), deadlock check, `canLand`/`requestLanding`. Hold-at-line for departures is built in. It is already stronger than OpenTaxi's StopGo controllers, so **keep it and don't replace it**.
- **Runway spacing:** `src/atc/capacity.ts` uses fixed `ARRIVAL_OCCUPANCY_SEC = 14` and `DEPARTURE_OCCUPANCY_SEC = 14` for every type, plus slot slack constants. There is no wake or type-based separation in the live sim. `src/airside/runway.ts` (`getWakeMultiplier`, `runwayCapacity`) and `src/airside/holdshort.ts` (`detectConflicts`) exist but **nothing in `src/` imports them**.
- **Go-arounds:** `Game.goAround()` in `src/game/sim.ts` (~line 25960) fires when the runway isn't clear on short final. It charges fuel, hits standing and reputation, nudges the slot, and diverts at `ATC_MAX_GO_AROUNDS`. There is only one reason (runway or exit blocked) and no scoring breakdown.
- **Approach and taxi paths:** `Game.landingRoute()` (sim.ts ~24675) builds runway-strip cells plus the reversed taxi path. `src/game/flightpath.ts` (`inboundApproach`, `sampleFlightPath`) is not imported anywhere. Taxi uses `astar()` in `src/game/path.ts`, a grid A* with a **linear open-list scan** (O(n²)), no turn cost, 4-neighbour.
- **Airlines and demand:** `src/airlines/logic.ts` (unlocks, contract offers, rating), `roster.ts` (46 airlines, fleet pools), `contracts/*` (seasonal contract lines with `origin`/`destination` strings, per-pax and landing fees), and `rival/demand.ts` (fee/service/capacity split with Bellwater). There is **no city-pair demand, no fare model and no load-factor-driven growth or exit**.
- **Ratings and wear:** `src/ratings/stars.ts`, `levelgates/gates.ts`, and `maintenance/wear.ts` (`breakdownChance`, `repairCost`, not wired). Undo exists at `src/features/undo`. The seeded RNG is `src/features/shared/rng.ts` (`createRng`).
- **Airframes:** `src/game/airframes.ts` has 31 types. **22 of them have an openScope performance file:** bn2p, dhc6, crj7, a20n, b738, a321, b789, b77w, a359, at72/at76, b752, b763, b748, c130, pc12, a388, a124, c5, bcs3, b38m, a21n.

---

## 3. openScope (MIT): runway separation, go-arounds, approach and departure

**What to borrow**
1. **Same-runway separation (SRS) by category:** `AIRPORT_CONSTANTS.SRS_REDUCED_MINIMA_FEET = {CAT1: 3000, CAT2: 4500, CAT3: 6000}`, and `AircraftTypeDefinitionModel.calculateSameRunwaySeparationDistanceInFeet(previousTypeModel)`. If the leader is CAT3 (or unknown), use CAT3; otherwise use the follower's category.
2. **Departure release rule:** in `AircraftModel.js` (`FLIGHT_PHASE.WAITING` case, ~line 1508), the next departure goes only when the previous departure is airborne **and** at least `SRS distance + 2000 ft` away. This is "tower-utilised distance".
3. **Parallel-runway lateral minima:** `RunwayRelationshipModel.calculateSeparationMinimums()` gives 2500–3600 ft apart → 1 nm, 3601–8300 → 1.5 nm, 8301–9000 → 2 nm, otherwise 3 nm, plus `parallel` (<10°) and `converging` flags. These apply to Hatchfield's multi-strip fields.
4. **Go-around triggers:** `AircraftModel.cancelLanding()` (missed approach climbs to field elevation + 2000 ft, rounded to 1000) is triggered when **not established on the glidepath** (`isEstablishedOnGlidepath`), **not on the approach course** (`RunwayModel.isOnApproachCourse`, `isOnCorrectApproachGroundTrack`), or the runway is occupied. Hatchfield only has the "occupied" reason.
5. **Glideslope geometry:** `RunwayModel.getGlideslopeAltitude(distanceKm, gradient)` = elevation + tan(3°) × distance, plus `getGlideslopeAltitudeAtFinalApproachFix`.
6. **Tower score table:** `GameController.js` `GAME_EVENTS_POINT_VALUES`: ARRIVAL +10, DEPARTURE +10, GO_AROUND −50, SEPARATION_LOSS −200, COLLISION −1000, EXTREME_CROSSWIND −15, EXTREME_TAILWIND −75, LOCALIZER_INTERCEPT_ABOVE_GLIDESLOPE −10. This is a ready model for an explainable "tower performance" sub-rating.
7. **Per-type performance data:** `assets/aircraft/*.json` (170 types) with `weightClass`, `category.srs`, `category.recat`, `runway.takeoff`/`landing` (km), and `speed.landing`. These fill wake class, SRS category and approach speed for our 22 matching airframes.

**Port or reimplement:** port the **numbers** (SRS table, lateral-minima brackets, score values, and per-type `srs`/`recat`/`weightClass`/`speed.landing` for the 22 matches) into a TS data file with a "Derived from openScope (MIT)" header. Reimplement the logic in TS, since openScope is class-heavy JS tied to its own globals. Keep the MIT notice in `THIRD_PARTY_NOTICES.md`.

**Maps onto Hatchfield**
- New `src/atc/separation.ts`: `requiredGapSec(leader, follower, op)` and `srsCategory(airframeId)`, using the data table in `src/atc/separationData.ts`. It complements `capacity.ts` constants and later replaces the flat 14 s for mixed fleets. The unwired `airside/runway.ts` `getWakeMultiplier` can be folded in.
- New `src/atc/goAroundRules.ts`: `goAroundReason({runwayOccupied, exitBlocked, stableApproach, wakeGapOk}) → reason | null`, so `Game.goAround()` can say *why* (blocked, wake, unstable) in the alert.
- New `src/atc/towerScore.ts`: event → points, with a rolling window and a breakdown. It feeds the explainable airport rating and level gates.
- New `src/atc/procedures.ts`: glideslope altitude, missed-approach altitude and departure climb gradient, for later use by `flightpath.ts` and `render/flightPose.ts` (render wiring is out of scope here).

**Effort:** about 1.5 days of additive modules plus tests, then about 2 days to wire after the playthrough.
**Risks:** type-based gaps change runway throughput, a sim timing change that could threaten the 15-flight / 0-divert floor in `src/game/runwayCapacity.test.ts`. So wiring is post-playthrough and flag-gated, and the gaps must be scaled to Hatchfield's compressed world (cells and game seconds, not nm). Real type names appear in openScope data, but we key it by our airframe ids, so no names are imported.

---

## 4. BlueSky (MIT, ideas only): conflict prediction, descent planning, metering

**What to borrow (as ideas)**
1. **Closest-point-of-approach conflict detection:** `bluesky/traffic/asas/statebased.py` `StateBased.detect()`. Pairwise relative velocity gives `tcpa = −(du·dx + dv·dy)/|dv|²` and `dcpa² = dist² − tcpa²·|dv|²`. A conflict exists when `dcpa < R` and the time-in-zone window `[tcpa − √(R²−dcpa²)/vrel, …]` overlaps `[0, lookahead]`. There is an optional vertical window. This is standard geometry.
2. **Top-of-descent / VNAV:** `bluesky/traffic/autopilot.py` `Autopilot.ComputeVNAV()` (descend as late as possible to meet the next altitude constraint, climb as early as possible). We'd use it for a believable approach profile and departure climb.
3. **Required time of arrival:** `Autopilot.setspeedforRTA()` adjusts speed to hit a target time at a fix. In Hatchfield this becomes **arrival metering**: slow or speed an inbound slightly to hit its runway slot instead of a go-around or `delaySlot`.
4. **Flight-phase classifier:** `traffic/performance/openap/phase.py` `get_fixwing()` (ground / initial climb / approach / climb / descent / cruise from altitude and vertical rate). Useful for analytics and the flight card.

**Port or reimplement:** **reimplement only.** Don't copy files, and don't use `resources/navdata`, BADA or OpenAP data. No notice required, but credit BlueSky (TU Delft) as inspiration.

**Maps onto Hatchfield**
- New `src/atc/cpa.ts`: `cpa(a, b) → {tcpa, dcpa}` and `predictConflicts(tracks, radius, lookahead)`. It is a pure 2D (+optional z) function. Uses: a short-final wake check, warning before an arrival rolls onto a runway a crossing aircraft is entering (complements `airside/holdshort.ts` `detectConflicts`), and a test oracle for the traffic harness (`src/atc/trafficHarness.ts`).
- `src/atc/procedures.ts` (shared with openScope): `topOfDescentDist(altNow, altTarget, gradient)`.
- New `src/atc/metering.ts`: `meterSpeed(etaSec, slotSec, vNow, vMin, vMax) → v`. Post-playthrough, since it changes timing.

**Effort:** about 1 day for cpa and procedures. Metering is about 1.5 days to wire later.
**Risks:** licensing (handled by not porting). Metering alters arrival timing, so it's post-playthrough and behind a flag.

---

## 5. Airline Club (Apache-2.0): route choice, ticket pricing, city-pair demand

**What to borrow**
1. **Standard fare:** `airline-data/src/main/scala/com/patson/model/Pricing.scala` `computeStandardPrice(distance, flightType, linkClass)`. Base 100, then distance brackets `(200 km × 0.25), (800 × 0.125), (1000 × 0.1), (rest × 0.05)`, ×1.05 international, ×1.1 intercontinental, × class multiplier, × 1.5.
2. **City-pair demand (gravity model):** `DemandGenerator.computeDemandBetweenAirports(from, to, relationship, passengerType)`. Demand = (origin income × population) × (destination population × income level) × trip-type factor × flight-type multiplier (short-haul domestic ×10 … ultra-long ×0.25), with diminishing demand under 400 km, a zero cutoff under 50 km, and a first/business/economy split by income (`FIRST_CLASS_PERCENTAGE_MAX`, `BUSINESS_CLASS_PERCENTAGE_MAX`).
3. **Passenger perceived cost:** `model/FlightPreference.scala` `computeCost()` = standard price × `priceAdjustRatio` (1 + Δprice × priceSensitivity / standard) × `qualityAdjustRatio` (quality vs expectation, with diminishing returns over +20) × `loyaltyAdjustRatio` × trip-duration. Preference pools (`SimplePreference` = price-sensitive budget flyer, `SpeedPreference`, `AppealPreference` = loyal/quality flyer) are drawn per passenger group.
4. **How AI airlines pick routes and size fleets:** `init/AirlineGenerator.scala` `generateLinks()`. Draw destinations from the top-demand pool (`drawFromPool`, a 30% skip walk), estimate one-way demand, pick the **smallest airframe that covers demand at max frequency**, set frequency = demand / capacity, and price at the standard fare.
5. **Load-factor pressure:** `LinkSimulation.scala` `checkLoadFactor()`. A route below a load-factor threshold gets a warning alert with a countdown, and if it stays low the licence is revoked (the route closes), with competitors notified.

**Port or reimplement:** **port** the formulas into TS (Apache-2.0 permits it). Each ported file keeps a header: "Portions derived from Airline Club (github.com/patsonluk/airline), Apache License 2.0; modified for Hatchfield". The Apache text goes in `THIRD_PARTY_NOTICES.md`. Apache 4(b) requires stating changes, so the header must say "modified". Tunables are rescaled for Hatchfield's money scale.

**Maps onto Hatchfield**
- New `src/airlines/market.ts`: `standardFare(distanceKm, flightType, cabin)`, `cityPairDemand(origin, dest, opts)`, `cabinSplit(...)`. Inputs come from contract `FlightLine.origin`/`destination`. Destination population, income and distance come from a small fictional city table, or OurAirports data later (public domain).
- New `src/airlines/perceivedCost.ts`: `perceivedCost(fare, standard, quality, expectedQuality, loyalty, prefs)`. This connects our airport service quality (rating) to whether an airline's route sells. It also feeds the per-airline service rating and the approved happiness value-for-money idea.
- New `src/airlines/routePlanner.ts`: `pickAirframe(demandSeats, distanceKm, allowed[])` (smallest that covers demand → **bigger aircraft as the airport and demand grow**, as Trever asked) and `proposeLines(airline, cityTable, rng)`. It uses the fleet pools in `airlines/roster.ts` and size tiers in `scale/logic.ts`.
- New `src/airlines/loadFactorWatch.ts`: a pure state machine (`ok → warned(daysLeft) → dropped | upgraded`). Post-playthrough it drives airline growth (upgauge on high load factor) or exit (contract early-cancel, or the existing Bellwater walkaway in `rival/`).

**Effort:** about 2 days for modules and tests. Wiring into contract offers and growth is about 3–4 days after the playthrough.
**Risks:** economic balance. Wiring changes contract offers and revenue, so it waits for the playthrough. Airline Club's numbers assume real-world populations, so they need rescaling. Real city names are fine (facts), but keep airline and aircraft names fictional per the Steam plan.

---

## 6. OpenTaxi (MIT): taxi routing and hold-short

**What to borrow**
1. **Heap-based A*:** `opentaxi/planners.py` `AStarPlanner.plan_shortest_path()` (heapq open set with an insertion counter for stable ties). Hatchfield's `astar()` scans the whole open list every pop (O(n²)), so a binary heap is the big win on large fields. Tie-break order must be pinned to keep paths identical.
2. **Turn-penalty A*:** `AStarPlanner.plan_minimum_turn_path()`. The state is (node, heading), and the cost adds `|Δheading|/π × turn_penalty_weight` (`_compute_turn_cost`). That gives fewer zig-zags on grid taxiways, so jets follow taxiway centrelines in straighter legs.
3. **Routing constraints:** `_is_valid_edge()`. **No passing through runway interiors** unless the runway is the start, and **no entering a parking (stand) dead-end** unless it's the goal. This is the hold-short and no-shortcut rule in graph form.
4. **Plan-time conflict audit:** `detect_head_on_conflicts(trajectories)` flags opposite-direction use of the same edge. `compute_path_stats()` gives length, number of turns (>15°) and total turn angle.
5. **Taxi priority and wait points:** `controller.py` `Opt_StopGo.update()`. Priority = shortest remaining distance first. `_get_min_future_distance` and `_get_safe_travel_distance` look ahead, and `_get_wait_point` stops an aircraft *before* the conflict point (a dynamic hold-short).
6. **Speed by curvature:** `plan_velocity_profile()`, v = √(1.5/κ)·3.6 capped at 30 km/h, so jets slow in turns.

**Port or reimplement:** **light port** of the A* and turn-penalty structure into TS (small, generic, credited "structure derived from OpenTaxi (MIT)"), with the MIT notice in `THIRD_PARTY_NOTICES.md`. Items 4–6 are reimplemented ideas. `GroundControl` stays the authority. OpenTaxi's StopGo is weaker than our reservation model, so we only borrow its **priority** and **look-ahead wait point** ideas for tie-breaks.

**Maps onto Hatchfield**
- New `src/game/pathHeap.ts`: `astarHeap(tiles, start, goal, kind, pass?, gate?, stepCost?)`, a drop-in signature match for `path.ts astar()`. Plus `astarTurn(..., turnPenalty)` for `kind === 'jet'`. **Coordinate with Jules sys_14 (path cache)**, which caches results, while this speeds up the search itself.
- New `src/atc/routeAudit.ts`: `headOnEdges(routes)`, `crossesRunwayInterior(route, tiles)`, `turnStats(route)`. Test-only at first, used by `atc/trafficStress.test.ts` and the harness.
- Post-playthrough: use `astarTurn` in `Game.pathStandToRunway`/`landingRoute`, and add a remaining-distance tie-break in `GroundControl.arbitrate()` for equal-rank crossings.

**Effort:** about 1.5 days for the heap and turn A* with equivalence tests, and 0.5 day for the audit. Wiring is about 1–2 days post-playthrough.
**Risks:** a heap with different tie-breaks returns different equal-cost paths, which shifts timing, so pin equivalence (same cost; same path when the flag is off). Turn-penalty routes are slightly longer, which is a timing change, so post-playthrough. A curvature speed profile changes taxi times, so post-playthrough and flagged.

---

## 7. OpenLoco (MIT, reimplement only): building and vehicle system patterns

**What to borrow (patterns)**
1. **Eased, explainable station rating:** `src/OpenLoco/src/World/Station.cpp` `Station::calculateCargoRating()` sums visible components: cargo freshness (age ≤7 → +165 … ≤45 → +40), queue size (≤100 waiting → +130 … >1000 → 0, after a −130 base), vehicle speed bonus, and vehicle age bonus, clamped 0–200. `updateCargoRating` (~line 699) then moves the *actual* rating toward the *target* by at most ±2 per tick, with effects at thresholds (≤50 loses cargo, ≥100 counts as good). This is exactly the approved "airport rating that explains itself" plus "happiness eases toward a target".
2. **Reliability and breakdowns:** `Vehicles/VehicleHead.cpp` (~lines 395–430) and `VehicleBogie.cpp` `sub_4BA873`. Reliability drops a fixed amount per day (`kReliabilityLossPerDay = 4`, ×2.5 once obsolete), and a random `timeoutToBreakdown` is drawn from reliability² so worn units break sooner. A breakdown sets `breakdownPending` and then `brokenDown` for a timeout, and servicing restores reliability. This maps onto `maintenance/wear.ts` and the approved breakdowns/inspections.
3. **Two-phase game commands:** `GameCommands/GameCommands.cpp` `doCommand()` with flags. Every action runs as *estimate* (cost or fail, no side effects) then *apply*. One command file per action (`GameCommands/Airports/CreateAirport.cpp`, `Vehicles/VehicleSell.cpp`, …). This fits our command/undo/replay plan (`src/features/undo`) and gives build-cost previews for free.
4. **Vehicle order lists:** `include/OpenLoco/Vehicles/Orders.h` (`OrderStopAt`, `OrderRouteThrough`, `OrderWaitFor` cargo, `OrderUnloadAll`). This is the right shape for the approved **city buses** (stop at city → curb) and **apron buses** (gate → wait for N pax → stand → unload).
5. **Town growth tick:** `World/Town.cpp` `Town::updateMonthly()` / `grow()`. A monthly growth roll is driven by service, which suits a city catchment that grows with airport service and noise.

**Port or reimplement:** **reimplement only** (provenance caveat above). No notice required, but credit OpenLoco as inspiration.

**Maps onto Hatchfield**
- New `src/ratings/easedRating.ts`: `targetFromComponents(components) → {target, breakdown[]}` and `easeToward(current, target, maxStep)`. It then feeds `ratings/stars.ts` and `levelgates/gates.ts` (wiring post-playthrough).
- New `src/maintenance/reliability.ts`: `decay(rel, days, obsolete)`, `drawTimeoutToBreakdown(rel, rng)`, `inspect(rel)`. It uses `features/shared/rng.ts` and complements `wear.ts`.
- `src/features/undo`: an `estimate()`/`apply()` pair on commands (with the approved hardcore mode turning undo off).
- Future `src/landside/busOrders.ts` for city and apron buses (after the playthrough, per Trever).

**Effort:** about 1 day each for easedRating and reliability. The command estimate phase is about 1 day. Bus orders are part of the post-launch bus feature.
**Risks:** wiring the eased rating changes how fast stars and levels move (live behaviour), so it waits for the playthrough. Breakdowns wired live affect throughput and the 0-divert floor.

---

## 8. Top borrowable items (plain words)

1. **Bigger planes need bigger gaps** (openScope): heavy-then-light spacing by aircraft category instead of a flat 14 s, and go-arounds that say *why* they happened.
2. **City-pair demand and fair ticket prices** (Airline Club): each route gets believable demand and a standard fare, so airlines pick routes, size their planes to demand and upgrade to bigger jets as the airport grows.
3. **Load-factor pressure** (Airline Club): routes that keep flying empty get a warning, then drop. Full routes get bigger planes.
4. **Passengers weigh price against quality** (Airline Club): our service quality directly decides whether an airline's flights sell.
5. **Faster, smoother taxi routing** (OpenTaxi): a heap-based route search (much faster on big fields) and an option to prefer straight taxi legs, plus a test that flags head-on taxi routes.
6. **A tower score** (openScope): points for clean arrivals and departures, penalties for go-arounds and lost separation, feeding the airport rating.
7. **Ratings that ease and explain themselves** (OpenLoco): a target built from visible parts, with the real rating drifting toward it.
8. **Wear and breakdowns** (OpenLoco): reliability falls daily, worn kit breaks sooner, and inspections reset it.
9. **Conflict prediction and arrival metering** (BlueSky, ideas): spot two aircraft heading for the same spot early, and nudge arrival speeds to hit their slot instead of going around.

## 9. Licence housekeeping

- `THIRD_PARTY_NOTICES.md` in the repo root lists openScope (MIT), OpenTaxi (MIT) and Airline Club (Apache-2.0, full text), with "credited, no code used" lines for BlueSky and OpenLoco.
- Every ported file starts with a header naming the source project, its license, and "modified for Hatchfield".
- Before Steam, the credits screen should show the THIRD_PARTY_NOTICES content.

---

## 10. Jules tasks

All tasks share these **rules**:
- No sim timing changes unless the task is flagged *post-playthrough*. Pre-playthrough tasks add new modules and tests only, are not imported by `src/game/sim.ts`, and change no existing behaviour.
- The scripted 15-flight floor in `src/game/runwayCapacity.test.ts` must stay at **≥15 flights and 0 diverts**.
- **Never commit** `docs/screens/**` PNGs, `docs/devlog/**` or gate logs, or scratch scripts (`*.py`, `patch_*.cjs`, `lint_*.txt`). Run `git status` before publishing.
- No graphics or render changes (`src/render/**` untouched).
- Ported code keeps the source-project header (see section 9).
- Verify with `npx vitest run <new test files>` plus `npx tsc -b`, and run `npx vitest run src/game/runwayCapacity.test.ts` for anything near ATC.

**PRE-playthrough (safe: additive module + tests, not wired)**
- PB-01 Runway separation table (openScope)
- PB-02 Go-around reasons + tower score (openScope)
- PB-03 CPA conflict predictor + approach/departure geometry (BlueSky ideas, openScope glideslope)
- PB-04 Heap A* + turn-penalty A* (OpenTaxi)
- PB-05 Taxi route audit (OpenTaxi)
- PB-06 Market model: fare, demand, cabin split (Airline Club)
- PB-07 Perceived cost + route planner (Airline Club)
- PB-08 Load-factor watch (Airline Club)
- PB-09 Eased rating (OpenLoco pattern)
- PB-10 Reliability and breakdown timer (OpenLoco pattern)

**POST-playthrough (change live sim; flag each one, default off until Trever OKs it)**
- PB-20 Wire type-based runway separation into spawn spacing
- PB-21 Wire go-around reasons + tower score into `Game.goAround` and the airport rating
- PB-22 Use heap A* and turn-penalty taxi routes in the live sim
- PB-23 Wire the market model into contract offers and airline growth or exit
- PB-24 Wire the eased rating into stars, levels and pax happiness
- PB-25 Wire reliability into ground vehicles and mechanics
- PB-26 Arrival metering (speed to slot)

The full briefs are in `/workspace/gfx_baseline/jules_queue.md` under "Permissive-borrow tasks (17 Oct)".
