# Hatchfield — Design

**Source of truth for what the game is.** User prompts beat agent guesses. Changelog noise lives in `ADDITIONS.md`.

## Pitch

Browser airport tycoon: **Airport Tycoon 3** stamp-and-contract loop first, then HatchTag depth (RCT hall guests, ops risk, HATCH IPO). Money must equal picture — fees post when trucks, jets, or passengers finish a job.

## Pillars (protect these)

1. **AT3 first hour** — land → stamp → fuel/fire/road/hall → airline letter → named jet earns money in ~2 minutes.
2. **Layout matters** — missing rooms, soft pavement, thin security, clogged taxi, remote stands without buses must hurt visibly.
3. **Four loops, not five** — deepen: (a) stamp/contracts, (b) hall RCT, (c) ops risk, (d) capital/IPO. Don’t open a fifth parallel game until layout skill feels real.
4. **Sawyer cap** — hall pathfinding stays shallow (capped BFS). Perfect routing that stalls the sim is worse than guests who get lost.
5. **Browser = design lab** — Godot/Steam only after Waves A–B feel unfair-fun. Grid stays until **P2.5 freeflow**.

## Dual stage

| View | What you manage | Traffic |
| --- | --- | --- |
| **Apron** | Runways, taxi, stands, GSE, jetways/buses | Jets + trucks + walking/bus pax + congestion |
| **Hall** | Rooms, security choke, amenities, staff | Guests on a room graph (landside → security → airside) |

Both sim at once. Esc / H / buttons switch.

## Traffic design (three layers)

### 1. Plane-side (apron jets + GSE)

- Jets A* on runway/taxi/stand/hangar.
- Trucks A* on service tiles; fuel/bags/cater/deice/termbus have real missions.
- **Congestion** — nearby movers slow each other (`congestionAt`). Bad taxi necks jam turnarounds.
- Pushback → taxi out; multi-strip banks; hold queue when gates busy.

### 2. Passenger-side (apron ↔ hall)

- **Jetway stands** (expensive) — fast board/deboard, no apron walk mesh, more hall dwell/spend.
- **Remote stands** — terminal **bus depot** ferry, else **walk** the pavement (slow, congests jets/trucks).
- Landside modes: drop-off, short/long park, hotel, bus curb, rail (persona-weighted).

### 3. Terminal-side (hall)

- Room graph with **security as only landside→airside choke**.
- Guests: needs, wallet, prefs, boarding clocks; tag = budget / family / business / premium.
- Short BFS (depth ~5–7); premium gets slightly longer look. Missing rooms → lost / angry / heat.

## Win condition (session fantasy)

Not “place a strip and a plane lands.” A good session: sign Northline → survive payroll → choose jetway vs remote → keep heat up through a layover → optionally IPO and scramble a threat. Layout choices keep paying off after the first landing.

## Non-goals (for now)

- Admin commute / staff-room bureaucracy (Airport CEO clone)
- Full freeflow roads mid-loop (parked **P2.5**)
- Photoreal passengers (capsules + cards are enough until loops are sacred)
- Multiplayer / share-price sabotage

## Related docs

| Doc | Role |
| --- | --- |
| [IDEAS.md](./IDEAS.md) | Backlog and spice |
| [PROBLEMS.md](./PROBLEMS.md) | Gaps, bugs, honesty |
| [ECONOMY.md](./ECONOMY.md) | Cash loops and balance |
| [PROGRESSION.md](./PROGRESSION.md) | Airline tiers T1–T5, Field XP, loans |
| [NEXT.md](./NEXT.md) | Ordered build plan |
| `../ADDITIONS.md` | Research log / what shipped overnight |
| `../README.md` | How to run |
