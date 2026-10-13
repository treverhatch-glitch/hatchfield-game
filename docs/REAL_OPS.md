# Hatchfield — Real airport ops → game verbs

Inspiration from how commercial airports actually run (IATA/ICAO turnaround, A-CDM landside–airside, landside/airside security, GSE, cargo).  
We steal **pipelines and choke points**, not paperwork. Cross-links: [VISION](./VISION.md) · [DESIGN](./DESIGN.md) · [ECONOMY](./ECONOMY.md).

## Principle

If a real airport needs a journey, a capacity, or a prep window for something to work, the game should too — simplified enough for AT3 first hour, deep enough that bad layout hurts.

| Real world | Hatchfield verb |
| --- | --- |
| Landside ≠ airside | Guard posts / security / sterile hall |
| Schedule drives prep | Planner bank + long/short prep windows |
| Turnaround is a chain | Fuel → bags → cater → board → push → taxi |
| Best planned, best served (A-CDM) | Stage assets early; late prep slips the bank |
| Capacity at every choke | Premade caps, belt links, farm stock, stand class |
| Money follows completed services | Fees post when the picture finishes the job |

---

## 1. Landside / airside split

**Real:** Public curb and cargo docks are landside. Beyond security / perimeter control is airside. Vehicles and people don’t freely cross.

**Game:**
- City roads → **guard post** → terminal curb / cargo intake / contractor gate.
- Hall **security** = only pax landside→airside choke.
- Apron GSE stays airside; city trucks don’t teleport onto stands.

---

## 2. Passenger pipeline

**Real (O&D):** curb/park/rail → check-in / bag drop → security → (passport if intl) → gate → jetway or bus → aircraft.

**Game:**
- Landside modes already (drop-off, park, bus, rail, hotel).
- Hall rooms + security + boarding clocks.
- **Jetway vs remote+bus vs walk** = real contact vs remote stand tradeoff.
- **Premade terminal ceilings** = real throughput limits (pax/hour, security lane soft queues, bag system limits) — upgrade or custom-build like expanding a terminal pier.

---

## 3. Baggage pipeline (arrival + departure + layover)

### Real

| Flow | What happens |
| --- | --- |
| **Outbound** | Check-in / bag drop → sort → makeup → load to aircraft |
| **Inbound terminating** | Unload → claim belt → passenger picks up → landside exit |
| **Connecting / layover (through-checked)** | Unload → **transfer** (sort or hot cart plane→plane) — passenger usually does **not** claim; bags “layover” on the airside system |
| **Self-transfer / some intl** | Passenger must claim + recheck (customs); rarer — use as intl-zone spice later |

**Who gets the bag fee money (real world):**  
Checked-bag fees and overweight fees are almost entirely **airline revenue**, not airport revenue. Airports earn from **handling / BHS use / terminal rents** and from pax spending once bags are done. Airlines punish airports that lose or delay bags (misconnects, refunds, brand damage).

### Game — lean (no per-suitcase sim)

Do **not** simulate 200 individual bags. Use **bag units per flight** rolled from the pax mix:

| PaxTag | Bag units (relative) | Wallet / hall spend | Fantasy |
| --- | --- | --- | --- |
| **budget** | Low | Thin wallet, skips lounge | LCC / Bushline |
| **family** | Medium–high | Medium, food/play | Mix |
| **business** | Medium | Strong, time-sensitive | Harbor / Summit |
| **premium** | High (+ overweight pressure) | Fat wallet, lounge | Crown / luxury |

**Arrival (terminating):** unload truck → claim → guests with `needs.bags` clear at claim → exit. Late claim = Happiness ↓ → Standing ↓. Airport earns **bag handling** fee when unload/claim chain completes (already live pattern).

**Departure:** bag drop / makeup → load (belt lite). Broken belt = late bags + Standing (live).

**Layover / transfer guests:**  
- Default: bags are **through-transfer** — go to transfer sorter / hot path, **not** claim. Passenger stays airside, spends if happy.  
- If transfer path capacity fails → **misconnect risk** → big Standing nick to that carrier (airline pain, not a fat airport bag-fee windfall).  
- Optional rare: intl/customs forces claim+recheck (intl zone later).

**Fees / Standing split (design law):**

| Money / meter | Who it feeds | Trigger |
| --- | --- | --- |
| Bag handling / drop pay | **Airport cash** | Picture finishes unload/load/drop |
| Overweight / extra-bag “pressure” | **Not** a big airport cash cow | Increases bag units + handling time; airline Standing rises if you clear them fast, falls if claim/makeup clogs |
| Hall spend after bags | **Airport cash** | Premiums linger; budgets leave |

