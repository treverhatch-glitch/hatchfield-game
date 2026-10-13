# Hatchfield — Vision

What we’re building toward, from everything laid out so far. Cross-links: [DESIGN](./DESIGN.md) · [PROGRESSION](./PROGRESSION.md) · [ECONOMY](./ECONOMY.md) · [IDEAS](./IDEAS.md) · [PROBLEMS](./PROBLEMS.md) · [NEXT](./NEXT.md).

## The fantasy in one breath

You run a living airfield where **layout is skill**, **letters are drama**, and **money equals picture**. Planes, trucks, buses, walkers, and hall guests all jam each other if you design badly. Passengers are the default hero path; **cargo is a full parallel path**, not a side stamp. Emergencies and military hosting are **side seasons** — chaos and prestige without turning into a combat game.

## Three stacked games (same airport)

```
┌─────────────────────────────────────────────────────────┐
│  META — Field XP · parcels · loans · IPO / HATCH          │
├──────────────────┬──────────────────┬───────────────────┤
│  PAX PATH        │  CARGO PATH      │  SIDE TRACKS        │
│  Hall + jetways  │  Shed → screen →  │  Emergencies        │
│  T1–T5 carriers  │  rail → freighter│  Military host      │
│  Standing / Hub  │  On-time         │  GA parking         │
└──────────────────┴──────────────────┴───────────────────┘
                         ▲
              APRON TRAFFIC (shared congestion)
                         ▲
         CITY EDGE — roads + guard posts + inbound trucks
```

Players pick **pax-first, cargo-first, or hybrid** at the plot (city vs factory already hints this — deepen into an explicit start choice). Both paths feed Field XP and Field Level so neither is a dead end.

## Living logistics picture (Manor Lords energy on an airport)

> **IMPORTANT system law:** [HAND_OFFS.md](./HAND_OFFS.md) — passengers, bags, catering, fuel, cargo, buses: every transfer is a visible load/unload/service hand-off. No teleport clears.

The field is not teleport economy. **Schedules drive prep; assets move through pipelines; the player can read the picture.** Planes should feel **serviced** — elements actually pass through aircraft and airport.

```
CITY (off-map)
  │  roads / rail
  ▼
GUARD POST (screen trucks, contractors, service)
  ├── pax curb / terminal landside
  ├── cargo intake → screen → warehouse → freighter
  └── contractors → build sites (visible vans, not instant stamp forever)
  ▼
TERMINAL (premade with caps OR custom) ←→ APRON ←→ STRIP
```

### Terminals — premade vs craft

- **Premade halls** stay for AT3 first hour, but they are **starter shells with hard limits**: pax throughput, soft security queues, baggage allowance / belt capacity.
- Hitting the ceiling = delays, Standing / Happiness dips, letter pressure — push to **upgrade the premade** or **build your own** hall (layout skill).
- Custom terminals are the midgame craft fantasy; premades are never “best forever.”

### Guard posts + city edge

- City roads connect into **terminal landside** and (where appropriate) **service / cargo** approaches — not a free-for-all onto the tarmac.
- A **guard post** screens inbound vehicles: cargo trucks, contractors, fuel tankers, buses. Undersized / missing post = queues, denied entry, or security incidents.
- Contractors for non-instant builds **drive in from the city**, pass the post, then work the site — watch the picture, don’t just tick a progress bar.

### Schedule-driven pipelines (backend truth)

The sim knows the bank **ahead of time** (long horizon for prep + short horizon for scramble):

1. Slot is cargo or pax (and size class).
2. **Prep window** — spawn / stage the right assets early enough: cargo trucks from city → guard → warehouse; bags makeup; fuel bowsers with real tank levels; loaders.
3. Plane arrives → assets already in motion or staged; late prep = late turn = Standing / On-time hurt.
4. Nothing important should “appear at the stand” with no journey — fuel, freight, and contractors all have a path you can see.

This is the same verb as belts: **broken or thin chain → late job → hurt → fix.** City intake and guard posts are the landside half of that verb.

**Grounding:** pipelines and choke points mirror real airport ops (landside/airside, turnaround, A-CDM prep, cargo acceptance). Full map: [REAL_OPS.md](./REAL_OPS.md).

## Path A — Passengers (main campaign default)

See [PROGRESSION.md](./PROGRESSION.md).

