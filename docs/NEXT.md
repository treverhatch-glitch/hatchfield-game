# Hatchfield — Next steps / development

Ordered plan. Ship top-down. **Active build board:** [BUILD.md](./BUILD.md) · [EXECUTION.md](./EXECUTION.md).

**North star:** [VISION.md](./VISION.md) · Ops: [REAL_OPS.md](./REAL_OPS.md) · Progression: [PROGRESSION.md](./PROGRESSION.md).

## Now — implementing (not just vision)

- [x] Jetway / remote / bus · CS2 chrome · 5x · docs · T1–T5 · Field XP · loans  
- [x] Belt lite (E1) · Jam / stolen-slot (E2) · Standing vocabulary (E2b)  
- [x] Living logistics + real-ops + bags/cargo economy design locked  
- [x] **Slice 1 (BUILD):** bag units + premade ceilings + layover through-bags  
- [x] **Slice 1b:** full bag journey + claim scheduling  
- [x] **Slice 2:** guard post + city cargo trucks → shed + warehouse stock  
- [x] **Slice 3:** cargo start focus + volume letters + warehouse HUD  
- [ ] **Slice 4:** fuel bowser capacity / farm refill — **NEXT TO CODE**  
- [ ] Coach / Economy discoverability — Starter kit harder to miss  

## Wave map (summary)

| Wave | Goal |
| --- | --- |
| E1–E2b | Done — belts, readability, Standing |
| **E3** | Cargo equality + bag depth ([BUILD](./BUILD.md) slices 1–3) |
| E4 | Budget leash / expense clarity |
| E5 | Emergency + mil letter seasons |
| E6 | Mega-hub · intl · franchises · scenarios |
| Parked | Freeflow P2.5 · spaceport expansion · full ACEO construction BOM |

## Quality bar

1. Money posts with a picture.  
2. Sawyer cap on hall BFS.  
3. Smoke: `npx tsx scripts/playthrough-wake.mts`  
4. Docs: pillars → DESIGN; ops → REAL_OPS; sequencing → BUILD / NEXT / EXECUTION.  

## Definition of done (beyond first landing)

1. Boot → kit → Northline money (~2 min).  
2. Jetway vs remote feels different.  
3. Break belt / jam / thin claim → Standing or money hurts → fix → recover.  
4. Cargo start can earn without a pax hall.  
5. Still want the next Field Level unlock — not “I’m done.”  

## Post-playthrough systems (approved by Trever, Oct 17 2026)

Most items below wait until plane graphics and the current playthrough are done. **Exception (Trever Oct 17 ~16:40): the three “start now” tasks may begin immediately** as Jules/sys PRs. Specs live in the agent queue (`sys_16` / `sys_17` / `sys_18`).

### Start now — Seeded RNG (no fixed-tick yet)
- Add one seeded RNG with named substreams (`sim`, `passengers`, `events`, `weather`, `cosmetic`); replace unseeded `Math.random` in sim/gameplay (~116 in `sim.ts` alone).
- Every **new** game rolls a **fresh random seed** (playthroughs differ). Persist the seed on the save; honor optional `?seed=` for repros.
- **Do not** change frame/step timing or the `App.tsx` dt cap — the fixed-tick clock stays after the playthrough.
- **Multiplayer groundwork:** same seed + same command stream → lockstep-ready determinism later.
- Jules: `sys_16_brief.txt`.

### Start now — Time-slicing of heavy work
- Frame-budgeted job scheduler (a few ms/frame) for route rebuilds after layout edits, demand recalcs, and autosave serialization.
- Goal: no hitch when placing buildings so graphics can stay maxed. Results must match non-sliced versions in tests.
- Jules: `sys_17_brief.txt`.

### Start now — Pathfinder (heap + route cache + crowd feel)
- Binary-heap A* + route cache keyed on start/goal; **invalidate on any layout change** so new check-in / security is used immediately.
- Passengers still pick the **shortest live queue**; needs-driven detours (food, shops, getting lost) request a **fresh route**.
- **Path variation (Trever):** share exact paths **only** in queues and at interaction points (check-in desks, security scanners/x-ray, gates, anything they interact with). Everywhere else: per-agent lateral offset, spacing and speed variation so crowds look alive.
- Jules: `sys_18_brief.txt`.

