# Economy and Tech Tree

`src/economy/` is a headless, deterministic economy model. It does not import or
mutate the game simulation. The terminal, logistics, render, and save systems
integrate through `createEconomyAdapter`.

## Rules implemented

- Research Points (RP) are separate from cash. Airport operations provide a
  small trickle; staffed, powered R&D rooms provide most recurring RP.
- Staff are pools by role. Transit supplies the initial cap; later staff housing
  adds capacity. Buildings receive pooled staff by priority and run in
  proportion to staffing, morale, and commute pressure.
- Render snapshots contain a bounded visible-worker sample. Researchers expose
  `working`, `walking`, `break`, and `off_shift` activity plus per-room
  `active`, `understaffed`, or `idle` state.
- Power is one capacity number. Power Plant I/II/III provide 250/650/1,400
  capacity. Excess demand causes a proportional throughput slowdown; it is not
  a binary shutoff.
- Demand comes from a map-owned calendar of season curves and holiday overlays.
  The default temperate map has summer peaks and winter de-icing/power pressure.
- Chain analysis reports the weakest link at 75% utilization or above. It never
  hides bottlenecks during a tutorial or early game.
- A fuel outage is the only hard ground-stop failure. Other failures emit delay
  and rating-hit hooks.

## Tech tree

The tree has 9 branches × 4 tiers (36 nodes). Tier costs are 1/2/4/8 RP and
Field Level gates are 1/3/5/8. A node requires the previous node in its branch,
but branches otherwise specialize independently.

The approved source lists Baggage as a Ground Logistics sub-branch while also
requesting nine branches. The implementation combines each baggage tier with
the matching Ground Logistics tier, retaining belt, sorter, early-storage, and
RFID effects without creating a tenth top-level branch.

Cross-branch prerequisites:

- Jet Bridges require LED & Solar (powered infrastructure).
- Freighter Stands require Fast-Track & Rescue II (wide-body fire cover).

Call `engine.getModifier('fuel.truckSpeed')`-style keys from subsystem adapters;
unknown keys return `1`. The current keys are defined alongside nodes in
`techTree.ts`.

## Terminal-agent adapter

The terminal owner should construct one adapter and keep its returned state in
the host save:

```ts
const economy = createEconomyAdapter({
  getFieldLevel: () => fieldLevel,
  isAirportOperational: () => flightsDone > 0 || signed.length > 0,
  getAbsoluteDay: () => day,
  getStaffPools: () => staffPools,
  getStaffBuildings: () => staffedBuildings,
  getResearchRooms: () => researchRooms,
  getPowerLoads: () => powerLoads,
  getChains: () => chainInputs,
  getTransitTier: () => transitTier,
  getHousingTier: () => housingTier,
  getPowerPlantTier: () => powerPlantTier,
  saveEconomyState: (state) => { savedEconomy = state },
  onEconomySnapshot: (snapshot) => { economyView = snapshot },
  addFlightDelay: (id, minutes, reason) => delayFlight(id, minutes, reason),
  setFuelGroundStop: (id, grounded) => setGroundStop(id, grounded),
  addRatingHit: (amount, reason) => lowerRating(amount, reason),
}, { initialState: savedEconomy })
```

At normal speed, call `tick(dtSimSeconds)`. The adapter uses the current
compression of 480 terminal sim-seconds per real minute. A frame loop with a
reliable wall clock should call `tick(dtSimSeconds, dtRealSeconds)` instead;
this is safer across pause and speed changes.

Use `reportFailure(...)` for subsystem failures. On `fuel_outage`, the adapter
calls `setFuelGroundStop(sourceId, true)` and does not invent a delay. Call
`clearFuelOutage(sourceId)` after fuel service resumes. Other failures call the
delay and rating hooks. The host remains responsible for selecting affected
flights and applying reputation.

`snapshot.staff.visibleWorkers` is the render sample.
`snapshot.staff.researchers` is the R&D animation contract. Snapshots and
`state` are plain serializable data; never save the engine instance.

## Balance assumptions

`runHeadlessBalance()` models:

- normal speed and continuous operations;
- 3 powered researcher desks for the first hour, then 4;
- first jet at minute 15, Field Level 3 at minute 45, and first long-haul at
  minute 70;
- an eight-hour late-game case at Field Level 8 with 16 researchers.

The two-hour case earns 12 whole RP plus a small fractional carry: enough for a
branch through T3 (7 RP) and several broad picks. The late case earns about 85%
of the full 135-RP tree, so specialization matters while most nodes can
eventually be bought. Fractional RP is retained internally but only whole RP is
spendable.

Cash costs, room construction time, wages, pauses, and staffing mistakes are
outside the RP pacing scenario. Wages are exposed in the staff snapshot for the
host's daily cost tick.

## Integration boundaries

- Existing saves need the host to default a missing economy state with
  `createInitialEconomyState()`.
- The module reports bottlenecks from capacities supplied by the host; it cannot
  infer existing terminal/logistics capacities until their adapters provide
  chain links.
- Seasonal definitions are data-ready for map variants, but only the default
  temperate calendar ships here.
- Building cash prices remain a host/catalog balance concern.

# Hatchfield — Economy

Money = picture. If cash moves and nothing on screen did, the loop is wrong.

**See also:** [VISION.md](./VISION.md) · [PROGRESSION.md](./PROGRESSION.md) · [IDEAS.md](./IDEAS.md).

## Cash sources (when they post)

