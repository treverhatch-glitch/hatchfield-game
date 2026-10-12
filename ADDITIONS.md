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

### Gap analysis (full experience)

| Pillar | Have now | Missing for “complete” feel |
| --- | --- | --- |
| Build | Prefab stamps, 3 runway lengths, helipad | Custom terminal walls/doors; landside vs airside zones; multi-building campuses |
| Airlines | 6 premade + Guard host | Stronger personalities; layover contracts; bans; optional procedural fillers |
| Aircraft | Named frames + size/fees | Pushback queues; gate assignment; weight/noise classes; GA / flight school |
| Pax | Budget/premium + needs + clocks | Traits (family, business, transfer); layover dwell; complaint → airline heat |
| Cargo | 3 freighters | Night banks, warehouse chains, customs delay mini-loop |
| City | Rail stub, parcels | Curfew, noise complaints, tourism campaigns, competing airport |
| Staff | Budget sliders + mechanics | Named crew, shift coverage, union events |
| Meta | IPO + missions | AGM votes, difficulty campaigns, sandbox vs scenario |

### Recommended ship order (not calendar — dependency order)

**Tier A — make the airport feel built by you**

1. **Custom terminal painter** — stamp walls/floors, place doors that rewrite the hall graph. Biggest skill gap vs premade box.
2. **Landside / airside clarity** — secure line as a real cut; wrong-side amenities don’t help departures.
3. **Gate & stand assignment** — jets pick a gate; tower + multiple stands create queues (tower finally “pays”).

**Tier B — airline drama (HatchTag + your layover idea)**

4. **Airline personalities (premade core, light proc spice)**  
   - Keep handcrafted majors (Northline → Summit, UPPS → EXFED, Guard).  
   - Add **persona tags**: luxury / business / budget / cargo-night / military-gov.  
   - Optional **random regional filler** airlines (name + color + 1–2 quirks) so the phone isn’t always the same six faces — but story beats stay premade.
5. **Layover hub contracts** — airline pays more to dump transfer pax for N hours.  
   - Upside: captive spend (food/shop/play).  
   - Downside: hall load, wear, missed connections.  
   - **Ban + fine** if happiness/rep dips below threshold while hosting their layover — excellent tension, ship it.
6. **Airline heat meter** — soft score per carrier; bans are temporary (30–90 sim-min) not save-ruining.

**Tier C — day/night & seasons (CEO depth)**

7. **Slot / curfew clock** — city noise vs night freighter money; tower + rail change the politics.
8. **De-ice / winter ops** — seasonal budget line + truck; storms without de-ice = holds/cancels.
9. **Franchise retail** — sign a coffee/duty-free brand; guaranteed spend, brand crisis events.

**Tier D — meta & Steam**

10. **Scenarios** — “Cargo only Kiln”, “IPO in 20 minutes”, “Guard base neighbor”.
11. **AGM / shareholder votes** when public — expand vs dividend vs security spend.
12. **Godot Steam rebuild** — only after Tier A–B loops feel unfair in a fun way, not unfinished.

### Explicit calls on open design questions

- **Premade vs random airlines:** Hybrid. Premade for identity and tutorials; thin procedural regionals for variety. Full random-only dilutes AT3’s “I know who Summit is” fantasy.
- **Layover bans:** Yes — short ban + cash fine + news blurb. Teaches hall quality without deleting the save.
- **Military:** Keep as **host agreement** (not a full player-controlled air force). Occasional tasking missions later (“clear stand 2 for ANG”).
- **Browser vs Godot:** Browser stays the design lab. Godot is the shipping skin once loops are sacred.

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
