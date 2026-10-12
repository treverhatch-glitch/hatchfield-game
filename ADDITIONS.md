# Additions HatchTag did not explicitly prompt

Things added while looping overnight (research + judgment). Your prompts still win if anything conflicts.

## From Airport CEO / AT research

- **Reputation** meter — rises with smooth turnarounds and happy hall guests; falls on missed gates / security breaches.
- **Cabin cleaning fee** on turnaround (CEO-style service round), separate from catering.
- **Control tower** — unlocks busier airlines and loosens ground holds (does **not** print money).
- **Maintenance hangar** stamp (reputation / growth hook).
- **Airline lounge** + **restrooms** as furnishable rooms.
- **Franchise-style retail** already framed as hall food/shop spend from guest needs (full franchise contracts later).
- Guest **boarding clocks** and **missed flight** penalties (CEO “catch your flight”).

## From RCT guest research (Chris Sawyer)

Verified: perfect pathfinding was too slow for thousands of peeps; he capped lookahead; guests decide at junctions; they can get lost; that was partly intentional. Sources: Sawyer interviews / RCT pathfinding writeups.

We copied the *spirit*:

- Hall is a **small room graph**, not a global oracle A* across the whole airport every frame.
- Short BFS (depth 5–7). Premium guests get a slightly longer look (like a park map).
- Strongest **need** picks the destination (hunger, bladder, energy, shop, bags, boarding).
- Missing rooms → guests get lost, anger, reputation hit — layout matters.

## Catering progression (you asked)

- Separate **SkyBite** / **GalleyPrime** contracts with sign fees and payout multipliers.
- Harbor / Summit require a catering contract + snack bar, not just a food room.

## Parallel views

- **Apron** (3D AT3 field) and **Hall** (2D terminal crowd) crossfade — same money, different game.
- **Enter/exit:** pan-click a terminal tile, Apron/Hall buttons, chip toggle, or **H** / **Esc**.
- **Build split:** outside stamps on the apron; inside rooms via Hall furnish. Hall map marks **landside ↔ secure line ↔ airside**.

## Added in the continued loop

- **Starter kit** — one-click Northline-ready regional field + Apex + SkyBite (connected pavement for walking).
- **Loans** with principal, fee, and ticking interest.
- **Parcel buys** (soft expansion counter + reputation).
- **City rail investment** — city stubs a west-edge link; reputation drip.
- **Airline minRep gates** — Summit / EXFED ignore low reputation.
- **Info desk** in the hall graph (RCT “park map” longer lookahead).
- **Visible multi-stop passenger itineraries** on the apron: arrivals plane→bags→food/shop→road exit; departures road→hall→gate→plane. Hall guests chain gate→claim→exit / entrance→check-in→security→gate.
- **IPO / HATCH ticker** — list the airport, buy/sell shares, fair-value drift, market missions, security breaches tank the stock when public.

## Added next loop

- **Heavy strip** tool (20×3) — Summit / EXFED require it; regional starter stays 14×2.
- **Helipad** stamp (visual + readiness flag; chopper ops later).
- **Facility wear** — budget hall traffic scuffs WC / security; scrub costs cash; high wear softens security level and feeds exposés.
- **Analyst crises** while public — fuel spikes, short rumors, downgrades, “needs heavy strip” notes, wear exposés, plus missions `heavy_ready` / `scrub_the_hall`.
- **Live helipad ops** — medevac / executive choppers hover in, pay pad fee, lift off (needs helipad + fire).
- **Ops budget sliders** (0–100%): maintenance, security, cleaning, fire, ambulances — payroll every ~30s.
- **Mechanics** — hire/lay off; they walk runway/hangar; repair pavement when maintenance is funded.
- **Airline line-MX contracts** — hangar + mechanic unlocks offers; payouts on turnaround if funded.
- **Runway condition + weather** — neglect + storms raise crash odds on landing/takeoff; ambulance/fire budgets soften outcomes.
- **Underfunding effects** — security threats, hall wear growth, apron fires, choppers refusing thin medic cover.

## Aircraft mix (live)

- **Passenger** — ATR 72 / CRJ-700 / E175 / A320neo / 737-800 / A321 / 787-9 / A350 (size + strip gates fees).
- **Cargo** — 757F / 767F / 747-8F for Umazon, UPPS, EXFED (distinct paint, no hall).
- **Emergency** — AW139 medevac + S-76 exec helos; Citation Latitude + Pilatus PC-12 air ambulance (ambulance budget).
- **Military / Guard host** — Boise-style agreement (hangar + tower + police + rep); C-130H, C-17A, KC-135R, F-15C fighter drag. HUD **Fleet today** tallies roles.

