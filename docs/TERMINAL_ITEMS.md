# Hatchfield — Terminal Interior Items Spec (TERMINAL_ITEMS.md)

Purpose: implementable spec for the Hall (terminal interior) in Hatchfield (Vite/React/TS/Three.js).
**All numbers (footprint, capacity, service time, cost, upkeep) are Hatchfield balance SUGGESTIONS**, not values from any game.
"Source" says which game had a comparable item. If not verified, it is marked **Hatchfield original**.

## Sources
- [ACEO-CI] Airport CEO wiki, Check-In: https://airportceo.wiki.gg/wiki/Check-In
- [ACEO-BAG] Airport CEO wiki, Baggage: https://airportceo.wiki.gg/wiki/Baggage
- [ACEO-SEC] Airport CEO wiki, Security: https://airportceo.wiki.gg/wiki/Security
- [ACEO-FLT] Airport CEO wiki, Flights (minimum terminal: check-in, security, boarding desk, secure exit): https://airportceo.wiki.gg/wiki/Flights
- [ACEO-DB18] Airport CEO Dev Blog 18 (drawn queues, security area crossing zones, boarding desk on jet bridge): https://www.airportceo.com/post/dev-blog-18-check-in-security-boarding
- [AT3-CB] Airport Tycoon 3 tips (interiors: check-in counters, security gates, washrooms, restaurants, stores; Retail Area unlocks shop/restaurant contracts; max 4 terminals): https://www.cheatbook.de/files/airporttycoon3.htm
- [AT3-GF] AT3 GameFAQs guide (Spectator Gallery, post office, hotels/gas by contract): https://gamefaqs.gamespot.com/pc/917833-airport-tycoon-3/faqs/62508
- [AT1-IGN] Airport Tycoon 1 IGN walkthrough (Terminal Entrance 8x2, terminal tiles priced per tile, retail shops in retail area): https://www.ign.com/articles/2003/02/25/airport-tycoon-walkthroughfaq-381852
- [AT1-MAN] Airport Tycoon 1 manual (areas furnished via creation window; GATES area connects airside; photo booths, vending machines; keep pax "entertained, relieved, informed and secure"): https://oldgamesdownload.com/wp-content/uploads/manuals/airport-tycoon_win_manual_en_6zv.pdf

Not verified from sources (treat as general genre knowledge, mark original if unsure): ACEO shops/food/toilets/seating exist in the secure zone (stated on [ACEO-SEC]); exact ACEO item variants beyond those listed are not claimed.

## Grid & conventions
- 1 tile = 1 m x 1 m in Hall. Footprint = W x D tiles (rotate with R swaps).
- Each item has: `queueTiles` (drawn or auto), `servicePoints` (parallel servers), `serviceSec` at 1x, `staff` (role x count).
- Costs in $ (Hatchfield currency); upkeep $/game-day. Sandbox mode ignores both.
- Zones are painted rectangles. Items can only be placed in allowed zones. **Landside** (open) vs **Airside** (secure) is a zone flag; only Security crosses it (ACEO rule [ACEO-SEC]; design pillar).

## Zones
| Zone | Side | Colour (floor) | Purpose | Source |
|---|---|---|---|---|
| Entrance / Check-in | Landside | light blue | curb doors, check-in, bag drop | AT1 Terminal Entrance [AT1-IGN]; ACEO open zone [ACEO-CI] |
| Security | crosses | red | screening choke | ACEO [ACEO-SEC][ACEO-DB18]; AT3 security gates [AT3-CB] |
| Passport / Immigration (International) | Airside | purple | intl departures exit control / arrivals entry control | Hatchfield original (not verified in sources) |
| Departures / Gates | Airside | dark blue | seating, boarding desk | AT1 GATES area [AT1-MAN]; ACEO boarding desk [ACEO-DB18] |
| Arrivals / Bag claim | Either | orange | claim belts, exit | ACEO baggage claim room [ACEO-BAG] |
| Shops / Food (Retail) | Either | yellow | spend | AT3 Retail Area [AT3-CB]; AT1 retail area [AT1-IGN] |
| Toilets | Either | teal | bladder need | AT3 washrooms [AT3-CB]; ACEO bathrooms [ACEO-SEC] |
| Lounges | Airside | gold | premium energy/happiness | Hatchfield original |
| Info / Services | Either | green | lost pax, info | AT1 "informed" [AT1-MAN]; item details Hatchfield original |
| Staff / Back-of-house | Staff only | grey | staff room, bag hall | ACEO baggage bay/belts [ACEO-BAG], staff-only exit [ACEO-SEC] |

