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

## 3. Baggage pipeline

**Real:** bag drop → sortation → makeup → loader / belt → hold. Broken sort or late makeup delays departure.

**Game:**
- Belt lite (hall ↔ sort ↔ stand) already teaches this.
- Later: claim loop art, multi-makeup, allowance caps on premades.

---

## 4. Cargo pipeline

**Real:** truck/rail dock → acceptance → security screening → warehouse buildup → ramp / ULD → freighter. Freight is scheduled; uplift is late if landside is late.

**Game:**
- City cargo trucks → guard → screen → warehouse → loader → freighter.
- **On-time** Standing flavor for cargo carriers.
- Schedule **prep window** stages trucks before freighter ETA (A-CDM landside idea, lite).

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