## Threat intercept

- Alerts pause as a **Scramble / Ignore** choice instead of an instant fine. Scramble costs cash; success scales with security level, police, and security budget.

## Runway lengths + real airframes

- **Short / regional / heavy** strips (10×2 / 14×2 / 20×3). Longest continuous strip gates named metal.
- Short: ATR / CRJ / E175 / Citation / PC-12 / F-15. A320+ and heavies **overfly**.
- Regional: adds A320 / 737 / A321 / 757F / C-130. Widebodies still refuse.
- Heavy: takes everything (787 / A350 / 747-8F / C-17 / KC-135).
- **Named metal + size** — real type names; 3D scale from fighter (×0.55) to 747-8F (×1.78). HUD shows strip tier + needs Nc.

## Amenity dens (live)

- Furnish **indoor golf**, **waterfall court**, **gaming den** — guests grow a `play` need and spend there.

## Strategy — fuller experience (idea gen, Oct 2026)

### What already carries the game

Four loops are real enough to build on:

1. **AT3 stamp loop** — land → prefabs → fuel/fire/road/hall → airline phone → money from turnarounds.
2. **Hall RCT loop** — needs, capped pathfinding, missed gates, wear, amenities (golf/falls/games).
3. **Ops risk loop** — budgets, mechanics, runway condition, weather, crashes, threat scramble.
4. **Capital loop** — loans, parcels, rail, IPO/HATCH, analyst missions.

Rule for new features: deepen one of these four. Don’t open a fifth parallel game until custom terminal layout feels like a skill.

### Pillars to protect

- **Money = picture** — every fee should show a truck, guest, jet, or ticker move.
- **Layout matters** — missing rooms / soft pavement / thin security must hurt visibly.
- **AT3 first, HatchTag spice second** — fantasy amenities and IPO are seasoning on a readable airport.
- **Sawyer cap** — never perfect pathfinding for thousands; keep hall graph shallow.

## AT3 deep dive — us vs them (Oct 2026)

Sources: AT3 FAQ/strategy (Dudeitsme411), MobyGames/wiki blurbs. AT3 = stamp land → contracts → rating. Hatchfield = that loop plus RCT hall + ops risk + HATCH.

### Where Hatchfield is already ahead of AT3

| Area | AT3 | Hatchfield |
| --- | --- | --- |
| Pax AI | Soft “satisfaction / rating” blob | RCT needs (hunger/WC/energy/shop/play), boarding clocks, miss penalties, capped hall pathfinding |
| Airlines | Master / flight / HUB contracts, rating gate | Personas (budget→luxury, cargo-night), heat, layover banks, short bans+fines, proc regionals |
| Money = picture | Fees often opaque | Landing/bags/fuel/catering/MX/pad fees post when trucks/pax move |
| Ops risk | Weather + collisions mentioned | Budgets, mechanics, runway condition, crash odds, threat scramble |
| Capital | Budget management | Loans, parcels, rail, **IPO / HATCH** missions (AT3 never had a public market) |
| Dual view | One isometric world | Apron 3D + Hall 2D with landside/airside cut |
| Metal | Size vs runway meters | Named real types + scale + strip gates (short/regional/heavy) |
| Schedule | Flight contracts auto-renew | Timetable with storm/boarding/backlog delays + cascade heat |

### Where AT3 still beats us (steal these)

| AT3 feature | Why it hurts that we lack it | Hatchfield upgrade |
| --- | --- | --- |
| **Terminal ladder** (1-story → mega with many jetways) | Our hall is one premade/shell; growth doesn’t *look* like a bigger airport | Multi-terminal campuses + jetway/stand counts per hall |
| **HUB contracts** as a distinct tier | We have layover banks; AT3 HUBs are the “you’re a real base” fantasy | Promote layover → **Hub status** (extra slots, exclusive lounge, harder ban) |
| **Master vs per-flight contracts** | We sign airline once; no per-rotation paper | Optional flight-contract renewals on the timetable (auto/manual) |
| **Jetways on multi-story terminals** | Stands are flat tiles; boarding is abstract | Gate jetway stamp linking stand↔hall node |
| **Hotels / gas / external services** | City is rail stub only | Landside hotel + parking that feed departures (noise vs money) |
| **Scenario mode** (city, years, goal) | We have sandbox + IPO missions only | 3–5 scenarios (“4 contracts”, “cargo Kiln”, “Guard neighbor”) |
| **City presets** (weather, demand mix) | City vs factory plots only | More sites: tourist / military town / megacity |
| **Airport rating as a first-class meter** | We split rep / heat / wear | Unified **Field Rating** derived from those (AT3-readable) |
| **Bigger build catalog** | Thin vs AT3’s service menus | Research unlocks expand the stamp list without dumping everything day one |
| **True multi-runway ATC** | Longest strip wins; one ops bank | Second strip with independent capacity when tower is staffed |

