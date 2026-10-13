# Hatchfield — Grok handoff brief

**Purpose:** One file for an external reviewer / Grok bot.  
**Use this to understand goals, what is already coded, what was briefed but not built yet, and how the game is meant to play.**  
**Date snapshot:** after slice **3** (cargo start focus + volume letters).  
**Code order of truth:** [BUILD.md](./BUILD.md) · North star: [VISION.md](./VISION.md)

---

## 1. Elevator pitch

Browser **3D airport tycoon** (Airport Tycoon 3 stamp-and-contract first hour + Airport CEO / HatchTag depth).

You run a living airfield where:

1. **Layout is skill** — bad taxi, thin security, broken bags/cargo chains hurt visibly.
2. **Letters are drama** — airlines, layovers, emergencies, mil host call with deadlines.
3. **Money equals picture** — cash posts when trucks, jets, or passengers finish a real job (not teleport ticks).

**Passengers** are the default campaign. **Cargo** is a full parallel path (not DLC). **Emergencies** and **military hosting** are side seasons — chaos and prestige, never a combat game.

Stack: Vite · React · TypeScript · Three.js · Tailwind. Run: `npm install && npm run dev` → usually `http://127.0.0.1:45217`.

---

## 2. Design pillars (protect these)

| # | Pillar |
| --- | --- |
| 1 | **AT3 first hour** — land → stamp (or starter kit) → letter → named metal earns money in ~2 minutes |
| 2 | **Layout matters** — missing rooms, soft pavement, clogged taxi, broken belts/cargo chains hurt |
| 3 | **Four loops + side seasons** — deepen stamp/contracts, hall RCT, ops risk, capital/IPO; emergencies/mil stay letter-sized |
| 4 | **Sawyer cap** — hall pathfinding stays shallow (capped BFS); lost guests OK |
| 5 | **Browser = design lab** — Godot/Steam later; freeflow roads parked |
| 6 | **Dual path equality** — pax and cargo both feed Field XP / Field Level |

### Player vocabulary (never show code names)

| Player term | Meaning |
| --- | --- |
| **Standing** | Airline happiness with your field (code may still say `heat`) |
| **On-time** | Same meter for cargo carriers |
| **Happiness** | Per-guest mood |
| **Field Rating** | Whole-field score |
| **Jam / congestion** | Movers slow each other on the apron |
| **Reputation** | Soft public / IPO score |

Standing thresholds: **82+** perk · **≤36** warn · **≤20** abandon.

### Non-goals (for now)

- Admin commute / ACEO staff bureaucracy as the main game  
- Full freeflow roads mid-loop  
- Photoreal passengers  
- Multiplayer / share sabotage  
- Military **combat**  
- Per-suitcase bag agents  
- Spaceport / full construction-materials BOM as default (parked expansion)

---

## 3. Overall gameplay loops

A healthy session keeps **~5–7 live concerns**, not 20:

| Concern | What “broken” feels like |
| --- | --- |
| Airside machine | Jam, holds, late push |
| Passenger chain | Angry guests, missed board |
| Bag / freight chain | Late bags / late uplift → Standing / On-time dips |
| Carrier relations | Warn → abandon / ban |
| Budget | Cash cliff after kit / idle payroll |
| Ops risk *(seasonal)* | Divert / tanker / mil steals a gate |
| Growth *(soft)* | Next Field Level / parcel locked |

### Loop A — Stamp & contracts (AT3 spine) — LIVE

Buy land → stamp runway / taxi / stands / ops / hall **or** hit **Starter kit** → sign airline letter → plane approaches → lands → taxi → turnaround services → board → takeoff → fees post. Climb **T1→T5** carriers as Field Level rises.

### Loop B — Hall RCT (terminal) — LIVE

Enter hall (click terminal / `H`). Guests: needs (hunger, bladder, energy, bags, boarding, shop, play), wallets, PaxTags (budget / family / business / premium). Security is the only landside→airside choke. Short BFS; missing rooms → lost / angry → Standing dips. Amenities (food, shop, lounge, golf, waterfall, gaming…) drive spend.

### Loop C — Ops risk — LIVE (partial pack)

