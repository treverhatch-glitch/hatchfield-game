# Hatchfield — Design

**Source of truth for what the game is.** User prompts beat agent guesses. Changelog: `ADDITIONS.md`. North-star narrative: [VISION.md](./VISION.md).

## Pitch

Browser airport tycoon: **Airport Tycoon 3** stamp-and-contract loop first, then HatchTag depth (RCT hall guests, ops risk, HATCH IPO). **Passengers are the default campaign; cargo is a full parallel path.** Emergencies and military hosting are side seasons. Money must equal picture — fees post when trucks, jets, or passengers finish a job.

## Pillars (protect these)

1. **AT3 first hour** — land → stamp → (hall *or* cargo chain) → letter → named metal earns money in ~2 minutes.
2. **Layout matters** — missing rooms, soft pavement, thin security, clogged taxi, broken cargo screen/rail, remote stands without buses must hurt visibly.
3. **Four loops + side seasons** — deepen: (a) stamp/contracts, (b) hall RCT, (c) ops risk, (d) capital/IPO. Emergencies + mil host are **letter-sized seasons**, not a fifth HUD game ([VISION](./VISION.md)).
4. **Sawyer cap** — hall pathfinding stays shallow (capped BFS). Perfect routing that stalls the sim is worse than guests who get lost.
5. **Browser = design lab** — Godot/Steam only after Waves A–B feel unfair-fun. Grid stays until **P2.5 freeflow**.
6. **Dual path equality** — pax and cargo both feed Field XP / Field Level ([PROGRESSION](./PROGRESSION.md)).

## Dual stage (+ cargo landside later)

| View | What you manage | Traffic |
| --- | --- | --- |
| **Apron** | Runways, taxi, stands, GSE, jetways/buses, cargo bays | Jets + trucks + walking/bus pax + congestion |
| **Hall** | Rooms, security choke, amenities, staff | Guests on a room graph (landside → security → airside) |
| **Cargo landside** *(target)* | Truck gate, screen, warehouse, rail spur | Parcel flow → freighter uplift |

Apron + Hall sim at once today. Cargo landside becomes the freight twin of hall belts.

## Traffic design (three layers + freight)

### 1. Plane-side (apron jets + GSE)

- Jets A* on runway/taxi/stand/hangar.
- Trucks A* on service tiles; fuel/bags/cater/deice/termbus have real missions.
- **Congestion** — nearby movers slow each other (`congestionAt`). Bad taxi necks jam turnarounds.
- Pushback → taxi out; multi-strip banks; hold queue when gates busy.
- **Emergencies / mil** steal stands and strip time — intentional schedule chaos ([IDEAS](./IDEAS.md#emergency-seasons-random-letters)).

### 2. Passenger-side (apron ↔ hall)

- **Jetway stands** (expensive) — fast board/deboard, no apron walk mesh, more hall dwell/spend.
- **Remote stands** — terminal **bus depot** ferry, else **walk** the pavement (slow, congests jets/trucks).
- Landside modes: drop-off, short/long park, hotel, bus curb, rail (persona-weighted).

### 3. Terminal-side (hall)

- Room graph with **security as only landside→airside choke**.
- Guests: needs, wallet, prefs, boarding clocks; tag = budget / family / business / premium.
- Short BFS (depth ~5–7); premium gets a slightly longer look. Missing rooms → lost / angry / heat.

### 4. Cargo landside (target)

- Truck gate / cargo rail → screen/sort → warehouse → loader GSE → freighter.
- Broken chain = late uplift (mirror baggage belt lite). Details: [IDEAS](./IDEAS.md#cargo-landside-infrastructure).

## Win condition (session fantasy)

Not “place a strip and a plane lands.” A good session: pick pax or cargo focus → first contract → survive payroll → choose jetway vs remote *or* screen vs rail → keep heat through a layover *or* night bank → optionally host a divert / Guard surge → IPO. Layout choices keep paying off after the first landing. Full fantasies: [VISION](./VISION.md#what-done-looks-like-session-fantasies).

## Non-goals (for now)

- Admin commute / staff-room bureaucracy (Airport CEO clone)
- Full freeflow roads mid-loop (parked **P2.5**)
- Photoreal passengers (capsules + cards are enough until loops are sacred)
- Multiplayer / share-price sabotage
- Military **combat** (host / train / logistics only)

## Related docs

| Doc | Role |
| --- | --- |
| [VISION.md](./VISION.md) | North-star: pax + cargo + emergency + mil |
| [IDEAS.md](./IDEAS.md) | Backlog and spice |
| [PROBLEMS.md](./PROBLEMS.md) | Gaps, bugs, honesty |
| [ECONOMY.md](./ECONOMY.md) | Cash loops and balance |
| [PROGRESSION.md](./PROGRESSION.md) | Tiers, Field XP, loans, cargo ladder |
| [NEXT.md](./NEXT.md) | Ordered build plan |
| `../ADDITIONS.md` | Research log / what shipped overnight |
| `../README.md` | How to run |
