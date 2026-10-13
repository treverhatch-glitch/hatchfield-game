# Logistics (Slice D groundwork): fuel and catering

A self-contained, deterministic TypeScript simulation of airport ground logistics. It doesn't import React, Three.js or `sim.ts`. Its only game dependency is `src/game/airframes.ts`, which it uses for per-type needs.

## What it simulates
- **Fuel farm:** storage capacity, stock, tanker-truck deliveries (`orderFuel`, with a lead time and optional auto-reorder), a purchase price per litre, a throughput fee of $0.012 per litre, and a low-stock alert.
- **Refuelling per stand:** hydrant stands pump straight from the farm at `hydrantPumpLpm` with no truck. Other stands get a fuel truck that loads at the farm, drives over and pumps at `truckPumpLpm`. Large uplifts such as an A380 take several truck trips.
- **Catering:** the kitchen produces meals per hour up to its capacity, at a cost per meal. Catering trucks load at the kitchen and deliver, and each meal earns a fee.
- **Service vehicles:** fuel truck, catering truck, baggage tug, pushback tug and GPU. A FIFO dispatch queue sends the nearest idle vehicle of the right type, with travel time based on Dijkstra over a service-road graph. Upkeep is charged per day.
- **Turnaround needs** for all 24 airframes come from `airframes.ts`. Fuel uses `fuelLoad × 60% ÷ 0.8 kg/L`, meals scale with seats by kind, and service times scale with size class S/M/L. Freighters get no catering and helicopters get no pushback.
- **Delays:** pushback starts only after every other service is done. `turnaround_complete` reports `delayMinutes` past the scheduled ready time, plus `causes`: `no_vehicle`, `no_fuel` or `no_meals`.
- **Money:** a ledger of fuel sales, catering fees, fuel purchases, meal production and vehicle upkeep, plus a `money` event for each change.
- **Sound hooks:** the `refuel_start`, `refuel_stop`, `truck_arrive` and `delivery_arrived` events. The adapter maps these to `SoundCue`s, which line up with the audio slice's truck and refuel sounds.

### Turnaround phases (passengers, bags, cargo)
Each turnaround is `inbound`, `outbound` or `turn` (a through flight does both). Pass `opts.kind`; the default is `turn`. The order is realistic:

1. **On block:** deplaning starts. Bag and cargo unloading start at the same time, and both need a loader on the stand: a **belt loader** for bulk-loaded regional and narrowbody types, a **ULD container loader** for widebodies and large freighters. **Baggage tugs** pull carts (120 bags or 6 t of cargo per trip) to **bag claim** (terminal node) and the **cargo shed**.
2. **Once deplaned:** cleaning, catering and fuel run in parallel. Fuelling with passengers on board is allowed only with `pax.fuelWithPaxOnBoard` (off by default; when it's on, fuel starts at block-in and may overlap boarding).
3. **Once the hold is empty:** tugs bring outbound bags from the **make-up area** and cargo from the shed.
4. **Boarding** starts after cleaning, catering and fuel are done. It runs in **groups** (2, 4 or 5 by size class, called 3 minutes apart), limited by passengers who are actually at the gate. Rate per door: bridge 12 pax/min, stairs 9 pax/min. Doors in use: bridge 1/1/2 and stairs 1/2/2 for S/M/L. **Remote stands** use **pax buses** (60 seats) both ways.
5. **Gate close** comes `gateCloseMinutes` (8/10/15 for S/M/L) before `readyBy`. Passengers who haven't reached the gate are **offloaded**. Their checked bags come off the make-up area, or are pulled from the hold by the loader (`bag_offload`, 3 min + 1.5 min per bag). Bags not at make-up by then are **left behind**.
6. **Door close** (2 min) happens after boarding and hold loading are done. The **pushback** tug is pre-positioned and pushes once every service, including any bag pull, is finished.

Counts come from seats × load factor (0.8 by default) or explicit `arrivingPax`, `departingPax`, `inboundBags`, `outboundBags` and cargo kg. Bags per pax are 0.7 regional, 0.9 narrowbody and 1.3 widebody. Cargo is 50% of the hold on passenger types and 80% on freighters, and freighters are cargo only.

**Terminal hooks.** `paxArrivedAtGate(standId, count | ids[])` and `bagsReadyAtMakeup(standId, count | ids[])` de-duplicate ids. Set `gateFeed` / `bagFeed`, or just call the hook once, and the fallback model is turned off for that turnaround. The fallback assumes 2% no-shows, 4% late passengers arriving 3 min before gate close, and 3% late bags. Outbound events: `pax_deplaned`, `bags_to_claim`, `cargo_to_area`, `gate_closed`, `pax_offloaded`, `bags_left_behind`.

**Delay causes** on `turnaround_complete`: `no_vehicle`, `no_loader`, `no_fuel`, `no_meals`, `no_bridge` (late, and the stand uses stairs or a bus), `boarding_slow` (passengers still at the gate at close), `late_pax` (waiting on gate arrivals pushed boarding past close), `late_bags` (bag loading ran past close while waiting on make-up) and `bag_offload`.

Results are identical however a span of time is split into `tick()` calls, because the engine jumps from one event to the next.

## API
```ts
import { createLogisticsAdapter, defaultConfig } from './logistics'

const logistics = createLogisticsAdapter({
  addMoney: (amount, category) => { /* add to sim cash / finance ledger */ },
  playSound: (cue, standId) => { /* audio engine */ },
  notify: (msg, severity) => { /* news ticker / advisor */ },
}, defaultConfig())

logistics.onAircraftParked('stand-2', 'b738', 45, { kind: 'turn' }) // when an aircraft blocks in
logistics.paxArrivedAtGate('stand-2', ['p17', 'p18']) // terminal sim -> gate
logistics.bagsReadyAtMakeup('stand-2', 40)            // bag sort -> make-up
logistics.tick(dtMinutes)                         // every sim step
logistics.isReadyToDepart('stand-2')              // gate pushback on this
logistics.delayAt('stand-2'); logistics.snapshot()
```
To work with it directly, use `new LogisticsSim(config)`, `.on(listener)`, `.startTurnaround()` and `.tick()`.

## Integration steps (for the sim owner)
1. Build a `LogisticsConfig` from the airport layout: road nodes and edges from the service roads, one `StandConfig` per stand (set `hydrant` when the hydrant upgrade is built), the farm and kitchen nodes, and the vehicle counts bought by the player.
2. Create the adapter once per game with host callbacks into cash, audio and notifications.
3. In the sim step, call `logistics.tick(gameMinutesElapsed)`.
4. When a flight parks, call `onAircraftParked(standId, flight.airframeId, scheduledTurnMinutes, { kind, departingPax })`. Give each stand an `access` (`bridge`, `stairs` or `remote`). When the terminal sim is ready, set `gateFeed`/`bagFeed` on the host and forward gate arrivals and make-up bags. Wire `onPaxDeplaned`/`onBagsToClaim`/`onCargoToArea` into arrivals, bag claim and the cargo shed.
5. Replace the fixed fuel dwell (`fuelDwellSeconds`) with `isReadyToDepart(standId)` as the pushback gate, and feed `delayAt` into delay penalties and ratings.
6. UI: show `snapshot()` in a logistics panel, and add build/buy actions for fuel trucks, the hydrant, kitchen capacity and tanker orders.
7. Rebuild the config, or add mutators later, when the player builds roads or stands. Today the config is fixed at construction.

## Tests
Run `npx vitest run src/logistics`. There are 55 tests: `logistics.test.ts` covers needs, roads, fuel, catering, stock, money and the adapter, and `turnaround.test.ts` covers phase order, the fuel safety flag, doors, bridge vs stairs vs bus, boarding groups, gate feed, no-shows and bag pulls, late pax and bags, loaders, tug trips, inbound/outbound/freighter flights, terminal hooks, and determinism across tick sizes.

## Maintenance (optional: `config.maintenance`)

Off unless `maintenance` is set (`defaultMaintenanceConfig()` gives a ready one). Seeded (`SeededRng`, mulberry32), so a given seed always produces the same run.

- **Vehicle wear:** wear builds with distance driven and jobs done. When a vehicle passes its seeded `breakAt` threshold it breaks down where it is. It then blocks that lane (`roads.setPenalty`), and its job goes back to dispatch for another vehicle.
- **Maintenance building, tiers I–III:** more bays, faster servicing and more crews at each tier. Vehicles get routine servicing in a FIFO bay queue. Preventive servicing costs less than a breakdown repair.
- **Crews:**
  - repair van: fixes vehicles in place;
  - tow truck: takes vehicles to the bays;
  - sweeper: clears runway FOD;
  - building crew: repairs facilities.
- **Facility condition** covers stands, taxiway, runway, buildings and hydrant:
  - runway FOD closes the runway;
  - worn stands go out of service;
  - a worn taxiway slows vehicles;
  - hydrant failure falls back to fuel trucks;
  - worn buildings hit passenger mood and can cause safety incidents (rating hit).
- **Outputs:** `maintenanceMetrics()` gives availability, MTBF, backlog and advisor hints. Ledger categories are `maintenance_preventive`, `maintenance_repair` and `maintenance_upkeep`. The adapter adds sound cues and the hooks `onRatingHit`, `onPassengerMoodHit` and `onRunwayStatus`.
- **Feature events:** `events-bridge.ts` maps feature events (e.g. `fuel-truck-breakdown`) onto the sim structurally, without importing `src/features`.

## Vehicle tiers / progression

`VEHICLE_CATALOG` sets the Field Level, tech tier and purchase cost for each vehicle type. Daily upkeep is in `DEFAULT_VEHICLE_SPECS`. Helpers: `isUnlocked`, `unlockedVehicles` and `fleetCost`.

| Need | Basic | Upgrade |
|---|---|---|
| Fuel | `fuel_truck` 20,000 L | `heavy_fuel_truck` 70,000 L; `hydrant_dispenser` on hydrant stands. L types have 2 fuel points served in parallel. |
| Catering | `catering_truck` | `highlift_catering` (A380 upper deck; both decks are served in parallel) |
| Containers | `uld_loader` | `main_deck_loader` (×1.6 rate) |
| Bags/cargo | `baggage_tug` | `heavy_baggage_tug` (longer cart train) |
| Pushback | `pushback_tug` | `heavy_tug` (towbarless; A380, 747-8F, An-124, C-5) |
| Bridges | 2 per stand | `bridges: 3` stand (`heavy-1`); `A380_STAND_UNLOCK` |

**Size-class compatibility:** if no suitable vehicle exists, the job is still done, but slowly, and the delay cause is `undersized_vehicle`:

- a standard tug pushing a super-heavy runs at ⅓ speed;
- standard catering on the upper deck runs at 0.4×;
- a standard ULD loader on a super-heavy runs at 0.7×.

Dispatch picks the best-fit vehicle first, then the nearest one.

`a380ScenarioConfig(upgraded)` sets up an A380 on `heavy-1` with a 120-minute schedule: about 11.5 min late with the basic fleet, on time with `A380_READY_FLEET`. This is tested in `tiers.test.ts`.