### Verdict

- **AT3 core loop:** we match or beat it (stamp → contract → turnaround money).
- **AT3 scale fantasy:** they win (big terminals, jetways, hotels, scenarios).
- **Modern depth:** we win (RCT guests, heat/layovers, budgets/crashes, HATCH, schedule drama).

Goal: keep our depth, steal AT3’s *growth silhouette* (second terminal, hub tier, scenarios) without copying its opaque rating goo.

### Gap analysis (updated)

| Pillar | Have now | Missing for “complete” feel |
| --- | --- | --- |
| Build | Prefabs, 3 strip lengths, helipad, apron↔hall | Custom walls/doors; multi-terminal; jetways; 2nd runway ATC |
| Airlines | 6 premade + Guard + proc fillers; personas; heat; layovers; bans | Hub-tier contracts; brand lounges/rewards; abandon on dead heat |
| Aircraft | Named frames + roles + strip gates | A380 / An-124 / C-5; pushback; noise/weight classes |
| Pax | Budget/premium + needs + clocks + transfers | Deeper traits (family/business); complaint cards |
| Cargo | 3 freighters + shed | Night banks, customs delay |
| City | Rail, parcels, two plots | Hotels, curfew, more site presets |
| Staff | Budget sliders + mechanics | Research-gated units; shifts |
| Meta | IPO + street missions | Scenarios, AGM, Godot ship |

### Upgrade plan (dependency order — beat AT3)

**P0 — AT3 growth silhouette (next)**

1. **Field Rating** meter — ~~blend of reputation, avg airline heat, wear inverse, security~~ **shipped**.
2. **Hub contract tier** — after N successful layovers / heat 75+, offer Hub: +slots, brand lounge room, harsher ban if you fail.
3. **Airline rewards / abandon** — ~~high heat unlocks persona perk; heat floor → warning → abandon + fine~~ **shipped**.
4. **Second terminal + jetway lite** — second hall fit assigns its own stands; jetway flag on stand↔gate.

**P1 — AT3 catalog + ATC**

5. **Research tree** — ~~points from flights/pax; unlocks night/de-ice/stand class/heavy~~ **shipped** (hotel / 2nd runway ops still open).
6. **Multi-runway capacity** — two strips add inbound slots when tower funded.
7. **Emergency asks** — weather-tied divert / firefighter tanker; refuse = rep + heat hit on many carriers.
8. **Heavy pack** — ~~A380, An-124, C-5 behind research~~ **shipped** (needs heavy strip + R&D).

**P2 — AT3 meta AT3 never stuck the landing on**

9. **Scenarios** — timed goals on preset sites.
10. **Hotels / landside city** — money vs curfew noise.
11. **Custom terminal painter** — walls rewrite hall graph (skill ceiling).
12. **Godot Steam** — only after P0–P1 feel unfair-fun.

### Recommended ship order (legacy tiers, still valid)

**Tier A — make the airport feel built by you**

1. **Custom terminal painter** — stamp walls/floors, place doors that rewrite the hall graph.
2. **Landside / airside clarity** — ~~secure line as a real cut~~ (map labels live); enforce amenity side later.
3. **Gate & stand assignment** — ~~lite live~~; deepen with jetways + multi-hall.

**Tier B — airline drama** — mostly **shipped** (personas, proc, layovers, bans, heat). Next: Hub tier + rewards/abandon.

**Tier C — day/night & seasons (CEO depth)**

7. **Slot / curfew clock**
8. **De-ice / winter ops**
9. **Franchise retail**

**Tier D — meta & Steam**

10. **Scenarios**
11. **AGM / shareholder votes**
12. **Godot Steam rebuild**

