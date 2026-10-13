# Hatchfield — Progression & motivation

How players see airlines, climb tiers, and stay hungry past the first landing.

**See also:** [VISION.md](./VISION.md) (pax + cargo + emergency + mil) · [ECONOMY.md](./ECONOMY.md) · [IDEAS.md](./IDEAS.md) · [NEXT.md](./NEXT.md).

## Start choice (planned)

At New Game (after difficulty), pick a **focus**:

| Focus | Plot bias | Starter kit flavor | First letters |
| --- | --- | --- | --- |
| **Passengers** | City | Hall + jetway stands | Bushline / Northline |
| **Cargo** | Factory | Shed + cargo stand + truck gate stub | UPPS / night bank |
| **Hybrid** | Either | Lean pax + lean cargo | Whichever meets req first |

Focus biases offer weights; it does **not** lock the other path. Field XP from both. Live today: city vs factory plots only — explicit focus UI is next ([NEXT](./NEXT.md)).

## How players see & interact with airlines (live)

| Touchpoint | What it does |
| --- | --- |
| **Letter inbox (right)** | Live contract / layover / Hub / MX / parking offers. Sign / Decline with deadline. |
| **Airlines panel (bottom)** | **T1–T5 ladder** — every carrier under its size tier, biz model (Charter / LCC / Full-service / Cargo), fleet blurb, ready/missing infra, **Standing**, Hub, locks. |
| **Top bar `Lv N`** | Field Level from XP — gates which tiers can call and which loans / parcels unlock. |
| **Planner / Standing / Hub** | Timetable slots, Standing perks, Hub plaques after layovers. |
| **News ticker** | “Northline sent a letter”, bans, Field Level ups. |

There is no separate “airline management game” — the airport hosts them; they call when infra + Field Level match.

## Size tiers (5) + business-model axis

| Tier | Label | Starter carriers | Unlock |
| --- | --- | --- | --- |
| **T1** | Commuter / Local | Bushline Local, light procs | Field Lv1 |
| **T2** | Regional | Northline (LCC), UPPS cargo, procs | Field Lv1 |
| **T3** | National / Mid | Harbor Air, Umazon cargo | Field Lv2 |
| **T4** | Major / Flag | Summit Premier | Field Lv3 |
| **T5** | Mega-global | Crown Pacific, EXFED Express | Field Lv4 |

Biz models cross-cut size: **Charter · LCC · Full-service · Cargo**. Same tier, different hall/apron asks.

## Cargo ladder (parallel to pax)

Freight is a full progression spine, not a shed stamp. Infra vision in [IDEAS § Cargo](./IDEAS.md#cargo-landside-infrastructure).

| Tier | Role | Live carriers | Infra (target) |
| --- | --- | --- | --- |
| **C1** | Feeder / express van air | Light procs / small freighter | Shed + truck gate |
| **C2** | Regional freight | **UPPS** | + sort/screen |
| **C3** | National night bank | **Umazon** | + makeup warehouse |
| **C4** | Heavy domestic / near-intl | (future) | + cargo rail spur |
| **C5** | Mega express / Code F freight | **EXFED** | + Code F stand / loader GSE |

Cargo **On-time** (same Standing meter, freight words) = on-time uplift. Night bank research already biases freighter slots. Cargo turnarounds should grant Field XP equal to pax (tune in [ECONOMY](./ECONOMY.md)).

## Side tracks (not the main ladder)

| Track | Progression feel | Doc |
| --- | --- | --- |
| **Emergencies** | Random letters; fee + XP if hosted; schedule chaos if not | [VISION](./VISION.md#side-track--emergency-events-chaos--reward) |
| **Military host** | Guard agreement → mission letters → training facility unlocks | [VISION](./VISION.md#side-track--military-host-no-fighting) |
| **GA parking** | Independent fees / leave windows | Live |

Side tracks must not outshout T1→T5 / C1→C5. Cooldowns keep the phone readable ([PROBLEMS](./PROBLEMS.md)).

## Field XP (CS-style spine)

Earn XP from: **pax turnarounds**, **cargo uplifts**, signing contracts, clearing loans, buying parcels, successful emergency/mil host.

| Level | XP (approx) | Opens |
| --- | --- | --- |
| 1 | 0 | T1–T2, Micro + Bridge loans, parcel 1 |
| 2 | 90 | T3, Expansion loan, parcel 2 |
| 3 | 220 | T4, Hub loan, parcel 3 |
| 4 | 420 | T5, Sovereign bond, parcel 4 |
| 5 | 700 | Mastery — all tiers; peek exhausted |

**Motivation loop:** turn planes → XP → Field Level → new tier letters → harder infra → bigger fees → better loans / parcels → bigger metal.

## Gatekeeping without boredom

1. **Hard gates** — `req` tiles (strip class, stands, security, cargo shed). Visible as “missing …” in Airlines panel.
2. **Soft gates** — Field Level + reputation peek (one tier early if rep is high).
3. **Relationship gates** — Standing perks, Hub, abandon, layover bans.
4. **Capital gates** — loan products scale fee with size; can’t stack loans.
5. **Land gates** — parcels need Field Level (CS tile unlock feel) and pay ongoing upkeep pressure via landside expenses.

## Loan products (live)

| Product | Principal | Fee | Needs |
| --- | --- | --- | --- |
| Micro strip | $25k | $1.4k | Lv1 |
| Bridge | $45k | $2.8k | Lv1 |
| Expansion | $90k | $7.5k | Lv2 + rep |
| Hub facility | $180k | $18k | Lv3 + rep |
| Sovereign bond | $320k | $42k | Lv4 + rep |

Bigger wire = lower rate per tick but much higher fee and longer leash. One open loan at a time.

## Future (brainstorm — not all shipped)

- Per-airline **loyalty unlock objects** (brand lounge furniture, unique GSE paint) at heat milestones.
- **Scenario medals** that grant XP boosts or free parcels.
- Explicit **start focus** UI + cargo starter kit ([NEXT](./NEXT.md)).
- Cargo landside chain verbs (gate → screen → rail → loader).
- Emergency pack expansion + Planner “stolen slot” highlight.
- Mil training facility + mission letter chain.
- Tier-unique research nodes (Code F gates, bilateral “landing rights”).
- Visible XP bar in Airlines panel (partially: Lv + fraction text).

## Design rules

- Never hide the next tier — locked rows stay visible with “Needs Field Lv…”.
- First hour still sacred: Bushline/Northline must be reachable without a wiki.
- XP rewards picture verbs (takeoff, Sign letter), not idle time.
