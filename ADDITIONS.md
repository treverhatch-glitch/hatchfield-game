# Additions HatchTag did not explicitly prompt

Things added while looping overnight (research + judgment). Your prompts still win if anything conflicts.

**Canonical design / ideas / problems / economy / next steps:** see [`docs/`](./docs/). This file stays the research + shipped changelog.

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
| **True multi-runway ATC** | ~~Longest strip wins~~ **N strips** with per-slot RW banks + inbound scaling | Crosswind / independent parallel ops polish |

### Verdict

- **AT3 core loop:** we match or beat it (stamp → contract → turnaround money).
- **AT3 scale fantasy:** they win (big terminals, jetways, hotels, scenarios).
- **Modern depth:** we win (RCT guests, heat/layovers, budgets/crashes, HATCH, schedule drama).

Goal: keep our depth, steal AT3’s *growth silhouette* (second terminal, hub tier, scenarios) without copying its opaque rating goo.

### Gap analysis (updated)

| Pillar | Have now | Missing for “complete” feel |
| --- | --- | --- |
| Build | Prefabs, 3 strip lengths, helipad, apron↔hall, N-runway banks | Custom walls/doors; richer jetway art |
| Airlines | 6 premade + Guard + proc fillers; personas; heat; layovers; bans | Hub-tier contracts; brand lounges/rewards; abandon on dead heat |
| Aircraft | Named frames + roles + strip gates | A380 / An-124 / C-5; pushback; noise/weight classes |
| Pax | Budget/premium + needs + clocks + transfers | Deeper traits (family/business); complaint cards |
| Cargo | 3 freighters + shed | Night banks, customs delay |
| City | Rail, parcels, hotel + car parks, two plots | Curfew, more site presets |
| Staff | Budget sliders + mechanics | Research-gated units; shifts |
| Meta | IPO + street missions | Scenarios, AGM, Godot ship |

### Upgrade plan (dependency order — beat AT3)

**P0 — AT3 growth silhouette (next)**

1. **Field Rating** meter — ~~blend of reputation, avg airline heat, wear inverse, security~~ **shipped**.
2. **Hub contract tier** — ~~after successful layover / heat 75+, Hub plaque: denser slots, brand lounge, harsher ban~~ **shipped**.
3. **Airline rewards / abandon** — ~~high heat unlocks persona perk; heat floor → warning → abandon + fine~~ **shipped**.
4. **Second terminal + jetway lite** — ~~second hall fit assigns its own stands; proximity jetways; T#·G# gates; hall chips~~ **shipped**.

**P1 — AT3 catalog + ATC**

5. **Research tree** — ~~points from flights/pax; unlocks night/de-ice/stand class/heavy~~ **shipped**.
6. **Multi-runway + multi-terminal pathing** — ~~N strips scale inbound + per-strip schedule banks; stand→strip A* with pref fallback; T# jetways; timetable/inbound scale with strip count~~ **shipped**.
7. **Emergency asks** — ~~weather divert / firefighting plane refuel / refuel+MX; CL-415·AT-802; can't-host fail fine~~ **shipped**.
8. **Heavy pack + mil ramp** — ~~A380 / An-124 (heavy_pack); C-5M behind mil_ramp + Guard hangar-side pads~~ **shipped**.

**P2 — AT3 meta AT3 never stuck the landing on**

9. **Scenarios** — timed goals on preset sites.
10. **Hotels / landside city** — money vs curfew noise.
11. **Custom terminal painter** — walls rewrite hall graph (skill ceiling).
12. **Godot Steam** — only after P0–P1 feel unfair-fun.

**P2.5 — Freeflow build (player request — park for later)**

> **Do not start until grid gameplay feels solid.** HatchTag wants Cities: Skylines 2–style freeflow placement (continuous drag roads/buildings, not chessboard stamps). That is a **foundation rewrite** (pathfinding, save format, apron mesh, snap rules) — too invasive to bolt on mid-loop. Current ship: **CS2-style category menus** on the existing tile grid (Pavement / Stands / Terminal / Ops / Landside / Bulldoze). When we open this workstream:
>
> 1. Continuous road / taxi paint with snap-to-angle (not cell stamps)
> 2. Footprint placement for buildings (variable size, rotate free)
> 3. Replace `SIZE²` tile arrays with spatial hash / zones
> 4. Keep security-choke hall graph as the terminal interior model
>
> Track as **Freeflow build** — preferred end-state; grid stays until then.

### Recommended ship order (legacy tiers, still valid)

**Tier A — make the airport feel built by you**

