# Logistics (Slice D groundwork): fuel and catering

A self-contained, deterministic TypeScript simulation of airport ground logistics. It doesn't import React, Three.js or `sim.ts`. Its only game dependency is `src/game/airframes.ts`, which it uses for per-type needs.

## What it simulates
- **Fuel farm:** storage capacity, stock, tanker-truck deliveries (`orderFuel`, with a lead time and optional auto-reorder), a purchase price per litre, a sell markup and a low-stock alert.
- **Refuelling per stand:** hydrant stands pump straight from the farm at `hydrantPumpLpm` with no truck. Other stands get a fuel truck that loads at the farm, drives over and pumps at `truckPumpLpm`. Large uplifts such as an A380 take several truck trips.
- **Catering:** the kitchen produces meals per hour up to its capacity, at a cost per meal. Catering trucks load at the kitchen and deliver, and each meal earns a fee.
- **Service vehicles:** fuel truck, catering truck, baggage tug, pushback tug and GPU. A FIFO dispatch queue sends the nearest idle vehicle of the right type, with travel time based on Dijkstra over a service-road graph. Upkeep is charged per day.
- **Turnaround needs** for all 24 airframes come from `airframes.ts`. Fuel uses `fuelLoad × 60% ÷ 0.8 kg/L`, meals scale with seats by kind, and service times scale with size class S/M/L. Freighters get no catering and helicopters get no pushback.
- **Delays:** pushback starts only after every other service is done. `turnaround_complete` reports `delayMinutes` past the scheduled ready time, plus `causes`: `no_vehicle`, `no_fuel` or `no_meals`.
- **Money:** a ledger of fuel sales, catering fees, fuel purchases, meal production and vehicle upkeep, plus a `money` event for each change.
- **Sound hooks:** the `refuel_start`, `refuel_stop`, `truck_arrive` and `delivery_arrived` events. The adapter maps these to `SoundCue`s, which line up with the audio slice's truck and refuel sounds.

Results are identical however a span of time is split into `tick()` calls, because the engine jumps from one event to the next.

## API
```ts
import { createLogisticsAdapter, defaultConfig } from './logistics'

const logistics = createLogisticsAdapter({
  addMoney: (amount, category) => { /* add to sim cash / finance ledger */ },
  playSound: (cue, standId) => { /* audio engine */ },
  notify: (msg, severity) => { /* news ticker / advisor */ },
}, defaultConfig())

logistics.onAircraftParked('stand-2', 'b738', 45) // when an aircraft blocks in
logistics.tick(dtMinutes)                         // every sim step
logistics.isReadyToDepart('stand-2')              // gate pushback on this
logistics.delayAt('stand-2'); logistics.snapshot()
```
To work with it directly, use `new LogisticsSim(config)`, `.on(listener)`, `.startTurnaround()` and `.tick()`.

## Integration steps (for the sim owner)
1. Build a `LogisticsConfig` from the airport layout: road nodes and edges from the service roads, one `StandConfig` per stand (set `hydrant` when the hydrant upgrade is built), the farm and kitchen nodes, and the vehicle counts bought by the player.
2. Create the adapter once per game with host callbacks into cash, audio and notifications.
3. In the sim step, call `logistics.tick(gameMinutesElapsed)`.
4. When a flight parks, call `onAircraftParked(standId, flight.airframeId, scheduledTurnMinutes)`.
5. Replace the fixed fuel dwell (`fuelDwellSeconds`) with `isReadyToDepart(standId)` as the pushback gate, and feed `delayAt` into delay penalties and ratings.
6. UI: show `snapshot()` in a logistics panel, and add build/buy actions for fuel trucks, the hydrant, kitchen capacity and tanker orders.
7. Rebuild the config, or add mutators later, when the player builds roads or stands. Today the config is fixed at construction.

## Tests
Run `npx vitest run src/logistics`. The tests cover needs for all 24 types, road paths, hydrant vs truck refuelling, multi-trip refuels, stock-outs and deliveries, the low-stock alert and auto-reorder, the ledger, the adapter hooks, and determinism across tick sizes.
