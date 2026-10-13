# Hatchfield Flow System: Brainstorm and Spec (v1)

Status: spec plus core implementation (pure TS, `src/flow/`, branch `grok/flow`). Builds on ECONOMY_TECHTREE.md (Manor Lords research): every service is a chain of source, storage, transport and point of use, and every bottleneck must be visible and explained.

## 1. Goal and owner rules
- Everything that moves is a **unit** with a **flow**. Every building or zone **accepts** units, **buffers/stores** them, **processes** them with staff and capacity, and **dispatches** them onward.
- **Passengers are always visible in-world** as individual agents. The flow layer never hides them; it measures them.
- On top sit **Cities: Skylines-style info views**: one per unit type, flow rates on links, green-to-red congestion, hotspot markers, route tracing, a legend and a compact panel. Off by default; toggled from settings, the bottom bar or hotkey F (existing "Show passenger flows" toggle becomes the Passengers view).
- The same data powers an **audit report** (throughput, losses, waits, weakest link per chain) and the **design advisor**.
- Prefabs never lose passengers: overload shows as queues, delays and missed flights, never "lost".

## 2. Brainstorm: what Manor Lords teaches a flow model
1. Goods are physical: a building with no input produces nothing (starvation) and a building with a full output buffer stops (blocked). Both states must be named in the UI, not silent.
2. Staff are the throttle: throughput = base rate x tier x staffing ratio x morale x power x wear.
3. Distance costs throughput: a far fuel farm means fewer truck round trips per hour. Links carry distance and travel time.
4. Storage is a buffer that hides problems until it runs dry; show fill bars and "time to empty".
5. The fix menu is always build more, upgrade tier, or research. Every bottleneck report maps to those three.
6. Avoid Manor Lords' opacity: every starved node lists *which* input is missing and *which* upstream node caused it (root cause trace).
7. Avoid hidden hauling drain: vehicles are their own unit type and pool, visible in the Service Vehicles view.

Extra ideas: "time to empty" warnings on stores; per-chain sparkline in the panel; ghost preview of capacity before placing a building; a "lesson learned" RP bonus when a hotspot clears and stays clear for a week; heat replay of the last game-day in the audit.

## 3. Unit types
| Unit | Mode | Visual |
|---|---|---|
| `passenger` (dep/arr) | individual agents (always shown) + aggregated counters | people |
| `bag` | aggregate | dots on belts, carts |
| `cargo` (ULD/pallet) | aggregate | containers |
| `fuel` (litres) | aggregate continuous | pipe/truck |
| `meal` (catering) | aggregate | trolleys |
| `supply` (catering/retail raw goods) | aggregate | trucks |
| `staff` (by role) | pool, aggregate | uniforms near posts |
| `vehicle` (fuel truck, catering truck, tug, GPU, bus, loader) | individual vehicles; flow layer counts trips | vehicles |
| `power` (kW) | continuous | grid lines |