Budgets (maintenance, security, cleaning, fire, ambulances), mechanics, runway condition, weather, threat scramble, crashes softened by funded services. Emergencies steal capacity.

### Loop D — Capital / IPO — LIVE

Multi-product loans, parcels, city rail, IPO / **HATCH** ticker, analyst crises when public. Security breaches tank the stock.

### Loop E — Living logistics picture (Manor Lords energy) — PARTIAL

**Vision:** schedules drive prep; assets move through pipelines you can see (city → guard → facility → apron → plane).  
**Shipped so far:** bag journey + claim scheduling + belt lite; **guard post + city cargo trucks → shed + warehouse stock**.  
**Next:** cargo start focus + volume letters; fuel bowser capacity; cargo screen building.

---

## 4. Intended play flow (first session)

### Morning path (~2 minutes) — LIVE

1. **Easy grant** → **Riverside City** plot (or Standard empty plot).  
2. Follow **First hour** checklist **or** yellow **Starter kit**.  
3. **Sign** Northline (or first caller).  
4. Hit **3x / 5x** — watch jet land → gate → trucks → takeoff.  
5. Optional: **Hall** walk; stamp hangar / hardstand for Guard later.  
6. After first takeoff: **airline field asks** (police, hangar, hotel…) — bonus if on time.  
7. **Independent parking** asks — host for fee; release before leave window burns.

### Controls

| Input | Action |
| --- | --- |
| Left drag | Pan |
| Right drag | Orbit |
| Scroll | Zoom |
| `R` | Rotate piece |
| `H` / Esc | Hall ↔ Apron |
| Click terminal | Enter that hall |

### Session fantasies (win flavors) — TARGET

- **Pax player:** T1 hoppers → regional Hub → jetway campus → Summit widebodies → optional Crown + IPO.  
- **Cargo player:** shed + truck gate → screen → night UPPS → Umazon → EXFED; pax hall optional.  
- **Hybrid:** daytime Northline, overnight freighters, weekend Guard surge, divert at 3x.

---

## 5. Features ALREADY CODED (shipped)

Treat this as the current product surface. Details live in `src/game/sim.ts`, `catalog.ts`, `guests.ts`, `world.ts`, UI under `src/ui/`.

### Apron / field

- 3D apron stamp tools: runway (short / regional / heavy), taxi, stands (size + jetway/remote access), bags shed, fuel farm, catering, fire, tower, hangar, helipad, mil pads, landside (road, curb, park, hotel, rail stub), belt tiles, de-ice pad, etc.
- **Starter kit** one-click Northline-ready regional field.
- Named metal with size gates (ATR → A350 / 747-8F / mil types). Overfly if strip too short.
- Multi-strip banks, hold when gates busy, pushback → taxi out.
- **Congestion / Jam** — nearby movers slow each other; news + Planner readability (E2).
- Stolen-slot / emergency host tint on Planner (E2).
- Jetway vs remote vs terminal **bus** ferry vs apron **walk**.
- GSE trucks: bags, fuel, catering, de-ice, terminal bus — real missions, paths, dwells.
- Weather + runway condition; de-ice research path in storms/fog.
- Night bank research holds night pax until unlocked.
- GA independent parking offers with leave windows.
- Helipad ops (medevac / exec) when pad + fire present.

### Airlines & progression

- Carrier ladder **T1–T5** (Bushline → Northline → Harbor → Summit → Crown) + cargo names (UPPS, Umazon, EXFED).
- **Standing** meter, warn / abandon / ban, Hub plaques after layovers.
- Contract / layover / Hub / MX / parking **letters** with deadlines.
- **Field XP → Field Level** gates tiers, loans, parcels.
- Multi-product bank (Micro → Sovereign); interest if carried.
- Airline field tasks (bathroom, food, fire, desk, police, hangar…).
- Line-MX contracts when hangar + mechanics funded.

### Hall / passengers

- Premade terminal shells with **capGuests / claimRate** ceilings (starter hits limits).
- Room graph: entrance, check-in, security, claim, gate, amenities, exit, lab nodes…
- PaxTags → wallet + bag weight mix.
- Staffed desks (check-in etc.), wear on WC/security, scrub costs.
- Amenity dens: indoor golf, waterfall, gaming.
- Info desk extends lookahead (RCT park-map spirit).