## Items
Columns: Footprint (WxD) · Capacity/queue · Service s · Build $ / Upkeep $/day (SUGGESTED) · Staff.

### Entrance / Check-in
| Item | Function for passengers | Footprint | Capacity / queue | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Entrance doors | Spawn/exit point from curb; counts flow | 4x1 | 20 pax/min | 0 | 2,000 / 10 | 0 | AT1 Terminal Entrance 8x2 [AT1-IGN] |
| Small check-in desk (manned) | Ticket only, no hold bags | 2x1 | 1 server, queue 8 | 40 | 3,000 / 40 | 1 agent | ACEO [ACEO-CI] |
| Check-in desk w/ bag belt (manned) | Ticket + hold bag onto belt → bag hall | 3x1 | 1–2 servers, queue 12 | 60 | 6,000 / 70 | 1–2 agents; needs belt to Bag hall | ACEO medium desk [ACEO-CI]; AT3 check-in counters [AT3-CB] |
| Self check-in kiosk | Ticket, no bags; fast | 1x1 | 1, queue 4 | 25 | 4,000 / 15 | 0 | ACEO [ACEO-CI] |
| Automatic bag drop | Drops bags after kiosk | 2x1 | 1, queue 6 | 30 | 7,000 / 25 | 0; needs belt | ACEO [ACEO-CI] |
| Queue rail (per tile) | Holds a line; longer = more waiting room | 1x1 | 2 pax/tile | — | 100 / 0 | 0 | ACEO drawn queues [ACEO-DB18] |

### Security
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Small security lane | Screens pax+carry-on; landside→airside | 3x4 | 1 lane, queue 10 | 45 | 8,000 / 80 | 1 officer | ACEO small checkpoint (1 officer, slow) [ACEO-SEC] |
| Medium security lane | Faster screening | 4x5 | 2 lanes, queue 20 | 30 | 18,000 / 200 | 4 officers | ACEO medium (4 officers) [ACEO-SEC] |
| Large security lane | Fastest | 6x6 | 3 lanes, queue 30 | 20 | 30,000 / 260 | 5 officers | ACEO big (5 officers) [ACEO-SEC] |
| Walk-through detector / bag X-ray (sub-parts) | Visual parts inside lane; random search adds 30 s | 1x1 / 2x1 | — | +30 on search | incl. | — | ACEO detectors & scanners placed in station [ACEO-DB18] |
| Secure exit (one-way) | Arrivals leave airside without screening | 2x1 | 30 pax/min | 0 | 1,500 / 10 | 0 (or 1 guard) | ACEO Security Exit [ACEO-SEC][ACEO-FLT] |

### Passport / International
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Passport control booth | Intl pax only; departure exit / arrival entry | 2x2 | 1, queue 10 | 35 | 6,000 / 60 | 1 officer | Hatchfield original |
| e-Gate | Faster for business/premium tags | 1x2 | 1, queue 6 | 15 | 9,000 / 20 | 0 | Hatchfield original |
| Customs desk | Arrivals after claim; random check | 2x2 | 1, queue 8 | 20 (60 if checked) | 5,000 / 50 | 1 officer | Hatchfield original |

### Departures / Gates
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Boarding desk | Scans pass, releases pax to jetway/bus | 2x1 | 1, auto queue | 8 | 3,000 / 40 | 1 agent; must link to a stand/jet bridge | ACEO [ACEO-DB18][ACEO-FLT]; AT1 GATES [AT1-MAN] |
| Seat row (4 seats) | Restores energy while waiting | 4x1 | 4 | sit until board | 600 / 2 | 0 | ACEO seating [ACEO-SEC]; AT1 seats (screenshot ref) |
| Bus gate door | Remote stand: pax board apron bus | 2x1 | 40/bus | 0 | 2,500 / 10 | 0 | Hatchfield original (ties to Apron view) |
| Flight info screen (FIDS) | Lowers "lost" chance in radius 8 | 1x1 | — | — | 800 / 5 | 0 | AT1 "informed" [AT1-MAN]; specifics Hatchfield original |