## 4. Node model
Each node: `id, kind, label, chain, position, inputs, buffers, process, outputs, staff, power`.
- **Inputs**: accepted unit types; optional recipe (e.g. kitchen: 1 supply -> 4 meals).
- **Buffer**: per unit, capacity (store size or queue length). Over capacity, upstream links are blocked.
- **Process**: `ratePerMin` base x `tierMult` x `staffing` (staffAssigned/staffRequired, capped 1) x `efficiency` (morale, power, wear, research).
- **Outputs**: weighted split across outgoing links (fixed weights, or demand-pull for gates/stands).
- **Sources/sinks**: entry curb (pax arrive per schedule), tanker supplier, airplane hold (sink), exit curb (sink).
- **States** (per tick): `ok`, `starved` (has capacity but no input), `blocked` (output buffer full or all outgoing links saturated), `understaffed` (staffing < 1), `overloaded` (utilisation > 0.95 with queue growing), `idle` (no demand).
- **Metrics**: in/out rate (EMA per min), queue length, mean wait (Little's law: queue / outRate), utilisation (out / effective capacity), cumulative processed/lost/missed.

## 5. Link model
`from, to, unit, capacityPerMin, distance, mode (walk | belt | pipe | vehicle | conveyor), travelTime`.
- Load = units moved per minute (EMA). Congestion = load / capacity, 0 to 1+.
- Vehicle links: capacity = pool vehicles x payload / round trip (2 x distance / speed + service time). Shorter roads or more vehicles raise capacity: this is the Manor Lords distance lesson.
- In-transit units are tracked so travel time is honoured (pipeline queue).

## 6. Per-building node definitions
| Building / zone | Inputs | Buffer | Process (base) | Staff role | Outputs |
|---|---|---|---|---|---|
| Curb / terminal entry | pax (schedule), car/bus | curb queue | entry gates 60/min | none | check-in, (online check-in pax skip to security) |
| Check-in desk / kiosk / bag drop | pax, bags | desk queue | 1 desk ~1.5 pax/min; kiosk +30% | Terminal Staff | pax->security, bags->bag sort |
| Security lane | pax | queue | 20/min per lane (CT +50%) | Security Officers | airside hall |
| Hold-bag screening (HBS) | bags | belt | 30 bags/min per machine | Security | bag sort; reject 1% -> manual search |
| Bag sort / make-up | bags | make-up area | sorter tier rate | Ground Crew | carts per flight -> stand |
| Gate area / holdroom | pax | seats | boarding rate per door/jet bridge/stairs/bus | Gate agents | aircraft (stand) |
| Shops / food / toilets | pax dwell + retail supply | shelf stock | service rate; shelf empties -> lost spend | Retail Workers | pax back to hall; revenue |
| Arrivals: immigration/claim | pax, bags | carousel | carousel bags/min | Terminal Staff | exit curb |
| Exit curb | pax | — | transit capacity | — | sink |
| Catering kitchen | supply (truck) | cold-store | recipe 1 supply -> 4 meals | Ground Crew (catering) | meals -> catering trucks -> stand |
| Fuel farm / depot | fuel (tanker) | tank litres | pump rate | Ground Crew (fuel) | hydrant pit (pipe) or fuel truck -> stand |
| Hydrant pit | fuel (pipe) | — | dispenser rate | fuel crew | aircraft |
| Cargo shed | cargo (truck, hold) | racks | ULD build/break rate | Ground Crew | stand loaders / landside trucks |
| Stand / aircraft | pax, bags, cargo, fuel, meals | aircraft needs | turnaround steps (PR #5 + turnaround job) | ramp crew | departs (sink) / unloads arrivals |
| Staff pool (by role) | commuters, housing | pool | shift change | — | staff assigned to nodes |
| GSE depot / vehicle pool | vehicles | parking | dispatch | drivers | vehicle trips (feeds vehicle link capacity) |
| Substation / power | grid | — | kW | techs | power to nodes; shortfall -> efficiency drop |
| Maintenance depot | wear | job queue | jobs/hr | Maintenance Techs | restores efficiency |

## 7. Bottleneck detection
- Per node score = max(utilisation, congestion of outbound links) + queue growth trend + starvation/blocked flags.
- **Hotspot**: node or link with congestion >= 0.85 or queue wait above target (pax 10 min, bags 15 min) for 3 consecutive samples. Severity low/med/high.
- **Root cause**: for a starved node walk upstream to the first node that is overloaded/blocked/understaffed; for a blocked node walk downstream.
- **Weakest link per chain**: lowest effective capacity / demand ratio among the chain's nodes and links.

## 8. Info views (CS1/CS2 reference)
CS1 "Info Views" (traffic, public transport routes, water/sewage, garbage) and CS2 "Info views" with route highlighting and flow arrows, plus CS2's "Traffic flow" panel and route tool (click a vehicle or building to see where its traffic comes from and goes).
- One view per unit: **Passengers, Bags, Cargo, Fuel, Catering, Staff, Service Vehicles** (and Power later). Buildings irrelevant to the view are greyed (CS-style desaturation); relevant ones tinted by state.
- **Links**: width = flow rate, colour = congestion gradient green (#2ecc71) -> yellow (#f1c40f) -> orange (#e67e22) -> red (#e74c3c); animated arrows show direction.
- **Hotspots**: pulsing red rings with a small badge (wait time or "starved: fuel").
- **Route tracing**: select a unit or building; highlight upstream (blue) and downstream (purple) paths with share percentages ("62% of this gate's pax came via Security Lane 2").
- **Legend** (gradient + symbols) and **compact panel**: throughput/min, mean wait, top 3 hotspots, weakest link with "Fix: build / upgrade / research" buttons.
- Passengers always visible; the Passengers view only adds heat and lines.

## 9. Audit report
Per chain and per node, rolled up weekly/monthly (fits the pop-in report, never pauses play): throughput, demand served %, losses (missed flights, mishandled bags, lost retail spend, spoilt meals, fuel shortfall), mean/p95 wait, utilisation, starved/blocked minutes, weakest link, and conservation check (in = out + stored + in-transit + lost; drift flags bugs).

## 10. Advisor and tech tree
- Advisor reads hotspots and weakest links and maps them to fixes: build more (another lane/truck), upgrade tier (Check-in Hall II), research node (CT Scanners, Hydrant Fuel System, Tilt-Tray Sorter).
- Clearing a hotspot that stays clear for a week grants the "lesson learned" RP bonus.
- Tech nodes are efficiency multipliers or capacity changes on node definitions; the flow graph needs no special code.

## 11. Performance plan
- Aggregate flows for bags, cargo, fuel, meals, supply, staff, power: fixed-step tick (e.g. 1 game-second), O(nodes + links), allocation-free hot loop.
- Passengers stay individual agents in sim.ts; the flow layer counts them at node boundaries (enter/leave events) rather than simulating them twice.
- Metrics use EMA, hotspots sampled every N ticks, info-view colours recomputed only when the view is open and at most 4 times/sec.
- Budget: 500 nodes / 1,500 links under 0.5 ms per tick.

## 12. Integration plan
- `src/flow/` is pure TS with no imports from sim, UI, render or logistics.
- **Logistics (PR #5)**: `adapters/logistics.ts` takes a structural description (fuel farm, kitchen, vehicle pools, stands) and registers nodes and vehicle links; logistics remains the authority for vehicle dispatch, and reports deliveries to the flow graph.
- **Terminal sim (sim.ts, Cursor agent)**: `adapters/terminal.ts` registers zones as nodes and exposes `recordEnter/recordLeave` counters so sim.ts can call them as agents cross zones. No sim.ts changes in this PR; the owning agent wires the two calls.
- **UI (PR #4)**: reads `infoView(unit)` and `audit()`; legend and compact panel slot into the bottom bar and status strip.
- **Render**: consumes `InfoViewData` (colour hex + width per link, tint per node, hotspot list) and draws lines and rings.
- Wiring happens after PRs #4/#5 land, matching the agreed plan order.

## 13. Open questions
1. Should the info views show live numbers on every link, or only on hover?
2. Should starvation of retail supply cost reputation, or just revenue?
3. Weekly vs monthly default for the audit pop-in.