### Bags (slices 1 + 1b) — LIVE

- Aggregate **bag units** per flight from PaxTag mix (no per-bag agents).
- **Belt lite (E1):** paint check-in ↔ makeup ↔ stand; break → late bags + Standing.
- Outbound: check-in **deposit dwell** → sort → load aircraft (timed by units).
- Inbound: bags arrive with plane → unload dwell → process → **assigned claim lane**.
- Claim lanes scheduled when inbound slots are **banked** (and on divert spawn); load-balanced across `bagclaim` rooms.
- Layover **through-transfer** skips claim; fail path → Standing hit.
- Arrivals only clear `needs.bags` when flight stage is **on claim**.
- Handling / drop pay = airport cash; airline ticket bag fees stay off-screen (realism).
- Visible crate load on bag carts (Manor Lords picture).

### Cargo landside (slice 2) — LIVE basic

- **Guard post** stamp (road edge); starter kit places one on the city approach.
- **City cargo trucks** spawn at map-edge roads → guard screen dwell → cargo shed deliver → depart.
- **Warehouse stock** fills from intake; HUD shows fill %; intake fee posts.
- Freighter shed→plane uplift **consumes** warehouse; thin stock → late uplift + On-time nick.
- Missing guard → denied entry or unscreened incident + security/On-time hurt.
- Queue pressure when multiple trucks hit one post.

### Emergencies / mil / side — PARTIAL LIVE

- Weather **divert** ask (fee / refuse fine; steals bank slot).
- Firefighter **tanker** refuel and **tanker + MX**.
- Air ambulance / helo asks.
- Security threat **Scramble / Ignore**.
- Military **Guard agreement** + host traffic (C-130, C-17, KC-135, F-15) — not full mission letter pack yet.

### Capital / meta — LIVE

- Loans, parcels, city rail investment.
- IPO / HATCH buy-sell, fair-value drift, analyst crises when public.
- Ops budget sliders + payroll ~30s (field-load multiplier).
- Hire mechanics / janitors / researchers / desk staff.
- Research tree (night bank, de-ice, stand L, exotic heavies…).
- Difficulty: Easy / Standard; city vs factory plot bias.
- Browser save (`localStorage`).
- Speeds including **5x** (inspect off for perf).

### Docs already in repo

`VISION` · `DESIGN` · `REAL_OPS` · `PROGRESSION` · `ECONOMY` · `IDEAS` · `PROBLEMS` · `NEXT` · `BUILD` · `EXECUTION` · `ADDITIONS` · `README`.

---

## 6. Features BRIEFED / designed but NOT fully in yet

These are intentional direction from the owner + design docs. **Do not treat as shipped.**

### Immediate build board ([BUILD.md](./BUILD.md))

| Slice | Status | Player should feel |
| --- | --- | --- |
| **2** Guard post + city cargo trucks → shed | **SHIPPED** | Cargo has a landside journey |
| **3** Cargo start focus + kit + volume letter + richer warehouse HUD | **SHIPPED** | Cargo is a real start fantasy |
| **4** Fuel bowser capacity + farm stock refill | **NEXT** | Manor Lords fuel picture |
| **5** Budget panel clarity + kit/loan coach | Parallel | Money readable |
| **6** Screen building + loader GSE + cargo ladder UI | After 3 | Cargo midgame |
| **7** Intl zone · franchises · scenarios · mega-hub look | Late | Scale fantasy |
| — Spaceport · full ACEO construction BOM | **Parked** | Expansion / never default |

### Living logistics (briefed hard)

- Explicit New Game focus: **Passenger / Cargo / Hybrid** (today only city vs factory bias).
- Guard post screens city trucks, contractors, fuel tankers; thin post = queues/incidents.
- City cargo trucks spawn off-map → road → guard → shed → freighter pipeline.
- Schedule prep windows (long + short horizon) stage assets before wheels-down.
- Contractor vans for non-instant builds (optional; never soft-lock first hour).
- Avoid ACEO “BOM construction trap” as the main game.

### Cargo path (briefed as equal citizen)