### Arrivals / Bag claim
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Bag claim carousel (loop) | Pax wait for own bag; bags arrive from bag hall | 6x3 | 30 waiting | wait = bag arrival (+5 pickup) | 12,000 / 60 | 0 (needs bag-hall link) | ACEO looping claim belt, secure or open [ACEO-BAG] |
| Lost-bag desk | Late/lost bag pax resolve here; softens Standing hit | 2x1 | 1, queue 6 | 90 | 2,500 / 40 | 1 agent | Hatchfield original |
| Meeter-greeter area | Landside wait space | 4x2 | 12 | — | 800 / 2 | 0 | Hatchfield original |

### Shops / Food (Retail)
AT3 note: shops/restaurants come via *contracts* into Retail Area space [AT3-CB]. Hatchfield: offer both — direct placement plus optional tenant letter (fits "letters are drama").
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Spend/pax (sugg.) | Source |
|---|---|---|---|---|---|---|---|---|
| Café / coffee kiosk | Hunger small, energy + | 2x2 | 1 server, queue 6 | 30 | 4,000 / 30 | 1 | $6 | AT3 restaurants [AT3-CB] (generic) |
| Restaurant | Hunger large; dwell 5–10 min | 5x4 | 12 seats | 300 | 15,000 / 90 | 3 | $18 | AT3 restaurants [AT3-CB] |
| Fast food | Hunger med, fast | 3x3 | 2 servers, queue 10 | 45 | 8,000 / 60 | 2 | $10 | Hatchfield original variant |
| Newsagent / shop | "Shop" need | 3x3 | 6 browsing | 60 | 6,000 / 40 | 1 | $8 | AT3 stores [AT3-CB]; AT1 retail [AT1-IGN] |
| Duty-free (airside, intl) | Shop need, premium spend | 5x4 | 15 browsing | 120 | 20,000 / 100 | 2 | $35 | Hatchfield original |
| Vending machine | Small hunger/thirst | 1x1 | 1 | 10 | 800 / 3 | 0 | $2 | AT1 [AT1-MAN] |
| Photo booth | Play/fun | 1x1 | 1 | 40 | 1,000 / 3 | 0 | $3 | AT1 [AT1-MAN] |

### Toilets
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Toilet block (M/F) | Bladder need; dirt rises, needs cleaner | 4x3 | 6 stalls, queue 8 | 60 | 5,000 / 30 | cleaner visits | AT3 washrooms [AT3-CB]; ACEO bathrooms [ACEO-SEC] |
| Accessible / family toilet | Family tag preference | 2x2 | 1 | 90 | 2,000 / 10 | cleaner | Hatchfield original |

### Lounges & comfort
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Airline lounge | Premium/business: energy, happiness, +Standing w/ owner airline | 8x6 | 20 | dwell until board | 40,000 / 200 | 2 | Hatchfield original |
| Spectator gallery | Play need; views apron | 6x3 | 15 | 180 | 10,000 / 20 | 0 | AT3 Spectator Gallery [AT3-GF] (was a building, here interior) |
| Kids play area | Family play need | 4x4 | 8 | 180 | 6,000 / 15 | 0 | Hatchfield original |

### Info / services
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Information desk | Re-routes lost guests; reduces lost% in zone | 2x2 | 1, queue 5 | 20 | 3,000 / 40 | 1 | AT1 "informed" [AT1-MAN]; item Hatchfield original |
| ATM | Wallet top-up → more spend | 1x1 | 1 | 15 | 1,500 / 5 | 0 | Hatchfield original |
| First-aid room | Heals sick pax (ties to emergencies) | 3x3 | 2 | 120 | 6,000 / 50 | 1 medic | AT3 Infirmary (building) [AT3-GF]; interior Hatchfield original |
| Bin | Lowers litter → cleanliness | 1x1 | — | — | 100 / 1 | cleaner | Hatchfield original |

