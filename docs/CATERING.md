# Catering & airside retail (`src/catering/`)

Self-contained module that does not import sim, logistics or render. It follows the owner decisions from Oct 13.

## Visible truck job (every step is a phase event for the renderer)
`loading_at_kitchen → driving_to_stand → parking → crew_exit → lift_raise → carts_out → carts_in → lift_lower → crew_board → driving_to_kitchen → unloading_at_kitchen`

- Each `catering_phase` event carries the truck id, flight, stand, the crew (driver and helper, each at `cab|ground|lift|galley`) and `liftHeight` (0..1). Durations come from `config.durations`, so there is no teleporting or magic fill. Big `dt` ticks still emit every phase with correct timestamps.
- Galley per flight: long haul gets hot meals plus 2 drinks per passenger; short haul gets a snack box plus 1 drink. Carts = ceil(pax/30). Used inbound carts come off before fresh ones go in.
- The kitchen produces `kitchenMealsPerMinute` up to `kitchenCapacity`. Shortages leave the galley `short` (`catering_late: no_meals`). Too few trucks gives `catering_late: no_truck`. Both are bottlenecks from player choices and are never suppressed.

## Airside shops
- Stock per SKU depletes on `purchase()`. When stock is empty, the shop emits `shop_out_of_stock` with the thought "wish they had burgers", a happiness change of −3 (mild), a lost sale, and `pax_walk_away`.
- Restock happens through a visible supply run: `loading_at_depot → driving_to_dock → security_screening → trolley_to_shop → shelving → returning`. Stock comes from a finite landside depot that gets a daily delivery.
- `reorderAt` is set by the player (0 = manual only, via `requestRestock`).

## Prefab hall counters
The food counter and the souvenir shop in the prefab hall read one shelf: this engine. Nothing else adds a serving. `openShelf` fills the counter when the hall opens. After that, a stores cart is the only refill.

The cart leaves `stores_dock`, follows the hall path in hops of at most 40 cm, docks on `counter_restock`, and unloads. The shelf rises at the end of `shelving`, after the crate has docked. One runner is on one counter at a time. A second runner is a purchase.

Sale prices stay in `DEFAULT_CATERING.prices`. Each finished unload posts `retail_cogs` for the units just shelved:

| SKU | Price | COGS | Margin |
| --- | --- | --- | --- |
| burger | $12 | $3 | 75% |
| coffee | $5 | $1 | 80% |
| sandwich | $8 | $2 | 75% |
| water | $3 | $1 | 67% |
| magazine | $7 | $2 | 71% |
| souvenir | $18 | $4 | 78% |

A full burger restock is 80 × $3 = $240 against 80 × $12 = $960. A stocked counter stays profitable. The prefab opens at 80 burgers (reorder 32) and 60 souvenirs (reorder 24) so one runner covers the starter hall for the first days.

## Fuel outages (`FuelOutageMonitor`)
Owner decision #9: if the fuel farm can't cover a departure, the flight is grounded. Fuel is reserved in departure order, and flights are released once enough fuel is available again.

## Wiring (terminal owner)
- When a flight parks, call `orderCatering({ flightId, standId, seats, bookedPax, longHaul, dueBy })`. Gate the logistics `catering` service on `isCateringDone(flightId)`. Once wired, this replaces the abstract catering truck in `src/logistics` (or that one drives this module's phases).
- Pax shop visits: `purchase(paxId, shopId, sku)`. On `ok:false`, apply `happinessDelta`, show the thought bubble and walk the pax away.
- Each sim tick: `tick(gameMinutes)`, then `drainEvents()` for the renderer and audio.
- Money: `revenue` and `lostRevenue` go into the single economy ledger.
- Fuel: each tick, `evaluate(now, logistics.fuelLitres, pendingDepartures)`. Grounded flights skip the `fuel` service.
