# Hatchfield — Execution plan (active)

Working plan for expanding the game. Derived from [VISION](./VISION.md) + [NEXT](./NEXT.md) + AT3 / Cities: Skylines design equilibrium. Update checkboxes as we ship.

## Principle

Deepen layout skill with **one reusable verb**: *broken chain → late job → Standing/money hurt → fix → recover*.  
Pax belts teach it first; cargo landside copies it; emergencies steal capacity on the same apron.

## Player vocabulary

See [DESIGN § Player vocabulary](./DESIGN.md#player-vocabulary-not-code-names). Airline meter = **Standing** (not “heat”). Cargo flavor = **On-time**. Traffic = **Jam**.

## Wave order (execute in sequence)

| Wave | Goal | First ship slice | Status |
| --- | --- | --- | --- |
| **E1** | Pax layout skill | **Baggage belt lite** — stamp belt, bags↔stand↔terminal link, break = delay + Standing | **SHIPPED** |
| **E2** | Readability | Congestion / stolen-slot feedback (news + Planner tint) | **SHIPPED** |
| **E2b** | Vocabulary | Player-facing Standing / On-time / Jam (logic unchanged) | **SHIPPED** |
| **E3** | Cargo equality | Start focus + truck gate / screen (same broken-chain verb) | **NEXT** |
| **E4** | Demand & budget leash | Clear income/expense readout + payroll that bites idle stamps | After E3 slice |
| **E5** | Side seasons | Richer emergency pack + mil mission letters | Parallel once E3 live |
| **E6** | Scale fantasy | Franchises, intl zone, short scenarios | After layout verbs feel unfair-fun |

Parked: freeflow P2.5, Godot, custom wall painter, combat.

---

## Equilibrium — what AT3 and Cities teach

### Airport Tycoon 3 (core loop we steal)

1. **Empty plot → checklist build** (strip, apron, ops, terminal).
2. **Contracts as demand** — airlines / services call when rating + infra match; accept/reject/renegotiate.
3. **Indoor terminal as second game** — retail, security, amenities drive passenger satisfaction and cash.
4. **Money from finished services** — landing, handling, concessions — not abstract ticks.
5. **Scenarios** with timed goals (we still lack these).

AT3 weakness we avoid: opaque failure (“why no contracts?”). Hatchfield shows **missing infra** on the Airlines panel.

### Cities: Skylines (meta we steal)

1. **Unlock ladder** — Field XP / Field Level ≈ milestones / tiles.
2. **Demand is multi-axis** — we map RCI-like pressure to **pax demand / cargo demand / ops load**, not one blob.
3. **Services cost money** — fire, police, transit upkeep; idle coverage bleeds.
4. **Traffic is a teacher** — jam is visible feedback, not a spreadsheet.
5. **District fantasy later** — multi-terminal / intl zone ≈ districts; don’t ship before chains work.

CS weakness we avoid: infinite sandcastle with no airline drama. Letters + Standing keep social pressure.

### Hatchfield equilibrium (target player load)

A healthy session asks the player to keep **~5–7 live concerns**, not 20:

| Concern | Subsystems | “Broken” feels like |
| --- | --- | --- |
| 1. **Airside machine** | Runway, taxi, stands, GSE | Jam, holds, late push |
| 2. **Passenger chain** | Landside → hall → security → gate → jetway/bus | Angry guests, missed board |
| 3. **Bag / freight chain** | Belt or cargo gate→screen→makeup | Late bags / late uplift → Standing / On-time dips |
| 4. **Carrier relations** | Standing, letters, Hub | Warn → abandon / ban |
| 5. **Budget** | Payroll, upkeep, loan product | Cash cliff after kit |
| 6. **Ops risk** *(seasonal)* | Divert, tanker, mil host | Stolen gate on Planner |
| 7. **Growth** *(soft)* | Field Level, parcels, research | Next tier locked |

If we add more permanent HUD games (full mil sim, full franchise CRM), cut something else. Side tracks stay **letter-sized**.

---

## What’s missing now (honest)

| Gap | Why it hurts | Next wave |
| --- | --- | --- |
| Cargo not a real start path | AT3 had cargo as peer; we only have shed + freighter letter | **E3** |
| Budget opacity | Player can’t see *why* cash moves like CS expense panel | **E4** |
| Scenario vacuum | AT3’s “win this city in 5 years” focus; we only sandbox | **E6** |
| Hall = rooms not shape | Layout skill is checklist, not geometry | Later (after belts proven) |
| Franchise / intl shallow | AT3 indoor depth midgame | **E6** |
| Mil thin | Season without missions | **E5** |
| Starter / Loan discoverability | First-hour AT3 checklist easy to miss | Coach polish anytime |

**Regression test:** if a player stamps starter, ignores hall + belts, parks on 5x, and still prints money for 10 minutes — layout strategy failed.

---

## E1 — Belt lite ✓

- [x] Apron tile `belt`, connectivity, broken → boardingSlow + Standing dip + news  
- [x] Starter kit path, mesh, HUD, soak  

## E2 — Readability ✓

- [x] Congestion waste → Apron jam news + HUD line  
- [x] Emergency hosts on Planner as stolen capacity  

## E2b — Vocabulary ✓

- [x] Player strings: Standing / On-time / Jam  
- [x] Code keeps `heat*` internals  

## E3 — Cargo equality (next)

Fits the [living logistics picture](./VISION.md#living-logistics-picture-manor-lords-energy-on-an-airport):

1. New Game **focus**: Passenger / Cargo / Hybrid.  
2. City → **guard post** → cargo intake stub + shed + cargo stand (trucks drive in, don’t teleport).  
3. Broken gate/screen chain → late uplift + **On-time** dip (reuse belt BFS).  
4. Schedule prep window: freighter slots stage inbound trucks early.  
5. Premade hall **ceilings** (pax / security / bags) so starter shells are not endgame.  
6. Airlines panel cargo ladder wording (C1–C5 labels).

## Session cadence

1. ~~E1 / E2 / E2b~~  
2. Ship E3 slice → soak → commit.  
3. E4 budget readability before more systems.  
4. E5 seasons + E6 scale only when chains feel unfair-fun.
