# Timetable dock

Cities: Skylines 2 style bottom dock for flight scheduling. Code lives in `src/ui/timetable/`; the only touch outside it is one mount line in `src/ui/hud/HudRoot.tsx`.

## Screen budget

- **Collapsed by default**: a 28 px pill at bottom-left showing the clock and the next arrival and departure. It never covers the apron.
- **Open**: sits above the category bar, `min(760px, 52vw)` wide, at most `34vh` tall, translucent. It scrolls inside itself.
- **Auto-folds** while a build menu is open (`ui.openMenu`), so building is never blocked.
- Numbers live in **click-open cards**: a flight card (times, window, stand, aircraft/ICAO, turn target, services) and an hour card on the runway lane.
- `?timetable=1` opens it on load (used for screenshots).

## Tabs

| Tab | What it shows |
| --- | --- |
| **Stands** | Gantt of stand occupancy, one row per stand, grouped by ICAO aerodrome code (F → C), with an "Unassigned · tower picks" group packed into lanes. Overlaps and too-small stands are outlined red. An orange line marks now. 6h / 12h / 24h zoom. |
| **Runway** | One lane per runway (RW1…RWn), each showing movements per in-game hour (arrivals blue, departures violet) against that runway's own dashed capacity line, with arrival and departure ticks. An **Auto** lane appears for movements not yet on a strip, and a **Total** row sums every runway against combined capacity. Over-capacity hours tint red per lane. Click an hour for its card. |
| **Flight board** | Arrivals and departures in clock time (`HH:MM` on the 180 s day face, the same as `formatSimDate`). A late flight shows its planned time struck through and the estimate in red. |

## Interactions

- **Drag** a bar sideways to move the flight. The hatched band shows its allowed window, and the drop is clamped into it.
- **Pin**: in the card, pick *Auto* or any stand that fits the aircraft's ICAO code.
- **Swap stand…**: click it, then click another flight to swap stand pins.
- **Pull / Bump / Cancel** are in the card.
- **Runway**: the card shows the assigned runway (and the departure runway when it differs) and has Auto / RW1…RWn buttons. With 2+ runways, gantt bars carry an RW tag.
- Inbound and on-ground flights are locked.

## Adapter

The dock only knows `TimetableAdapter` (`types.ts`):

```ts
interface TimetableAdapter {
  source: string; caps: TtCaps; dayLength: number
  now(): number; flights(): TtFlight[]; stands(): TtStand[]; runways(): TtRunway[]
  moveTo(id, time): number | null; pinStand(id, standId | null): void
  swapStands(a, b): void; pull(id): void; bump(id): void; cancel(id): void
}
```

### `gameScheduleAdapter(game)` (now)

This adapter wraps the existing `game.schedule` API, the same calls the Planner uses: `pullSlot`, `bumpSlot`, `cancelSlot`, `setSlotStandPref`, `gateLabel`, `standClassAt`, `runwayStripCount`, `maxInbound`.

- Each slot becomes an arrival (`slotId:arr`) at its `eta`, plus a predicted departure (`slotId:dep`) after taxi and a class turnaround (40 / 55 / 90 s for S / M / L).
- Aircraft already on a stand appear as departures from `game.flights`.
- The game has no slot windows yet, so the adapter derives a **tower window**: banked ETA −30 s to +45 s, floored at now + 6 s (the same floor `pullSlot` uses). It is anchored to the first ETA seen, so dragging never walks the window.
- `moveTo` turns into one `pullSlot` or `bumpSlot` by the delta. Because of that, the game's own bump cascade and airline heat still apply.
- Stand classes map to ICAO codes: S → C, M → E, L → F. Airframes map by kind; the A380 and 747 map to F.
- Multi-runway: runway membership comes from `game.scheduleForRunway(i)` for each strip `i < runwayStripCount()`, and ids are `rw0…rwN`. The game only exposes `cycleSlotRunway` (auto → RW1 → … → RWn → auto), so `setRunway` steps that cycle until the slot lands on the target. Each step posts a news line. The game uses one `runwayPref` for both arrival and departure.
- Hourly runway capacity is an estimate (`hourSecs / 2.5` per strip plus parallel approaches). Replace it with a real figure when the sim exposes one.

### `contractsAdapter(source)` (future `src/contracts`)

Its input is a structural `ContractsSource` (`movements()`, `reschedule()`, `assignStand()`, and optional `swapStands`, `pull`, `bump`, `cancel`). Runways are string ids (`RunwayDef.id`), with arrival `runwayId` and departure `depRunwayId` kept separate, and per-runway `movesPerHour` passed through `runways()`. `assignRunway` is optional; PR #19 has no runway-change call yet, so `caps.runway` stays false until one exists. Each movement carries a contract slot window (`windowStart`, `windowEnd`), `turnTarget`, `services` and `rotationId`, which pairs an arrival with its departure on one stand bar. The window band then reads "contract slot", and caps follow whatever the source implements.

To switch over, build the adapter in `GameTimetable.tsx` from `game.contracts` once branch `grok/contracts` lands. Nothing else changes.

## Tests

`src/ui/timetable/timetable.test.ts` (vitest, node) covers:

- clock face and duration labels, hour ticks, window clamping, ICAO fit, pixel → seconds
- slot → arrival/departure rows, ICAO grouping order, conflict flags
- moveTo clamping onto pull/bump, pin, swap, pull, bump, cancel, inbound lock
- runway buckets and the board's late estimates
- contracts pairing and clamping

`fakeGame.ts` is a minimal `ScheduleGame` stand-in.
