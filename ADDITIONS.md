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

- **Apron** (3D AT3 field) and **Hall** (2D terminal crowd) toggle — same money, different game.

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

## Aircraft mix (queued ask)

- **Passenger sizes** — regional / narrowbody / widebody (wide needs heavy strip; fees scale).
- **Freighters** — cargo metal, distinct paint.
- **Emergency** — medevac helos + fixed-wing air ambulance (ambulance budget gate).
- **Military / Guard host** — Boise-style agreement (hangar + tower + police + rep); olive transports transit for fat landing fees.

## Threat intercept

- Alerts pause as a **Scramble / Ignore** choice instead of an instant fine. Scramble costs cash; success scales with security level, police, and security budget.

## Runway lengths + real airframes

- **Short / regional / heavy** strips (10 / 14 / 20 cells). Longest continuous strip gates what can land.
- **Named metal** — CRJ-700, E175, A320neo, 737-800, A321, 787-9, A350-900, 767F, 747-8F, C-130H, KC-135R, Citation Latitude, AW139, S-76. Scale + fees follow the airframe.

## Amenity dens (live)

- Furnish **indoor golf**, **waterfall court**, **gaming den** — guests grow a `play` need and spend there.

## Strategy backlog (idea gen — ship next)

1. **Custom terminal painter** — wall/floor stamp, door links for the hall graph.
2. **Smooth apron ↔ hall ↔ airside** — deeper “walk inside the building” feel (Hall view exists; custom walls next).
3. **Slot & curfew clock** — city noise vs night freighter money.
4. **Multi-stand pushback / ground holds** — tower value under traffic.
5. **Franchise retail contracts** — signed hall brands.
6. **Seasonal weather / de-ice trucks**.
7. **Shareholder AGM events**.
8. **Godot Steam rebuild** — after browser loops feel complete.

## Still later (on your list, not finished)

- Full custom terminal wall painting
- Slot/curfew + de-ice
- Godot Steam rebuild
