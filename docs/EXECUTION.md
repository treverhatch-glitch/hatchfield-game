# Hatchfield — Execution plan (active)

Working plan for expanding the game. **Code order:** [BUILD.md](./BUILD.md). Derived from [VISION](./VISION.md) + [NEXT](./NEXT.md) + AT3 / CS equilibrium.

## Principle

Deepen layout skill with **one reusable verb**: *broken chain → late job → Standing/money hurt → fix → recover*.  
Pax belts teach it first; cargo landside copies it; emergencies steal capacity on the same apron.  
Ground every chain in [real airport ops](./REAL_OPS.md) (journeys, capacities, prep windows, chokes).

## Player vocabulary

See [DESIGN § Player vocabulary](./DESIGN.md#player-vocabulary-not-code-names). Airline meter = **Standing** (not “heat”). Cargo flavor = **On-time**. Traffic = **Jam**.

## Wave order (execute in sequence)

| Wave | Goal | First ship slice | Status |
| --- | --- | --- | --- |
| **E1** | Pax layout skill | **Baggage belt lite** — stamp belt, bags↔stand↔terminal link, break = delay + Standing | **SHIPPED** |
| **E2** | Readability | Congestion / stolen-slot feedback (news + Planner tint) | **SHIPPED** |
| **E2b** | Vocabulary | Player-facing Standing / On-time / Jam (logic unchanged) | **SHIPPED** |
| **E3** | Cargo + bags depth | [BUILD](./BUILD.md) slices 1–3 | **1 + 1b SHIPPED · slice 2 next** |
| **E4** | Demand & budget leash | Clear income/expense readout + payroll that bites idle stamps | After E3 |
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

## E3 — Cargo equality + bag depth (next)

Fits [living logistics](./VISION.md#living-logistics-picture-manor-lords-energy-on-an-airport) + [REAL_OPS](./REAL_OPS.md):

### Slice 1 — Bags lean + premade ceilings (**SHIPPING**)

- [x] PaxTag → `bagUnits` on flights; handling pay scales  
- [x] Premade claim / hall soft ceilings (`capGuests`, `claimRate`)  
- [x] Layover through-transfer (`needs.bags = 0`); claim fallback hurts Standing  
- [x] Soak `soak-bag-units.mts` + commit  

### Slice 2–3 — Cargo fun (next code)

1. New Game **focus**: Passenger / Cargo / Hybrid + cargo starter kit.  
2. City → **guard post** → intake → shed (trucks visible).  
3. **Volume letter** + warehouse meter + On-time dip if late.  
4. Schedule prep: freighter slots stage trucks early.  
5. C1–C5 ladder wording in Airlines panel.

## Session cadence

1. ~~E1 / E2 / E2b~~  
2. Ship E3 slice → soak → commit.  
3. E4 budget readability before more systems.  
4. E5 seasons + E6 scale only when chains feel unfair-fun.