- Stamp landside + hall + jetway/remote stands.
- Climb **airline tiers T1→T5** (Bushline → Northline → Harbor → Summit → Crown).
- Hall RCT needs, security choke, amenities spend.
- Jetway speed → more dwell → more retail (already live).

## Path B — Cargo (equal citizen, not DLC)

See [PROGRESSION.md § Cargo ladder](./PROGRESSION.md#cargo-ladder-parallel-to-pax) and [IDEAS § Cargo landside](./IDEAS.md#cargo-landside-infrastructure).

Real airports move freight. Hatchfield should too:

1. **Inbound landside** — heavy truck gate and/or **cargo rail spur** (not the same as pax city rail).
2. **Screening / processing** — X-ray / customs / sort buildings (cargo “security choke”).
3. **Makeup / warehouse** — parcels stage before uplift.
4. **Apron load** — ULD/loader GSE onto freighters at cargo stands (away from pax jetways).
5. **Carrier ladder** — UPPS → Umazon → EXFED (+ future regional freighters), night banks, heat as “on-time uplift.”

Cargo XP and pax XP both raise Field Level; factory plot biases cargo letters, city plot biases pax — player can still hybrid.

## Side track — Emergency events (chaos + reward)

See [IDEAS § Emergency seasons](./IDEAS.md#emergency-seasons-random-letters).

Random letters (already partially live: divert, tanker refuel, tanker+MX, helo medevac):

| Event | If handled | If ignored / failed |
| --- | --- | --- |
| Divert / malfunction | Fee + rep + XP; occupies stand / strip | Fine, heat nick, schedule slide |
| Firefighter tanker refuel (+ optional MX) | Fee; fuel/MX drain; may block bay | Fail fine; region notices |
| Air ambulance / patient lift | Pad fee; needs helo + medic budget | Refusal hurts reputation |
| Future: bird strike hold, fuel leak scrub, VIP scramble | Prestige or overtime pay | Cascades into Planner |

Rule: **emergencies steal capacity** (stand, strip, fuel, mechanic). Correct handling pays; wrong handling is scheduling chaos — never a skill minigame unless it’s fun.

## Side track — Military host (no fighting)

See [IDEAS § Military host](./IDEAS.md#military-host-side-missions).

Guard agreement is the seed. Expand into **side missions**, not a war sim:

- Host C-130 / C-17 / tanker / fighter drag on hangar-side hardstands.
- Letters: “clear pad 2 for ANG,” “overnight KC-135,” “weekend training surge.”
- Special buildings: **mil ramp**, **Guard hangar**, later **pilot training facility** / ops building (RP or mil XP, not dogfights).
- Rewards: cash, Field XP, unique unlocks (mil fuel truck paint, night waiver). Failures: fines + temporary mil cool-off.

**Non-goal:** player-controlled combat, weapons employment, PvP.

## Motivation engine (why you keep playing)

Copied from good CS / AT3 instincts, adapted:

1. **Field XP → Field Level** — unlocks carrier tiers, parcels, loans ([PROGRESSION](./PROGRESSION.md)).
2. **Letters with deadlines** — always something to answer (contract, emergency, mil, cargo night bank).
3. **Layout punishment you can see** — congestion, late bags/freight, security threats.
4. **Prestige forks** — Hub plaques, Guard host, IPO street — optional mastery, not required for fun.
5. **Dual victory flavors** — “pax Hub campus” vs “night freight fortress” vs hybrid mega-field.

## What “done” looks like (session fantasies)

- **Pax player:** T1 hoppers → regional Hub → jetway campus → Summit widebodies → optional Crown mega-hub + IPO.
- **Cargo player:** shed + truck gate → rail spur → night UPPS → Umazon → EXFED heavies; pax hall optional or minimal.
- **Hybrid:** daytime Northline, overnight freighters, weekend Guard surge, divert scramble at 3x.

## Pillar check

| Idea | Feeds which pillar? |
| --- | --- |
| Emergency letters | Ops risk + schedule drama |
| Military host missions | Stamp/contracts + ops (no 5th game if kept letter-sized) |
| Cargo landside chain | Layout skill (CEO spine) — parallel to pax belts |
| Start as cargo or pax | AT3 first hour, twice |
| Field XP for both paths | Capital / progression glue |

If military or cargo grows a full second HUD, stop and fold back into letters + one panel tab — see [PROBLEMS.md](./PROBLEMS.md) “fifth loop” smell.