## Airport CEO deep dive — us vs them (Oct 2026)

Sources: Airport CEO wiki (Flights, Flight Planner, Contracts), Steam R&D guide (Alpha 35+). CEO = 2D construction + staffed secure zones + drag-drop planner + research unlocks. Hatchfield = AT3 stamp loop + RCT hall + ops risk + HATCH.

### Where Hatchfield is already ahead of Airport CEO

| Area | Airport CEO | Hatchfield |
| --- | --- | --- |
| Guest AI | Passengers mostly flow to desks; satisfaction is softer | RCT needs, miss clocks, capped pathfinding, angry exits → heat |
| Airline drama | Contracts + tasks; relations are quieter | Personas, heat, layover banks, bans+fines, proc regionals |
| Fantasy / spice | Franchise shops/cafés (research) | Golf / waterfall / gaming dens + layover captive spend |
| Capital fantasy | Economy panel, no public equity market | **IPO / HATCH** ticker, street missions, crisis dumps |
| Dual fantasy view | One continuous 2D campus | Apron 3D + Hall 2D with landside/secure/airside read |
| Military spice | Emergencies exist; not a Guard-host fantasy | Boise-style Guard host + named olive metal |
| Turnaround picture | Services exist but denser UI | Money posts when truck/pax picture completes (AT3 rule) |
| Session length | Long authentic build | Starter kit → Northline money in minutes (better sketch loop) |

### Where Airport CEO still beats us (steal these)

| CEO feature | Why it hurts that we lack it | Hatchfield upgrade |
| --- | --- | --- |
| **R&D / research tree** | We dump tools day one; no progression spine | Research points from flights/pax → unlock heavy metal, de-ice, night bank, hotel, 2nd runway |
| **Flight Planner (drag-drop, days ahead)** | Our timetable is ETA bank, not a week grid | Expand schedule into a simple planner (day strip + stand column); keep auto COO toggle |
| **Secure zone / international zone tools** | We label landside/airside; walls don’t enforce | Zone paint that gates hall graph edges (wrong-side shop ≠ boarding help) |
| **Staffed desks** (agents, screeners, ramp) | Budgets are sliders, not bodies | Named posts on check-in/security/boarding; understaff = queues |
| **Stand sizes** (small/med/large) + remote vs attached | One stand tile fits all that strip allows | Stand class + remote stand service truck |
| **Pushback / stairs / belt loaders** | Servicing is abstract timers + trucks | Visible pushback + belt before taxi-out |
| **Night flights unlock** | Weather exists; no curfew politics | Night bank research: freighter money vs city noise/heat |
| **De-icing permit + pad** | Storms raise crashes; no de-ice verb | Winter ops: de-ice truck or holds/cancels |
| **Baggage belt system** | Bags are a shed + truck | Conveyor path check-in→makeup→stand (skill layout) |
| **Franchise contracts** (shops/cafés) | Hall spend is organic only | Sign brand → guaranteed spend + brand crisis |
| **Airline lounges** (research) | Generic lounge room | Persona-branded lounge rewards at high heat |
| **GA traffic** | Helos/exec only | Small GA ramp (easy money, blocks stands if neglected) |
| **Multiple terminal ops** (late research) | One hall fit | 2nd terminal research + per-hall stand pools |
| **Contract task deadlines** | Sign & forget | Airline tasks (“add WC”, “security ×2”) with bonus/fail |
| **Emergencies panel** | Threat scramble only | Divert / firefighter tanker asks; refuse = broad heat hit |

### Verdict

- **CEO construction authenticity:** they win (zones, staff bodies, belts, pushback, R&D).
- **Readable fun in a short session:** we win (starter kit, money=picture, layover tension, HATCH).
- **Airline personality:** we win today; steal their **lounge + franchise + task contracts** to stay ahead.
- **Scheduling:** they win on planner UX; we win on delay cascading drama — merge both.

Goal: keep HatchTag/AT3 readability; steal CEO’s *progression spine* (research → night/de-ice/belts) and *planner craft* without becoming a spreadsheet.

### CEO-aligned upgrade plan (merge with AT3 P0–P2)

**C0 — CEO spine (overlaps AT3 P0)**