1. Inbound landside truck gate and/or cargo rail spur.  
2. Screening / processing choke.  
3. Warehouse / makeup staging meter.  
4. Loader GSE / ULD onto freighters at cargo stands.  
5. Carrier ladder C1→C5 (UPPS → Umazon → EXFED…) with **On-time**.  
6. Volume letters (“clear N ULDs before night bank”).  
7. Night bank freight identity.  
8. Shared jam with pax taxi if zoned badly.

Today cargo is mostly: shed stamp + freighter letters + night research — **not** the full landside journey yet.

### Bags / terminal (later depth)

- Custom terminal painter / walls rewrite hall graph (after belts + premade caps proven).
- International / passport zone.
- Franchise brands (CounterBite / SkyGlass…).
- Deeper guest traits, complaint cards, denser security queues.

### Side seasons (expand)

- Richer emergency pack (bird strike hold, fuel leak scrub, VIP scramble…).  
- Military **mission letters** + pilot training facility / mil ops desk (host only, no combat).  
- Scenarios with timed goals; more map sites.

### Meta / polish

- Clearer expense / budget HUD (CS-style leash).  
- Service roads separate from pax taxi.  
- Visible pushback tug.  
- Scenarios, franchises, mega-hall silhouette.  
- Freeflow P2.5 (parked).  
- Godot / Steam port after browser loops feel unfair-fun.

---

## 7. Bag & cargo economy rules (design law)

**Real world:** airlines keep ticket bag / overweight fees; airports earn handling, rents, commercial spend.

**Hatchfield:**

- Airport cash = bag **handling** / drop when the picture finishes.  
- Bad / late bags hurt **Standing** hard — not a fake overweight cash printer.  
- Pax mix shapes field design: budget = light bags / thin wallets; premium = heavy bags / fat wallets.  
- Cargo money posts on uplift / intake when the chain finishes; broken chain → On-time dip + fee cut.

---

## 8. Real ops grounding (why features look like this)

Steal journeys, capacities, prep windows, chokes — not bureaucracy. Full map: [REAL_OPS.md](./REAL_OPS.md).

Examples already mirrored:

- Landside / airside split via security.  
- Turnaround services as timed GSE jobs.  
- A-CDM-lite: bank slots → claim assignment / prep.  
- Bag arrival vs departure pipelines + through-checked transfers.  
- Congestion as shared apron resource.

---

## 9. Motivation engine (why keep playing)

1. Field XP → Field Level unlocks.  
2. Letters with deadlines.  
3. Layout punishment you can see.  
4. Prestige forks (Hub, Guard host, IPO) — optional mastery.  
5. Dual victory flavors (pax Hub campus vs night freight fortress vs hybrid).

---

## 10. How to review this project (for Grok)

Suggested reading order:

1. This file (`docs/GROK_HANDOFF.md`)  
2. [VISION.md](./VISION.md) — north star  
3. [DESIGN.md](./DESIGN.md) — pillars + vocabulary  
4. [BUILD.md](./BUILD.md) — what to code next  
5. [REAL_OPS.md](./REAL_OPS.md) — ops → game verbs  
6. [PROGRESSION.md](./PROGRESSION.md) / [ECONOMY.md](./ECONOMY.md)  
7. Code: `src/game/sim.ts` (brain), `guests.ts`, `catalog.ts`, `src/render/world.ts`, `src/ui/Hud.tsx`

When judging a feature idea, ask:

- Does it deepen stamp / hall / ops / capital — or open a fifth HUD game?  
- Does money post with a picture?  
- Does a broken chain create a fixable, readable hurt?  
- Does it keep the AT3 first hour intact?

**Definition of done beyond first landing:**

1. Boot → kit → Northline money (~2 min).  
2. Jetway vs remote feels different.  
3. Break belt / jam / thin claim → hurt → fix → recover.  
4. Cargo start can earn without a pax hall *(not done yet)*.  
5. Still want the next Field Level unlock.

---

## 11. Current status one-liner

**Shipped through E3 cargo equality basics (BUILD 1 + 1b + 2 + 3).**  
**Next code:** fuel bowser capacity / farm refill (BUILD slice 4).  
**North star unchanged:** living logistics airfield — layout skill, letter drama, money = picture; pax and cargo as peers; emergencies/mil as side seasons.
