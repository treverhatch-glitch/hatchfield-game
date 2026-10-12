# Hatchfield design notes

## Primary goal

Recreate **Airport Tycoon 3**’s gameplay loop first. HatchTag extras come after that loop feels real.

**AT3 comparison (live):** we beat AT3 on guest AI, airline drama, ops risk, and IPO. **Hub tier**, Field Rating, and heavy pack are now in. They still win on jetways, hotels, and scenarios.

**Airport CEO comparison (live):** we beat CEO on short-session fun, RCT guests, heat/layovers/Hub, and HATCH. **Research desk**, planner v2, de-ice/night (via R&D), and emergency asks shipped. They still win on secure zones, staffed desks, baggage belts, franchises, multi-terminal.

### AT3 core

1. Start with limited funds.
2. **Purchase land** — near city (passengers) vs near factories (cargo).
3. Enter **build mode** and stamp prefab buildings (not drag-paint runways).
4. Need **fuel tanks, fuel trucks, fuel contract**, fire, police, and other plane-service buildings to attract airlines.
5. When satisfaction / requirements are met, an **airline approaches with a contract**. Different airlines and aircraft types want different things.
6. Players can buy a **premade terminal** with working check-in/security/gates/claim, **or** custom-furnish their own.
7. Bad security is dangerous (threats / bombs). Police patrol.

### HatchTag layer (after AT3 loop)

- RCT guests + pathfinding + flight clocks
- Budget vs premium tags and desires (later golf / waterfall / gaming)
- Airside vs terminal as parallel games
- Heavier runway classes + helipad stub (live)
- Cargo: Umazon, UPPS, EXFED
- City road / rail / subway investment
- Land expansion, loans
- Budget-crowd facility wear + hall scrub
- Ops budget sliders, mechanics, airline MX, runway condition / weather crashes

Graphics in the sketch are placeholder. Priority is loops and money = picture.

See `ADDITIONS.md` for features added from research that were not in HatchTag prompts.

## Public market

Players can **IPO** once the field has traction. After listing: buy/sell HATCH shares, street missions, and public crises — a security breach / bomb slip **tanks the stock** and piles on fines. This is the progression AT3 never had after planes started landing.

## Terminal hall (RCT-inspired)

Apron / Hall toggle. Guests have needs (hunger, bathroom, energy, shop, bags, boarding clock). Short graph pathfinding with capped lookahead — Chris Sawyer’s lesson: perfect routing that stalls the sim is worse than guests who can get lost.
