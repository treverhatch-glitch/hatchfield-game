# Hatchfield: Design Pass (Oct 13, 2026)
> Note: the owner brain dump labelled t17u was **not visible** to this researcher; the latest message I could see was t15u. This pass is built from the handoff brief (t6u), the prompts in t7u to t9u, and the task list. Check it against t17u.
> Tags: [S] = sourced (URL given). [U] = unverified or common knowledge. [H] = Hatchfield original idea. Every number is a balance suggestion unless it is marked [S].

---
## 1. RollerCoaster Tycoon guest AI, mapped to passengers
### What Sawyer did [S]
- **Junction-limited search.** A guest heading to a ride searches at most **5 path junctions**, or **7 with a park map**. Guests heading for the exit search 7, rising to 8 once they are lost. Staff search 8. If the search fails, the guest gives up, wanders, and loses a little happiness.
  - https://www.gameplace.link/RCT/Infrastructure/pathfinding.html
  - OpenRCT2 constants (kMaxJunctionsGuest=5, WithMap=7, LeavingPark=7, LeavingParkLost=8, Staff=8): https://github.com/OpenRCT2/OpenRCT2/blob/develop/src/openrct2/peep/GuestPathfinding.cpp
- **Plain path tiles don't count.** Only junctions add to the search cost, so a long straight corridor is "free" (gameplace link).
- **The limit was a performance choice, and getting lost is "fair".** Sawyer: "It's easy to program a route-searching algorithm that works perfectly… but it's of no use if it stalls the game for seconds or minutes." He got lost in real theme parks, so "it was probably right that the guests… also struggled… if the park layout was poorly designed." https://www.pcgamesn.com/rollercoaster-tycoon/code-chris-sawyer
- **Maps and info kiosks really change pathing** (maps extend the search). Layout advice: avoid irregular loops and dense junctions (https://www.angelfire.com/retro/fossil/RCT2/PathingSystems.html).
- **Thoughts, needs and stats** (hunger, thirst, toilet, energy, happiness, nausea, cash) shown as thought bubbles are well-known RCT features [U: no URL fetched for the thought list].

### Hatchfield mapping [H]
| RCT concept | Hatchfield |
|---|---|
| Junction budget 5/7 | A passenger's route search costs **hall junctions** (corridor branches and room doors). Base budget 5; **+2 with FIDS or signage in sight**; +2 if the passenger holds a "map" (an app, for business travellers); staff 8. |
| Park map | **Signage and FIDS screens** add to the budget within a radius. The **Info desk** resets a lost passenger and gives +2 for the rest of their visit. |
| Lost → wander | The passenger shows a "lost" thought; after 60 s they lose Happiness; after 180 s they miss boarding and the airline's Standing takes a hit. |
| Exit search | Arrivals → curb uses 7, or 8 when lost. An unreachable exit raises an **alert pin** (never an endless silent loop; Airport CEO's top complaint). |
| Thoughts | Thought icons: "Can't find gate", "Queue too long", "Bags late", "Hungry", "Need toilet", "Great shops!" Group them in the Field Rating panel (the RCT-style "guest thoughts" list). |
| Perf tricks | Plan only when a goal changes; cache door-to-door routes per room graph; update needs at 1 Hz; render passengers as an InstancedMesh; simulate passengers far away (or in the other view) in batches. |

### Passenger types [H; real-world archetypes, U]
| Type | Sub-personas | Wallet | Bags | Strong needs | What they demand from the build |
|---|---|---|---|---|---|
| Budget | Student, backpacker, weekend tripper | $ | 0–1 cabin bag, rarely checked | price, short queues | Kiosks, bag drop, vending, plain seating; they hate long security |
| Family | Holiday family, grandparents | $$ (spends on kids) | 2–4 checked, stroller | toilets, food, play | Family toilet, kids play area, fast food, seating near the gate, accessible paths |
| Business | Commuter, road warrior | $$$ (expense account) | cabin only | speed, wifi, coffee | Fast-track security, e-gates, café, lounge access, short walks |
| Premium/First | Exec, celebrity | $$$$ | 2–3 heavy checked | calm, lounge, priority | Premium check-in, lounge, priority bags (first off the belt), duty-free |
| International | Tourist, migrant worker, VFR | $$ | 1–2 checked | passport, currency, duty-free | Passport, customs, ATM, duty-free, multilingual info |
| Transfer | Connecting tourist, hub business | varies | through-checked | minimum connection time, signage | Transfer security, short airside walks, FIDS; misconnects hurt Standing |
| Special | Reduced mobility, unaccompanied minor, VIP, pilgrim group | varies | varies | assistance | Assistance desk, buggies, group holding area (later) |

Each type has a **mix weight per airline tier** (see §5). The mix shapes the build: a budget-heavy field needs throughput, a premium field needs comfort.

---
## 2. Airport CEO construction and contractors: did players like it?
- **How it works [S]:** you sign a construction company contract (signing fee, call-in fee, hourly wage). Contractors need an **off-load site** and a **delivery site** with road access. https://airportceo.wiki.gg/wiki/Contracts
- **Reception [S]: mostly frustration.**
  - Reddit, "This game becomes great once you turn off construction/materials simulation": "the construction workers are nothing but added wait times… watching dozens of guys walk all the way across the map and back just to get a taxiway up is no fun at all." A reply: "I cannot play AirportCEO without them off." https://www.reddit.com/r/airportceo/comments/c90akt/this_game_becomes_great_once_you_turn_off/
  - Some players like it for **interior** work. "For internal construction, desks, bathrooms etc. The little men are great, but try laying a double taxiway to a long runway at the wrong side of the map…" https://www.reddit.com/r/airportceo/comments/gknrxm/alpha_35_brings_in_so_many_bugs_its_mildly/
  - Bugs: materials stop arriving because the delivery truck is stuck at the entrance (https://forum.apoglabs.com/t/construction-materials-dried-up/17541). The planning tool charged money and then stalled (https://steamcommunity.com/app/673610/discussions/0/2965019884823155486/).

### Recommendation [H]
1. **Planning tab (blueprint mode)** is free. You see a ghost of the build and its total cost, and commit it as a batch. Keep it.
2. **Build time grows with size**, but **small and interior builds are near-instant** (≤10 s). Big airside pavement takes 1 to 3 game-hours, **not** a man walking across the map.
3. **Contractor vans drive in from the city road → guard post → site** as flavour and a visible link in the chain. The **timer runs from commit, not from arrival** (so a stuck van doesn't block the build; it shows a warning and the build gets a small delay).
4. **Optional materials supply** (concrete and steel deliveries) is a **Hardcore toggle, OFF by default**. Never on in the first hour.
5. **Rush button:** pay 50% extra to halve the time.
6. **First hour:** the Starter kit and the first 30 minutes build **instantly**.

---
## 3. Living logistics spec
### Fuel [S figures; game values H]
- A320 usable fuel is about **23,859 L**. B777-200/300 is about 117,347 L; 777-300ER/200LR about 171,176 L (search-summary figures; [U] exact, verify with the manufacturer's airport planning docs).
- Refuelling trucks: **5,000–65,000 L** (TITAN AERO, https://titan-aero.com/en/products/commercial-line/hydrant-dispensers/hydrant-dispensers-150m3-h-2/). A standard 20,000 L truck pumps **1,000 L/min** underwing (https://pdf.aeroexpo.online/pdf/fluid-transfer-international-ltd/standard-20-000-litre-capacity-aircraft-refueller/168678-1611.html). A 40,000 L semi-trailer pumps 1,300 L/min (https://cdn.pktrucks.com/specsheets/div4842-jeta1-aviation-refueler-trailer-specification.pdf).
- **Hydrant dispensers** (no tank; they connect to underground pipes) pump up to about 2,500–4,000 L/min. https://www.airport-technology.com/contractors/gasoline/nutzfahrzeuge-rohr/

**Game values [H]:**

| Unit | Capacity | Rate (game) | Unlock |
|---|---|---|---|
| Small bowser | 20,000 L | 1,000 L/min | Start |
| Large bowser | 40,000 L | 1,300 L/min | FL3 |
| Hydrant dispenser + hydrant pits at stands | ∞ from the farm | 2,500 L/min | FL5 |

Typical uplift per turnaround:

| Aircraft class | Uplift |
|---|---|
| Regional | 4–8k L |
| Narrowbody | 8–18k L |
| Widebody | 40–120k L |

A widebody needs 2 to 3 bowser trips, or a hydrant. That is a natural reason to upgrade.
- **Fuel farm (depot):** tanks of 500k L each; stock is shown by the tank's fill level. Low stock → warning at 25%; empty → fuel holds → On-time / Standing hit.
- **Supply options:**
  - Spot truck (expensive per litre, arrives in 30 game-min).
  - Contract truck convoy (cheaper, scheduled daily).
  - Rail spur tank cars (cheap, bulk, needs a rail spur; FL4).
  - Pipeline (big up-front cost, cheapest, continuous; FL6).
  - **Bulk buy** when the price dips (a price index that fluctuates; a small speculation side-game).
- **Scheduling:**
  - Long horizon: a weekly forecast from the signed timetable → recommended orders ("auto-order to 60%").
  - Short horizon: the next 2 hours of departures → bowser job queue, ordered by departure time (A-CDM-lite).

### Road chain
City road → **guard post** (vehicle checkpoint; queue; staffing affects throughput, 20 s per truck) → landside service road → facilities (fuel farm, catering unit, cargo shed, bag hall) → airside gate → apron service roads → stand.

The guard post is the vehicle version of security. A blocked post shows an alert with its cause (lesson from Airport CEO's road cut-off).

### Bags
- **Outbound:** check-in → belt → hold-bag screening → make-up area (pile per flight) → dolly train → stand → loaded during the turnaround.
- **Inbound:** hold → dolly → bag hall breakdown → claim carousel (first bag at about 10 min, last ≤25 min as a target, [U] industry ballpark) → passenger.
- **Transfer:** hold → dolly → transfer sort → straight to the outbound make-up for the connecting flight (minimum connection time check). A miss creates a "rush bag" job or a lost bag.

### Perf-safe aggregate approach [H]
- **Bags are counters, not agents.** Each flight has a `BagBatch {flightId, count, state, location}`. Visible cubes = min(count, 24) per pile or dolly. That matches the brief's "no per-suitcase agents".
- **Vehicles are agents** (cap of about 150). **Passengers are agents** in the active view (cap about 1,500). The other view runs a statistical model (queue = M/M/c approximation per room).
- **Fuel is a scalar flow** on the depot and on each bowser.
- Fixed 10 Hz sim, render interpolation, an event queue for timed jobs.

---
## 4. Bag and fee economics (real world)
- **Airlines keep checked-bag fees.** They are airline ancillary revenue: more than $1B in Q1 2017, and more than $7B in bag plus change fees in 2016 (AAAE). https://www.aviationpros.com/education-training/trade-associations-events/press-release/12345304/baggage-fee-collections-exceed-1-billion-in-first-quarter-of-2017
- **Airports earn:**
  - Aeronautical fees: landing, parking, gate, and the **Passenger Facility Charge**. In the US the PFC is $1 to $4.50 per boarding; **airlines collect it and hold it in trust for the airport** (49 USC 40117, https://www.govregs.com/uscode/title49_subtitleVII_partA_subparti_chapter401_section40117; 14 CFR 158.49, https://www.law.cornell.edu/cfr/text/14/158.49).
  - Revenue from **any lease, rent, fee or charge** (14 CFR 158 definition, https://www.govinfo.gov/content/pkg/CFR-2025-title14-vol3/pdf/CFR-2025-title14-vol3-part158.pdf).
  - Ground handling, where the airport or its handler provides it, is paid by the airline [U: arrangements vary].
- **Hatchfield rule [H]:**
  - Cash comes from landing, gate, PFC-style passenger fees, handling fees (bags and GSE), concession rent plus a revenue share, parking and fuel margin.
  - **Bag performance goes into the airline relationship:** on-time last bag, zero lost bags → Standing up; late or lost bags → Standing down, with the claim-desk cost on you.
  - The overweight-bag fee stays with the airline (so no cash-printer exploit), but a premium-heavy airline **pays a higher handling fee** and expects more.

---
## 5. Airline system [H; all airlines fictional]
| Tier | Unlock | Aircraft | Pax mix | Competing airlines (pick) | Relationship perk at Standing 82+ |
|---|---|---|---|---|---|
| T1 Regional | Start | Turboprop / regional jet | budget 50 / business 30 / family 20 | Northline, Puddle Air, Coastal Hop | Free branded check-in desk |
| T2 Low-cost | FL2, 1 runway ≥2,000 m, 2 stands | Narrowbody | budget 70 / family 25 | SkyPenny, Zoomjet | "Quick turn" bonus fee; vending skin |
| T3 Full-service | FL4, jetway, lounge-ready hall | Narrowbody + small widebody | business 35 / family 30 / premium 10 | Meridian, Atlas Blue | **Exclusive airline lounge** item |
| T4 Long-haul | FL6, widebody stands, passport, 3,000 m runway | Widebody | intl 50 / premium 15 / transfer 20 | SkyGlass, Orient Crown | Premium check-in island, first-class spa |
| T5 Flag/Hub | FL8, transfer system, 2 runways | Jumbo / A380-class | transfer 40 / premium 20 | Royal Aurum, Global One | **Hub status**: base-carrier fees, mega-lounge, art installation unlock |

- **Competition:** within a tier, airlines bid for slots. Signing a rival lowers the other's Standing a little ("you're flirting with SkyPenny"). Exclusives (one carrier per terminal) pay more but limit you.
- **Cargo ladder:**
  1. Feeder (Cessna-type freight) at Start.
  2. Express integrator, night bank (FL2).
  3. Belly-cargo deals with T3 airlines (FL4).
  4. Freighter widebody (FL6).
  5. Global integrator hub (FL8).
- Cargo perks: a dedicated sort centre item, priority ramp, the pharma cert badge.

---
## 6. Cargo loop deepening [H, grounded U]
1. **Truck gate and guard post** check trucks; a queue builds at peaks.
2. **Cargo screening.** Screen at the shed, or use "known shipper" trucks that skip the queue but carry a random-incident risk.
3. **Warehouse racks**: visible ULD and pallet stacks with a capacity limit.
4. **ULD build-up mini-step**: a build-up station turns loose freight into ULDs (time + staff). Better weight and balance → load bonus.
5. **Cold chain (pharma / perishables)**: a cool room is needed. A countdown timer; breaking it spoils the load (a big fee cut). Earn the pharma cert by staying ≥95% on time for 7 days.
6. **Live animals**: an animal house with a calm meter; the delay penalty is doubled.
7. **Night bank**: an integrator flies a 01:00–04:00 wave. Night noise limits are a city letter (optional).
8. **E-commerce peaks**: a seasonal "Singles' Day / holiday" surge letter at 3x volume for 3 days; temp staff and overflow tents.
9. **Rail spur**: bulk freight and fuel by train on a timetable.
10. **Contracts**: volume contracts with a weekly minimum, penalties and a bonus for exceeding it.
11. **Dangerous goods** cage (FL5): high fee, needs a fire-station response time ≤3 min.

---
## 7. Emergencies and military side missions (no combat) [H]
- **Emergencies (letters with a timer):**
  - Bird strike: hold the runway and inspect.
  - Medical diversion: ambulance to the stand within 6 min.
  - Fuel leak: cordon the stand and get fire rescue there.
  - Hard landing: runway closed while the foam truck works.
  - Snow or ice: de-icing pads, ploughs.
  - Suspicious bag: evacuate the zone and send security K9.
  - Volcanic ash: mass diversion inbound, everyone parks.
  - VIP / state visit: secure the stand and clear the hall corridor.
  - Power outage: backup generators.
  - Strike day: half the staff are out.
- **Military host:**
  - Tanker refuelling stopover (fuel stock test).
  - Humanitarian airlift (a cargo surge with priority).
  - Air show weekend (crowd and spectator gallery money).
  - Search-and-rescue helicopter basing.
  - Training detachment (night circuits; noise letter).
  - Evacuation flights (a mass transfer of passengers, free but big Reputation).
- **Special buildings:**
  - **Pilot training facility** (sim hall + circuit traffic → Field XP and cadet pipeline → airlines' Standing).
  - **MRO hangar** (maintenance revenue, fixes breakdowns).
  - Fire training ground.
  - Weather station.
  - Air cargo village.
  - Aviation museum (late game, gives Reputation).
  - Hotel (AT3 had hotels via contract [S: https://gamefaqs.gamespot.com/pc/917833-airport-tycoon-3/faqs/62508]).

---
## 8. Progression
- **Field Level (FL1–10)**, Cities: Skylines-milestone style: reached by Field XP from pax and cargo throughput plus Field Rating. Each FL unlocks a batch: a parcel of land, an airline tier, items, a loan size (CS1 milestones unlock services and areas [U: well-known, no URL fetched]).
- **Research (R&D)** sits beside it as **choice, not a gate**. Research points come from an ops centre plus a share of fees. Branches: Passenger comfort, Ops efficiency, Cargo, Safety, Green. A node needs the minimum FL **and** points, so FL sets the pace and research sets your style.
- **Aircraft manufacturer partnership** [H] (fictional "Aerion" and "Boreal").
  - Late game (FL6+), sign a partnership: host the manufacturer's delivery centre and test flights, move their parts cargo (wings by special freighter, engines in ULDs), and hit delivery contracts → **unlock new airframes** for your airlines to bring (A380-class, supersonic, eVTOL).
  - **Verdict: yes, as an optional late-game fork, not the main unlock path.**
  - It fixes a classic tycoon progression problem: new planes simply "appear by year" (AT1 items unlocked by date, "supplied to you as technology and time moves on" [S: AT1 manual https://oldgamesdownload.com/wp-content/uploads/manuals/airport-tycoon_win_manual_en_6zv.pdf]). Here you earn them by doing cargo work, which also makes cargo matter to pax players.
  - Risk: gating core planes behind it would force cargo on pax players. So base airframes stay FL-gated; only **prestige airframes** come from the partnership.
- **Mega-airport late game, inspiration (real features):**
  - **Changi Jewel**: a 40 m indoor waterfall (Rain Vortex), a 5-storey terraced Forest Valley, more than 280 shops; it links T1–T3 (https://pda.designsingapore.org/award-recipients/2020/jewel-changi-airport/, https://www.jewelchangiairport.com/en/attractions/rain-vortex.html). → "Landmark" items: waterfall dome, garden atrium (big Reputation and dwell-time spend).
  - **Hamad**: a 10,000 m² indoor tropical garden under an 85 m column-free gridshell (https://theindependent.sg/following-jewel-changis-official-opening-qatar-airways-ceo-said-singapore-copied-design-of-doha-airport-expansion-plans).
  - **Beijing Daxing**: a starfish plan with piers radiating from a central atrium to cut walking distance [S, secondary source: https://rachnatravels.in/world-s-most-beautiful-airport-why-singapore-changi-ranks-1-with-top-rivals-compared]. → A **starfish terminal template**.
  - **Dubai**: huge hub, A380 piers [U].
  - Late game = **Landmark set pieces + Hub status + IPO**.

---
## 9. Spaceport: verdict
**Recommendation: EXPANSION (post-launch DLC or a free update), not the base-game finale.**
Reasons:
1. The brief already parks it as a non-goal, and scope is the biggest risk right now.
2. It needs new systems (launch pads, propellant, launch windows, range safety) that don't deepen the four core loops.
3. A finale should test mastery of the existing systems. Better base finale: **Hub status + Landmark mega-terminal + IPO**.
4. A spaceport works best as a fresh map with its own goals, which suits DLC selling and keeps the base game grounded.

Seed it softly: the manufacturer line can tease a "suborbital point-to-point" research node that is locked "Coming in expansion" (keep the tease to a single node, not a walled tree; Manor Lords got flak for locked trees).

---
## 10. Player terminology
| Code / jargon | Player term |
|---|---|
| heat | **Standing** (airlines), **On-time** (cargo carriers) |
| pax | Passengers |
| GSE | Ground crew vehicles |
| turnaround | Turnaround (tooltip: "time on the ground between landing and departure") |
| A-CDM / bank slots | **Flight schedule / rush hours** |
| MCT | **Connection time** |
| ULD | **Cargo container** (ULD in the tooltip) |
| make-up area | **Bag sorting** |
| bowser | **Fuel truck** |
| apron / stand | **Apron** / **Gate stand** |
| landside / airside | **Before security / after security** |
| throughput | **Flow** (passengers/hr) |
| BFS cap | (hidden) → "Passengers get lost in confusing halls" |
| Field XP | **Experience** |
| Field Level | **Airport Level** (or keep "Field Level", but be consistent) |
| congestion | **Traffic jam** |
| PFC | **Passenger fee** |

---
## 11. Gap analysis and roadmap
**Missing compared with:**
- **AT3** [S cheatbook/GameFAQs]: in-terminal shop contracts (retail space → tenant letters), hotels and gas stations by contract, car parks (short and long stay), bus and taxi ranks, fire/police/infirmary, a spectator gallery. Hatchfield has most ops elements, but **landside transport (car parks, taxis, train)** and **tenant contracts** look absent [U, check the code].
- **Airport CEO** [S wiki]:
  - Drawn queues
  - Desk-to-bag-bay links
  - Bag screening levels
  - Staff hiring and fatigue
  - Contractor phase (recommend lite)
  - Flight planning per stand
  - Multiple floors
- **Cities: Skylines:** milestones (have FL), districts and policies (→ **terminal policies**: "quiet terminal", "fast-track"), traffic overlays and **info views** (heat maps for queues, lost passengers, bag delays), mod and asset support.

**Challenge balance** (target 5–7 live concerns): throughput (security/check-in), the bag chain, fuel/catering supply, airline Standing, cash flow, seasonal events. Keep each one readable through an **info view**.

**Prioritised roadmap:**

| # | Item | Why |
|---|---|---|
| P0 | Stabilise (Prompt 1), automated sim tests, perf budget | Airport CEO and CS2 lessons |
| P1 | Terminal interior MVP (TERMINAL_ITEMS.md, 12 items) + passenger types + junction-budget pathing + signage | Hall loop (B) is core |
| P2 | Info views (queues, lost, bags) + thoughts panel | Readable hurt |
| P3 | Guard post + city trucks + fuel farm/bowsers + catering visuals (slice 2) | Living logistics, cargo equality |
| P4 | Cargo start path (warehouse, ULD build-up, night bank) | DoD #4 |
| P5 | Airline tiers T1–T3 with competition + perks | Motivation |
| P6 | Planning tab + build time + contractor vans (instant first hour) | Depth without tedium |
| P7 | Emergencies pack + landside (car park, taxi, train) | Variety |
| P8 | T4–T5, passport/international, transfer | Hub |
| P9 | Manufacturer fork, Landmarks, IPO | Late game |
| Later | Spaceport DLC, Godot port | — |

---
## 12. Vision ideas [H]
1. **Rush hour heat-map replay**: scrub the last hour and watch queues bloom on a timeline. A great teaching tool.
2. **Passenger diaries**: follow any passenger; get a "postcard review" when they leave ("Lovely waterfall, lost my bag").
3. **Airline CEO visits**: a VIP inspection walkthrough letter; they follow a scripted path; your hall is graded live.
4. **Weather fronts that move across the map** with a 2-hour forecast to pre-position de-icing and staff.
5. **Spotter Reputation**: plane spotters gather at fences when rare aircraft arrive, for social buzz and Reputation.
6. **Lost & Found shop**: unclaimed lost bags are auctioned monthly (comedy plus small cash).
7. **Night mode city lights**: the city skyline brightens as your field grows; a visual proxy for the city's success.
8. **Signature terminal styles**: brutalist / glass / tropical garden kits with different comfort and upkeep.
9. **Ground-crew "hero" upgrades**: named veteran crew who turn around faster (light RPG flavour).
10. **Charter letters**: sports team, concert tour, pilgrimage. Short contracts that stress one system.
11. **Noise contour overlay plus a city happiness letter**, for neighbour politics without city-building.
12. **"Perfect turn" streak combo**: chain on-time turnarounds for a growing bonus multiplier (arcade spice).