1. **Custom terminal painter** — stamp walls/floors, place doors that rewrite the hall graph.
2. **Landside / airside clarity** — ~~secure line as a real cut~~ (map labels live); enforce amenity side later.
3. **Gate & stand assignment** — ~~lite live + multi-hall jetways (T#·G#)~~ **shipped**; custom painter later.

**Tier B — airline drama** — mostly **shipped** (personas, proc, layovers, bans, heat). Next: Hub tier + rewards/abandon.

**Tier C — day/night & seasons (CEO depth)**

7. **Slot / curfew clock**
8. **De-ice / winter ops**
9. **Franchise retail**

**Tier D — meta & Steam**

10. **Scenarios**
11. **AGM / shareholder votes**
12. **Godot Steam rebuild**

## Airport CEO deep dive — us vs them (refreshed Oct 2026)

Sources: Airport CEO wiki (Flights, Flight Planner, Contracts, Baggage, Stands), Steam R&D guide (Commercial → Extended → Ultimate license; Night flights; De-icing; Belts; Franchises; Multi-terminal). CEO = 2D construction authenticity + staffed zones + drag-drop planner + admin R&D. Hatchfield = AT3 stamp loop + RCT hall + ops risk + HATCH + real-ops GSE sketch.

### Scorecard (current ship)

| System | Airport CEO | Hatchfield now | Who wins today |
| --- | --- | --- | --- |
| **R&D spine** | Admin desks + long project tree (commercial → medium/large permits, night, de-ice, belts, franchises, multi-T) | RP + lab pawns; tree Night→De-ice→Stand class→Heavy→Mil | **Tie** — they have breadth; we have a readable spine that finishes in one sitting |
| **Flight planner** | Drag-drop grid, hours/days ahead, night gate, stand rows, auto via COO/CIO | Day strip, pull/bump, runway prefs, auto/manual, cascade drama | **CEO** on UX craft; **us** on delay tension |
| **Secure / intl zones** | Paint secure + international; passport desks; wrong zone = broken flow | Landside↔security↔airside graph enforcement; breach = incident | **CEO** (intl/passport tools); **us** partial |
| **Staffed desks** | Agents, screeners, ramp, admins with commute | Desk agents on check-in/security/gate; empty = queues | **Close** — they have more roles; we have the fun body→queue link |
| **Stands** | Small/med/large, remote vs attached, service roads, night access | One stand tile; strip length + stand_class research; mil hardstands | **CEO** |
| **Pushback** | Required vehicle for med/large | Boarding → pushback beat → taxi | **Us** for readability; they for vehicle authenticity |
| **Night ops** | Night Flights R&D; 05:00–22:00 else | Night bank research; soft curfew slips without it | **Tie** |
| **De-ice** | Permit + pad + truck + fluid | Research softens storm pulse/crash; no pad/truck verb | **CEO** |
| **Baggage** | Belt layout skill (check-in→scan→bay→truck→plane; claim loops) | Real tug cycle shed↔plane↔claim; no conveyor skill | **CEO** on skill depth; **us** on visible GSE |
| **Fuel / MX** | Depot + trucks; service rounds | Farm bottom-load bowser; hangar→stand MX walk | **Us** for picture clarity |
| **Franchises** | Research-locked shop/café brands | Budget heat perk snack franchise only | **CEO** |
| **GA** | Core early loop; multi-hour park | Independent asks, fee/day-rate, leave request, ~20h window | **Tie** (they earlier; we spicier leave drama) |
| **Multi-terminal** | Late Ultimate-license research | Lite now (N halls, T#·G# jetways, pathing) | **Us** for availability; **CEO** for gated progression |
| **Airline drama** | Contracts + relationship + service requests | Personas, heat, layovers/bans, field asks, Hub, abandon | **Us** |
| **Guest AI** | Desk flow + satisfaction | RCT needs, miss clocks, anger→heat | **Us** |
| **Capital** | Economy panel | IPO / HATCH / street missions | **Us** |
| **Session feel** | Long authentic build | Starter kit → money in minutes | **Us** |
| **Military** | Emergencies | Guard host + named metal + mil ramp | **Us** |

### Verdict (honest)

- **Is Hatchfield “better” overall?** Not yet as an Airport CEO replacement. We are **better at short-session fun, airline personality, guest drama, capital spice, and readable turnarounds**. They are **better at construction authenticity** (zones, belts, stand classes, drag-drop planner, franchise brands, de-ice verb).
- **If the goal is “unfair-fun AT3 sketch that steals CEO’s spine”** — we are ahead of where CEO feels in the first hour, and behind where CEO feels at hour ten.
- **Do not clone** CEO’s admin commute / staff-room bureaucracy. Steal the *verbs* that teach layout skill (belts, zone paint, stand class, planner craft).

### Where we still lose (steal next)

1. **Planner craft** — drag/slot on a day+ grid, not just pull/bump buttons  
2. **Baggage belt lite** — check-in→makeup→bay path skill (trucks already real)  
3. **De-ice verb** — pad stamp + glycol truck in storms  
4. **Stand sizes** — S/M/L stamps; remote vs jetway  
5. **Franchise brands** — signable shop/café contracts beyond heat perk  
6. **International zone** — passport desk + intl airside graph cut  
7. **Stairs / belt loader GSE** — visible boarding hardware for larger metal  

### Upgrade plan — make ours better (ordered)

**Principle:** Keep starter→Northline money sacred. Every CEO steal must show in the picture (truck/body/belt), not a spreadsheet.

#### Wave A — Planner + winter — **SHIPPED**

1. **Planner v3** — day strip + night column (locked hatch until Night bank); click slot → ETA ±10 / pin stand by class label; pull/bump cascade kept.  
2. **De-ice pad + truck** — stamp pad (needs De-ice ops); storm/fog dispatches glycol truck from pad; pushback holds until sprayed (timeout = heat dip).  
3. **Stand class stamps** — S / M always; L needs Stand classes research; inbound metal filtered by class; labels `T1·G2·M`.

#### Wave B — Layout skill (CEO’s best lesson)

4. **Baggage belt lite** — paint belt tiles: check-in drop → makeup → bay; trucks only load/unload at connected bays; broken path = delayed bags + heat. Claim loop optional v1.  
5. **Franchise brand contracts** — CounterBite / SkyGlass offers; sign fee → guaranteed hall spend mult + rare brand crisis mission.  
6. **International zone lite** — passport room + `intl` hall flag; Summit/Harbor intl flights need it; domestic still uses secure only.

#### Wave C — Scale fantasy (stay ahead of CEO)

7. **Remote stand service** — bus/stair for non-jetway stands; pay cut if missing.  
8. **Multi-terminal research gate** — 2nd hall free early stays; 3rd+ needs “Campus ops” research; per-hall schedule filter.  
9. **Stairs / belt loader GSE** — widebody/heavy show loader + stair before board complete.  
10. **Godot Steam shell** — only after Waves A–B feel unfair-fun; browser remains design lab.

#### Explicit non-goals (do not steal)

- Admin commute / bus stops for researchers (soft off-shift exit leave is enough)  
- Full 2D wall/foundation painter before belts+planner  
- Cloning CEO’s email inbox UI  
- Making the first hour as slow as CEO’s commercial license grind  

### Success tests (CEO parity without CEO boredom)

A player can, without a wiki:

1. Boot → starter → Northline money in ~2 minutes (**we already win**).  
2. Open planner, drag a slot onto a stand/night cell, see cascade if they collide.  
3. Storm hits → de-ice truck rolls or jet holds — visible.  
4. Break a belt path → bags late → airline heat dips → fix belt → recover.  
5. Sign a franchise → hall spend jumps; fail a brand crisis → fine.  
6. Still beat CEO on layover ban drama + HATCH IPO in the same session.

If 1–4 work, we match CEO’s skill spine. If 5–6 work, we are **better** than CEO for HatchTag’s fantasy.

### Debug pass (hold deadlock)

- **Bug:** jets spawned into `hold` while already reserved a stand; `releaseHold()` called `assignStand()` which never returned that stand → forever holds, inbound bank jammed, cascades.
- **Fix:** slip slots when pavement busy; `releaseHold` reuses reserved stand; 95s hold watchdog diverts and frees the gate.

### Pushback + fuel continue

- Boarding → **pushback** beat → taxi out (cargo/mil too).
- Fuel bowsers can retarget the next thirsty stand instead of always deadheading to the farm.

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

## Shipped — wake-up first hour (this loop)

- **First hour** checklist (bottom-left): stamp field → sign → inbound → first takeoff. Dismissible; auto-hides after first civilian turnaround; persisted in browser save.
- First takeoff news + small reputation bump so the loop lands as a win, not just a ticker line.

## Shipped — last overnight (field asks + night curfew)

- **Airline field tasks** — after the first turnaround, signed carriers ask for concrete upgrades (police, hangar, janitor, hotel, car park, cargo shed, helipad, second desk…). Clock + cash bonus / fail fine + heat. Persona-weighted picks. Persists in save.
- **Soft night curfew** — without Night bank research, pax slots slip after dark with a heat nick; freighter night bank still the unlock path.

## Playability pass (full playthrough loop)

- **Storm pulse** — storms always nick the bank on a cool (de-ice softens); hangar stamp tips for Guard pads.
- **Cascade headline rate-limit** + lighter heat on runway-backlog slips so the ticker stays readable.
- **mil_ramp** cost 48 → 42 so the research spine finishes in one sitting.
- `scripts/playthrough-full.mts` exercises boot → IPO → Guard → save/load.

## Real-ops GSE + independent parking

Modeled after airport apron practice (Schiphol/BIX baggage flows, fuel farm bottom-load, hangar line MX):

- **Bags** — shed → aircraft unload → **to_claim** (plane→shed/claim inject) → continue or park; outbound **makeup pickup** at shed (`preDwell`) → load at stand → home/continue.
- **Fuel** — bowser bottom-loads at the farm, fuels on stand (bond/pump dwell), then reloads at farm or continues if stock remains.
- **Line MX** — mechanic walks hangar → stand → hangar; pay posts when the visit finishes (not on landing).
- **Independent parking** — random GA asks (not signed airlines), parking fee + day-rate, pilot **requests leave** after stay, **~20h ops window** (`GA_LEAVE_WINDOW` = 150s of 180s day) with auto tower release or manual Release; overstay fine if they miss it.

## Shipped — landside economy + UX polish (this loop)

- **Passenger landside modes** — guests arrive/leave via drop-off, short/long park, hotel, bus curb, or rail station (persona-weighted). Missing preferred infra angers them; matching modes charge small fees + landside uses.
- **Landside buildings (real meshes)** — four car park stamps × short/long term; three outside hotel grades; inside **dayhotel** for layover spend.
- **Usage economy** — fees only when pax use infra; fixed building + amenity expenses every payroll tick. Idle landside bleeds cash.
- **RCT guest wallets** — budget / family / business / premium with random cash + spend prefs; purchases gate on preference and wallet.
- **Perf pass** — lower GL DPR/shadows, drop dim-layer blur, throttle Hud emit (~0.4s sim) so 3x doesn’t hitch-jump.
- **Offer / emergency spacing** — first airline call soon after starter kit; later contracts + divert/tanker asks much slower.
- **Security choke** — hall graph is doors/info/check-in → security → airside only. Premade ships sealed; player shells without security invite smuggling/weapons threats + fees/heat.
- **3D hall** — orbit/pan/zoom terminal view with room meshes + walking pax; apron keeps simulating while inside.
- **CS2 build menus** — category tabs (Pavement / Stands / Terminal / Ops / Landside / Bulldoze) + bottom tray of stamps (**still tile-grid** until P2.5 freeflow).
- **CS2 info chrome** — bottom bar for view/time/ticker/cash; Economy · Budget · Research · Airlines · Planner · Services roll out above the dock. Peek when idle; slide up on hover/click.
- **Letter inbox** — contracts, layovers, Hub, MX, parking, threats, emergencies stack on the right as letters. Hover/click expands; accept/decline inside; unread letters expire on a deadline.
- **Apron inspect** — hover jets for model / airline / destination / activity / next step + fuel & catering bars. Signed line-MX traffic taxis into a hangar bay; hangar hover shows occupant + MX countdown. **5x** speed skips inspect cards entirely (fast-forward scrub).
- **5x speed** — Pause / 1x / 3x / 5x on the bottom bar; UI emit rate backs off at 5x so the HUD stays smooth.
- **Jetway vs remote stands** — Stand stamp toggle Remote / Jetway (×1.85). Jetway links to a hall within range: fast board/deboard, no apron pax mesh, hall guests get more spend time. Remote stands ferry via **Terminal bus depot** or walk the apron (slow). Shared congestion slows jets/trucks/walkers when layouts clash.
- **Hall entertainment spend** — food, souvenirs, lounge, golf, gaming, waterfall, day rooms, massage spa, airside pool.

## Still later (on your list, not finished)

See **Upgrade plan — make ours better** above (Waves A→C). Short list:

- Wave A: Planner v3 · De-ice pad+truck · Stand S/M/L — **shipped**
- **Research lab bodies** — hire researchers; furnish landside R&D desk / chalkboard / lab bench; they walk stations in Hall; RP only while working; breaks + soft off-shift “home” (exit leave, not CEO bus commute); night = slower drip + more off-shift.
- **Economy leash** — standard after kit is ~$7k (loan almost required); loan interest scales with balance and capitalizes when unpaid (capped); payroll gains a field-load multiplier from signed carriers / stands / turn volume so mid/late stays a money puzzle; thrifty+loan forever is a trap, grow+repay is the healthy path.
- Wave B: Belt lite · Franchise brands · Intl zone  
- Wave C: Remote stands · Multi-T research gate · Stairs/loader · Godot  
- Parked: custom wall painter (after belts+planner)
- **Parked P2.5 — Freeflow build** — CS2 continuous roads / free-rotate footprints (see Upgrade plan). Grid stays until that workstream opens.