1. **Research desk** — ~~points from turnarounds + pax; unlocks night bank → de-ice → stand classes → heavy pack~~ **shipped**.
2. **Airline rewards/abandon** — ~~high heat → persona perk; warn → abandon + fine~~ **shipped** (`brand_lounge` / `budget_perk` / `biz_priority` / `cargo_night`).
3. **Planner v2** — day strip UI on current timetable (drag ETA / assign stand); auto remains default. *Next.*
4. **Field Rating** — ~~AT3-readable blend~~ **shipped** (rep × heat × wear × security).

**C1 — CEO authenticity**

5. **Secure-zone enforcement** on hall graph.
6. **Staff posts** on key desks (security/check-in/boarding).
7. **De-ice + night curfew**.
8. **Stand class + pushback beat**.
9. **Emergency asks** (weather divert, firefighter tanker).

**C2 — CEO scale**

10. **Baggage belt lite** + franchise brands.
11. **Multi-terminal** + GA ramp.
12. **Godot** after C0–C1 feel unfair-fun.

Dependency note: Research desk + airline rewards/abandon + Field Rating are live. Planner v2 builds on our timetable. Hotel / 2nd runway / emergency asks still open.

### Explicit calls on open design questions

- **Premade vs random airlines:** Hybrid. Premade for identity and tutorials; thin procedural regionals for variety. Full random-only dilutes AT3’s “I know who Summit is” fantasy.
- **Layover bans:** Yes — short ban + cash fine + news blurb. Teaches hall quality without deleting the save.
- **Military:** Keep as **host agreement** (not a full player-controlled air force). Occasional tasking missions later (“clear stand 2 for ANG”).
- **Browser vs Godot:** Browser stays the design lab. Godot is the shipping skin once loops are sacred.
- **AT3 vs CEO pull:** Steal AT3’s growth silhouette (hubs, jetways, scenarios) and CEO’s progression spine (R&D, zones, planner, de-ice/night). Do not clone CEO’s contractor/admin commute sim.

### Nice-to-haves (park, don’t chase)

- Flight school / GA ramp  
- Water aerodrome / second airport rival AI  
- Multiplayer share price sabotage (too spicy for v1)  
- Full bomb minigame (keep scramble/ignore unless it becomes a verb players love)

### Success tests for “fuller”

A new player can, without a wiki:

1. Boot → land → starter → sign Northline → watch a named jet earn money.  
2. Open Hall, see a guest fail without a WC, fix it, see happiness recover.  
3. Neglect maintenance in a storm, nearly crash, hire mechanics, recover.  
4. Sign a layover deal, get rich on shop spend, then almost get banned.  
5. IPO and survive one public crisis by scrambling security.

If 1–3 work, we’re an AT3 sketch. If 4–5 work, we’re Hatchfield.

## Balance pass (retest loop)

- Unique procedural airline names; cap **3 signed procs** so majors stay readable.
- Slowed helo / Guard / air-ambulance cools — schedule pax + cargo stay the spine.
- Timetable biases freighter slots when cargo is starving; boarding clocks slightly kinder; heat recovers a bit faster after cascades.
- Hall miss headlines rate-limited; per-guest heat/rep hits softened; schedule heat soft-floors at **15** outside layovers (bans still bite during layover banks).
- Full soak: ~50+ turnarounds, no stuck ETAs, no cash-floor hits, heat ≥15, mixed fleet healthy.

## Shipped — runway timetable (this loop)

- **Auto + manual schedule** — signed airlines bank ETA slots; player can add / bump / cancel.
- **Delays** — storms, runway backlog, slow boarding, short-strip refusals push the bank.
- **Cascade** — a delay slides later slots and cools airline heat.
- Cancel / rearrange costs heat so the timetable is a real lever.

## Shipped — Tier B airline drama + gate lite (this loop)

- **Airline personas** on majors: budget / business / luxury / cargo-night / military-gov.
- **Heat meter** per carrier — hall anger and missed gates cool it; smooth turnarounds warm it.
- **Temporary bans + fine** when layover heat crashes (short clock, not save-ruining).
- **Layover hub contracts** — up-front fee, drip transfer pax into the hall, happiness sampled, ban risk.
- **Procedural regionals** — light name/color fillers on the phone after you have one major.
- **Gate / stand assignment lite** — jets prefer stands nearest the hall; tower raises inbound cap to 2; HUD shows Gate / Hold.

## Still later (on your list, not finished)

- Full custom terminal wall painting (Tier A #1) + landside/airside
- Slot/curfew + de-ice (Tier C)
- Godot Steam rebuild (Tier D)
