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

## Still later (on your list, not finished)

- Live helicopter / medevac flights
- Full custom terminal wall painting
- Bomb/threat minigame beyond fines
- Golf / waterfall / gaming dens
- Godot Steam rebuild