So the luggage pipeline mostly feeds **Standing + hall dwell economics**, with modest handling fees — realistic, and it doesn’t invent fake airport bag-ticket revenue.

**Perf rule:** one bags truck mission + aggregate bag units + claim/transfer sink. No agent-per-bag pathfinding.

---

## 4. Cargo pipeline (make it a real game)

**Real:** truck/rail dock → acceptance → security screening → warehouse buildup → ramp / ULD → freighter. Freight is scheduled; uplift is late if landside is late. Night banks and express contracts are the drama.

**Game — equal citizen loop (target fun):**

1. **Demand letters** — UPPS/Umazon/EXFED ask for volume windows (“12 ULDs by 02:00”), not just “sign and freighter appears.”
2. **City trucks** — spawn off-map → guard → intake; visible queue if gate thin.
3. **Screen choke** — thorough vs fast (Standing/On-time vs incident risk).
4. **Warehouse meter** — fill before freighter; overfill = jam; empty at push = late uplift.
5. **Loader GSE** — picture verb at cargo stand; capacity by aircraft size.
6. **Pay** — intake fee + uplift fee when load completes; On-time Standing; Field XP = pax.
7. **Fantasy fork** — night freight fortress vs daytime pax hub; hybrid shares taxi jam.

Cargo should feel like **Manor Lords crates + AT3 contracts**, not a shed stamp. Details: [IDEAS](./IDEAS.md#cargo-play-loop-equal-fun).

---

## 5. Aircraft turnaround (the heartbeat)

**Real typical narrowbody order (simplified):** chocks → passengers off → bags off → fuel / cater / clean (parallel where safe) → bags on → passengers on → doors → pushback → taxi → takeoff.  
Widebody / freighter add loaders, more fuel volume, longer dwell.

**Game (target fidelity):**
- GSE with **real capacity** (bowser liters / ULD count), not infinite magic trucks.
- Fuel farm **stock**; refill via city tanker contract or bulk buy.
- De-ice already gated by weather + pad — keep that realism.
- Pushback / taxi / jam already model ground movement pressure.
- Optional later: TOBT-like “ready for push” when all posted services done (Planner already tracks phases).

---

## 6. Schedule & A-CDM lite

**Real:** Airlines publish schedules hours ahead; handlers stage crews and trucks; ATC sequences push (“best planned, best served”). Landside delays (pax/bags) revise off-block estimates.

**Game:**
- **Long horizon** — Planner bank hours (sim-minutes) ahead; spawn prep assets.
- **Short horizon** — scramble when weather / divert / jam hits.
- Slot knows **pax vs cargo** + size class → correct pipeline.
- Stolen emergency host = real “unplanned arrival steals a stand.”

We do **not** simulate full AODB paperwork. We do simulate: *if prep is late, the turn is late.*

---

## 7. Stands, gates, and contact vs remote

**Real:** Contact stands (jetbridge) are premium and scarce; remote stands need apron buses; stand planning matches aircraft size and airline preference.

**Game:**
- Stand S/M/L + jetway vs remote already.
- assignStand prefers linked halls / belt-linked bays — keep extending that “stand planning” feel.
- Mega-hub endgame = more piers, intl split, cargo far side (real campus zoning).

---

## 8. Safety & security services

**Real:** ARFF category for aircraft size; perimeter security; screening for pax and cargo; police/response.

**Game:**
- Fire station already gates contracts.
- Police / threats / security budget already bite.
- Guard post extends perimeter control to **vehicles**.
- Emergencies (divert, tanker) steal capacity — real ops chaos, letter-sized.

---

## 9. What we deliberately simplify

| Real complexity | Hatchfield choice |
| --- | --- |
| Full ATC radio / SIDs / STARs | Hold / approach / strip banks |
| Union staff rostering | Budget sliders + hire counts |
| Exact fuel grades / hydrant pits | Farm stock + bowser capacity |
| Customs brokerage paperwork | Screen building as choke |
| Construction BOM / ACEO materials | Ops logistics first; build delay lite later |
| Combat / weapons | Never (mil = host only) |

---

## Design checklist (when adding a system)

1. Does a real airport move this as a **journey with capacity**?  
2. Is there a **choke** the player can undersize?  
3. Does the **schedule** need to prep it before the plane?  
4. Can the player **see** failure without a wiki?  
5. Does cash post only when the **picture** finishes?

If yes to most — build it. If it’s spreadsheet-only — cut it.