### Staff / back-of-house
| Item | Function | Footprint | Capacity | Service s | Build / Upkeep | Staff | Source |
|---|---|---|---|---|---|---|---|
| Baggage belt (per tile) | Carries bags desk → bag hall → claim | 1x1 | 4 bags/tile | 1 tile/s | 300 / 1 | 0 | ACEO [ACEO-BAG] |
| Bag hall / baggage bay | Bags to/from apron carts (link to Apron bag trucks) | 6x4 | 60 bags | 20/bag | 15,000 / 80 | 2 handlers | ACEO baggage bay [ACEO-BAG] |
| Hold-bag scanner | Screens checked bags; failed = delay | 3x2 | 1 bag / 6 s | 6 | 12,000 / 50 | 1 | ACEO bag scanners [ACEO-BAG][ACEO-SEC] |
| Staff room | Staff energy; staff without it work slower | 4x3 | 8 | 300 | 4,000 / 20 | — | Hatchfield original |
| Janitor closet | Cleaner home base | 2x2 | 2 cleaners | — | 1,500 / 10 | cleaners | Hatchfield original |

## Passenger flows (pathing = capped BFS, Sawyer cap)
**Departure (domestic):** Entrance doors → [Check-in desk w/ bags | Kiosk → Bag drop | Small desk if no bags] (bag → belt → scanner → bag hall → apron cart) → Security lane → *needs loop* (Toilet / Food / Shop / Seat, while time-to-board > 20 game-min) → Gate seats → Boarding desk → Jet bridge or Bus gate door → aircraft.
**Departure (international):** as above + Passport booth / e-Gate after Security; Duty-free available after passport.
**Arrival (domestic):** aircraft → jet bridge / bus → Secure exit → Bag claim carousel (if hold bag; wait for bag from bag hall) → Toilet optional → Meeter-greeter → Entrance doors (curb).
**Arrival (international):** aircraft → Passport booth (entry) → Bag claim → Customs desk → Secure exit → landside → doors.
**Transfer:** Secure exit not used; Passport/Security re-screen (Hatchfield original) → Gate.
Failures (readable hurt): no path / missing required item → guest "lost" (info desk helps) → Happiness down → airline Standing down. Bag not delivered by claim timeout → Standing hit (per ECONOMY law).

## MVP set (build first, 12 items)
1. Entrance doors 2. Queue rail 3. Check-in desk w/ bag belt 4. Self check-in kiosk 5. Small security lane 6. Secure exit 7. Seat row 8. Boarding desk 9. Bag claim carousel 10. Baggage belt + Bag hall (one system) 11. Toilet block 12. Café kiosk
(Then: FIDS, info desk, newsagent, restaurant, passport booth.)
Minimum valid terminal = check-in, security, boarding desk, secure exit (matches ACEO requirement [ACEO-FLT]).

## Low-poly art notes (Three.js, flat-shaded, ≤500 tris each, shared palette)
- Entrance doors: glass slab (transparent 0.4), steel frame, green arrow decal.
- Queue rail: chrome posts (cylinders) + blue strap boxes, auto-joined.
- Check-in desk: white counter box, airline-colour backboard panel (tinted per airline), tiny monitor, belt slot behind.
- Kiosk: tall thin box, angled screen quad emissive blue.
- Bag drop: low box with roller-belt stripe texture, yellow scale plate.
- Security lane: grey X-ray tunnel box + belt, arch detector (torus half/rect frame), tray stack.
- Secure exit: one-way turnstile, red/green light.
- Passport booth: glass-topped cubicle, dark blue; e-Gate: twin waist-high pillars with flap.
- Customs desk: green/red signage boards.
- Boarding desk: small podium, gate number sign (canvas texture), stand ID.
- Bus gate door: glass door + bus icon sign.
- Seat row: 4 black bucket seats on a chrome beam.
- FIDS: black box with emissive canvas texture of flight list.
- Claim carousel: oval extruded loop, dark rubber top, bag cubes in random colours riding it.
- Lost-bag desk: counter with "?" suitcase sign.
- Meeter-greeter: low barrier rail + floor decal.
- Café: counter + coffee machine block + 2 stools; brown/cream.
- Restaurant: tables (cylinders) + chairs, counter, warm floor.
- Fast food: bright red counter, menu board emissive.
- Newsagent: shelves (stacked boxes coloured as magazines), till.
- Duty-free: white glossy shelves, perfume bottle prisms, gold sign.
- Vending: tall box, emissive front grid. Photo booth: box with curtain plane.
- Toilet block: partition walls, blue/pink door signs, sink counter.
- Accessible toilet: single box + wheelchair icon.
- Lounge: carpet colour patch, sofas (rounded boxes), plant cones, frosted glass walls.
- Spectator gallery: window wall facing apron + benches + coin telescopes.
- Kids play: soft-colour blocks, small slide.
- Info desk: round counter (cylinder) with "i" sign.
- ATM: wall box, green screen. First aid: white room box, red cross sign. Bin: small cylinder.
- Belt: flat grey strip with arrow UV scroll. Bag hall: open shed, cart docks.
- Hold-bag scanner: big beige box, tunnel. Staff room: table + lockers. Janitor closet: door + mop bucket.