### After playthrough — Fixed-tick clock (pairs with seeded RNG)
- Run the clock in equal, fixed ticks so 5× plays out exactly like 1× on any machine (replays and bug repros match).
- Slightly shifts timings → **after the playthrough only** (Trever OK given Oct 17, but still gated on playthrough end).

### Per-airline service rating + airport growth
- Rating per airline from how well you treat them; airlines grow or leave.
- Tied to airport growth: as the airport levels up, airlines send **newer and bigger aircraft** (and stock / standing rise with it).

### Breakdowns and inspections
- Wire up the existing uncalled `breakdownChance()` in `maintenance/wear.ts`.
- Breakdowns, inspections and mechanics become real gameplay.
- **After the next playthrough.**

### Staff patrol zones
- Draw zones for security, police and janitors (RCT handyman-style).
- Janitors get optional specific maintain zones; security/police patrol.

### Explainable airport rating ↔ airport levels
- One airport rating that shows what is dragging the score down.
- Feeds, and is fed by, the airport level / Field Level system.

### Happiness easing + value-for-money
- Passenger happiness eases toward a target instead of jumping.
- Prices carry a value-for-money feel.

### Commands → undo / replay (+ hardcore)
- Every player action recorded as a command (undo, replays, easier bug fix).
- Optional **hardcore mode** with no undo (Ctrl-Z off) for the shipped game.

### Destination demand (Cargodist-style)
- Smarter cargo / passenger demand by destination, run in a **Web Worker** so it doesn't stall the main thread.

### Smaller approved items
- News by category.
- IndexedDB saves (browser localStorage currently tops out around ~5 MB).
- Research funding sliders.
- Marketing campaigns.

### Buses (city + apron) — after playthrough / full launch
- **City buses** bring passengers from the city to the airport.
- At stands **without a jet bridge**: starter airport has passengers **walk** to/from the plane (real small-airport feel).
- Bought **apron buses**: passengers queue at the gate and wait for a bus for boarding and deboarding.
- Worth applying toward the full game / next playthroughs; not immediate.

### Before Steam
- Rename real aircraft model names shown to players (`src/game/airframes.ts` — Boeing / Airbus / Embraer / ATR etc.) to **fictional** models, then a quick lawyer review.
- Fab (Epic asset store): free/standard OK now; paid professional tier once revenue > $100k/year.
- AI-made textures need Steam disclosure.

### Data and reference (licenses)
- **OurAirports** (public domain): destinations, distances, runway headings/lengths. No terminals/check-in/security logic — not a ready-made airport insert. Can later seed real-airport starting maps with player-built terminals.
- **MIT / Apache** (borrow OK, keep license notice in credits — normal for Steam): openScope & BlueSky (ATC spacing, go-arounds, approaches), OpenTaxi (taxiway / hold-short), Airline Club (airline route/price/demand), OpenLoco (building/vehicle systems, code only).
- **GPL = ideas only** (OpenRCT2, OpenTTD, etc.): never copy code.
- Look-don't-copy ideas: FlightGear (ground handling, landing, lighting / touchdown smoke+bounce), OpenATDeluxe (fun airline events), Simutrans (network route choice). Write code fresh.

### CC0 asset adoption (trialled Oct 17)
- Bring in: animated **people**, oak/palm **trees**, **warehouse**.
- **Innerscene realistic airliner** as a base (Trever likes it): needs **livery UV mapping**, a **lighter LOD** (~5× heavier than ours today), and **door rules** (no doors on wings or engines; hatch/wing clip rules apply).
- Search for more free CC0 airframes for every type we host (A380 etc.) once the current plane run finishes (avoid memory pressure on the box).
- Trial only behind a test flag today — live game unchanged until adoption PRs.

### Gate
- **May code now:** Seeded RNG (`sys_16`), time-slicing (`sys_17`), pathfinder + crowd path variation (`sys_18`) — Jules briefs queued 16:40 Asia/Bangkok Oct 17.
- **Still docs-only until** plane graphics pass merged + current playthrough finished: fixed-tick clock, airline service ratings, breakdowns, patrol zones, airport rating↔levels, happiness easing, command/undo+hardcore, OD demand, buses, smaller items, Steam rename, CC0 adoption PRs.
- Then pull remaining items into [BUILD.md](./BUILD.md) / [EXECUTION.md](./EXECUTION.md) in priority order.