| Source | When it posts | Notes |
| --- | --- | --- |
| Landing / handling | Turnaround services complete | Fuel, bags, catering, cleaning, MX · **pax + cargo** |
| Bag handling / drop | Unload→claim or makeup→load finishes | Airport fee for **work done** — not airline ticket bag fees |
| Hall spend | Guest buys food/shop/play/lounge/etc. | Wallet + PaxTag gate purchases (pax path) |
| Cargo uplift fees | Freighter load complete | Screen/rail/warehouse quality mods fee |
| Landside fees | Guest uses hotel / park / bus / rail | Usage only — idle stamps don’t earn |
| Cargo truck / rail intake | Parcels clear guard → facility | Landside usage; queues if guard thin |
| Pad / parking / emergency host | Helo, GA, divert/tanker accepted | Letter-driven; steals capacity |
| Military host fees | Guard mission / overnight | Side track — [VISION](./VISION.md) |
| Layover / Hub fees | Accept letter | Up-front + transfer dwell spend |
| IPO raise / share trades | List + buy/sell HATCH | Public crises tank the ticker |
| Field-task bonuses | Complete airline ask | Fail = fine |

## Cash sinks

| Sink | Cadence | Pressure |
| --- | --- | --- |
| Stamps (runway, stands, halls, ops, landside) | On place | Jetway stands ×1.85 |
| Contracts (fuel, catering brands) | Sign fee | Unlocks carriers |
| Payroll (ops budgets) | ~30s | Field-load multiplier from carriers / stands / turns |
| Landside + amenity upkeep | ~30s | Idle buildings bleed |
| Loan interest | Ticking | **Multi-product bank** — Micro → Sovereign; fee rises with principal; one loan at a time; see [PROGRESSION.md](./PROGRESSION.md) |
| Scramble / fines / bans / abandon | Events | Security + Standing failures |
| Research / hire (mechanics, janitors, researchers, desk) | Instant | Bodies must work for RP / scrub / MX |

## Difficulty leash

- **Easy** — roomy cash; learn the picture.
- **Standard** — after city land + starter kit, cash is tight (~loan almost required). Thrifty + loan forever is a trap; grow and repay is the healthy path.
- City levy / field-load payroll clip late snowballs.

## Layout ↔ money bridges (strategy)

These are the bridges that stop “strip + plane = win”:

1. **Jetway vs remote** — pay more up front → faster turns → more hall dwell → more retail. Remote + walk → congestion + less spend. Remote + bus → mid path.
2. **Security choke** — no security → threats / smuggling / Standing dips. Soft security → wear + incidents.
3. **Taxi geometry** — congestion slows GSE and jets → late boards → Standing dips → fewer slots.
4. **Landside match** — persona wants rail/hotel/bus; missing mode angers + skips fees.
5. **Wear / cleaning budget** — budget crowds scuff WC/security; scrub costs cash or reputation dies.
6. **Cargo chain** *(target)* — truck/rail → screen → makeup → loader; break any link → late uplift → **On-time** dip + fee cut ([IDEAS](./IDEAS.md#cargo-play-loop-equal-fun)).
7. **Emergency / mil capacity tax** — hosting pays fees but steals stands/strip/fuel; refusing saves capacity but costs fines/rep.
8. **Pax mix ↔ airport shape** — budget carriers → thin wallets, light bags, need fast cheap flow; premium → fat wallets, heavy bags, need claim/lounge capacity. Design the field for the mix you want.
9. **Bag fees realism** — airline keeps ticket bag/overweight revenue off-screen; airport earns handling + dwell spend; bad bags hurt **Standing** hard (airline relationship), not a fake overweight cash printer.

### PaxTag → economy (design targets)

| Tag | Bags | Wallet | Player builds toward |
| --- | --- | --- | --- |
| budget | Light | Low hall spend | Fast security, cheap curb, LCC stands |
| family | Medium+ | Food / play | Amenities + claim capacity |
| business | Medium | Time > money | Jetways, reliable bags, rail |
| premium | Heavy | Lounge / retail | Wide claim, belts, luxury landside |

---

## Bag & layover money (who gets paid)

**Real:** airlines collect checked-bag and overweight fees; airports collect handling, rents, PFC-like charges, and commercial spend.

**Hatchfield:**
- `bag handling` / `bag drop` → **your cash** (service picture).
- Extra/overweight pressure → more **bag units** and longer handling — clears well = Standing up; clogs claim/transfer = Standing down.
- Do **not** add a big “overweight fee” line that prints money with no airline. That fights realism and overpowers pax mix strategy.

## Capital loop (mid/late)

Loans → parcels → rail → IPO → street missions → public security crises. Being public adds pressure AT3 never had. Protect security or HATCH dies.

## Balance knobs (code touchpoints)

- `START_CASH`, land costs, `STARTER_KIT_COST`
- `STAND_JETWAY_MULT`, termbus cost
- Payroll / `fieldOpsMult`, `landsideUpkeep`, guest wallet rolls
- `LOAN_*`, IPO mins, heat thresholds, abandon/ban fines
- Hall guest cap (80), spend rates by PaxTag / jetway bonus needs

## Playtest questions

1. After first Northline (or UPPS) turnaround, is the next dollar decision interesting?
2. Does ignoring Hall still print money at 3x for 10 minutes on a pax focus? (Should hurt.)
3. Does a clogged taxi visibly delay a departure and cool Standing?
4. Does jetway investment pay back via hall spend within a few turns?
5. Does Standard force a loan without feeling unfair?
6. Can a cargo-focus start earn without a hall? (Should yes, once starter kit exists.)
7. Does hosting a divert feel rewarding *and* disruptive to the timetable?