## Implementation notes for the coder
- Data in `src/game/catalog.ts`: `{id, zone[], side, w, d, servers, queueCap, serviceSec, cost, upkeep, staff:{role,count}, needs:{hunger?,bladder?,energy?,shop?,play?}, spend?, requires?:['bagBelt'|'stand']}`.
- Placement validates zone membership and footprint; one click = one item (debounce).
- Each item exposes `queueSlots: Vector3[]` and `servicePoint`; guests travel → wait → done (visible).
- Keep `floor: 1` field for future multi-storey (AT1 had 2-storey terminals [AT1-IGN]).

## Terminal build kit (shipped, issue #35)
- Data: `src/game/terminalKitData.ts` (items, outlet prices/stock, comfort and seat tuning). Logic: `src/game/terminalKit.ts`.
- Build from scratch: stamp a Terminal shell → paint zones in the hall panel → place entrance, check-in, security, boarding desk, claim. The panel shows whether the curb → gate path works.
- Kit bar (hall view, bottom-left): Food / Seating / Decor / Bulldoze. Picking a card closes the tray and arms a ghost (green = valid, red + reason). R rotates, click places, Esc cancels. Bulldoze refunds 40%.
- A cell has 4 slots: benches/decor take 1, café/fast food 2, desks/lanes/restaurant 4.
- Food: café, fast food, sit-down restaurant. Tag-matched outlet wins (budget/family → fast food, premium/business → restaurant). Sales draw the shared food shelf, credit the operator, and are tallied per outlet and in `foodCourtRevenue`.
- Seats: idle guests at gate / claim / food / lounge take a free seat in the same painted zone, rest, and get a small mood gain.
- Decor: comfort points fade over `comfortRadius` cells, capped; guests in that zone gain a little happiness per second. Every piece has upkeep.
- Prefab bundle pieces (bundled café / seat row) keep their tuned prefab behaviour and cannot be bulldozed.

## Litter, trash cans and janitors (issue #41)
- Data: `src/game/litterData.ts` (`LITTER_TUNING`). Logic: `src/game/litter.ts`. Render: `src/render/hallLitter.ts`.
- A meal or coffee goes into the passenger's hand (small hand prop) and is finished over `mealMinutes` / `drinkMinutes` game minutes while they walk, queue or sit. When it runs out, a trash can within `binRadius` cells (~12 m) of where they are now takes the rubbish if it is not full; a full can counts as no can, and the litter lands on the floor at that spot. Passengers who board or leave first drop it at their last hall spot. Litter never spawns at the counter.
- Trash can (kit bar → Service): $150, $1/day. Holds `binCap` pieces, then shows a red band and overflowing lid and refuses more.
- Restrooms gain dirt (0–100) on every visit (budget/family dirtiest). Above `restroomDirtyAt`, visitors lose happiness.
- Janitors: the existing hire (Ops panel), wage on the cleaning payroll line. Each hire walks the hall at 1.3 m/s: full cans first, then a dirty WC, then the nearest litter. A cleaning budget below 20% idles them; a lower budget slows them.
- Floor litter in a zone cuts comfort and drains happiness (capped) for guests there.
- Advisor: "No trash cans near food court", "Litter piling up", "Trash cans full", "Restrooms dirty: hire janitors".
