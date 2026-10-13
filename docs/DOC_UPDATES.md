# DOC_UPDATES: paste-ready additions for the Hatchfield repo docs
Source of truth for this content: docs/DESIGN_PASS.md (copy DESIGN_PASS.md, TERMINAL_ITEMS.md, PLAYER_FEEDBACK.md and LOGISTICS_VISUALS.md into docs/ first).

## VISION.md: add the section "Late game & expansions"
```
## Late game & expansions
- Finale = Hub status + Landmark mega-terminal (waterfall dome / garden atrium / starfish plan) + optional IPO. See DESIGN_PASS §8.
- Manufacturer partnership (fictional Aerion / Boreal) is an optional FL6+ fork: deliver parts cargo → unlock PRESTIGE airframes only. Base airframes stay Field-Level gated. DESIGN_PASS §8.
- Spaceport = EXPANSION, not base finale. One teaser research node only. DESIGN_PASS §9.
- Construction: planning tab + scaled build time; first hour instant; materials supply is a Hardcore toggle (OFF). DESIGN_PASS §2.
```

## DESIGN.md: add "Player vocabulary v2" (replaces the vocabulary table) and "Guest AI"
```
## Player vocabulary v2
(paste the table from DESIGN_PASS §10; never show code names: heat→Standing/On-time, bowser→Fuel truck, ULD→Cargo container, landside/airside→Before/After security, A-CDM→Flight schedule, MCT→Connection time, PFC→Passenger fee)

## Guest AI (Sawyer rule)
- Route search counts hall JUNCTIONS only. Budget 5; +2 near signage/FIDS; +2 with "map" (business); staff 8; exit-seeking 7 (8 when lost). Sources in DESIGN_PASS §1.
- Lost = thought icon → -Happiness at 60 s → missed board at 180 s → airline Standing hit.
- Unreachable exit/gate ALWAYS raises an alert pin (no silent loops).
- Passenger types + sub-personas: DESIGN_PASS §1 table. Each airline tier has a mix (DESIGN_PASS §5).
```

## REAL_OPS.md: add "Fuel", "Road chain", "Bags v2"
```
## Fuel
- A320 ≈ 23,859 L usable; 777-300ER ≈ 171,176 L (verify). Refuellers 5k–65k L; 20k L truck ≈ 1,000 L/min; hydrant dispensers ≈ 2,500–4,000 L/min. URLs: DESIGN_PASS §3.
- Game: Small fuel truck 20k L @1,000 L/min (start), Large 40k L @1,300 (FL3), Hydrant (FL5). Fuel farm tanks 500k L; warn at 25%.
- Supply: spot truck / contract convoy / rail tank cars (FL4) / pipeline (FL6) / bulk buy on price dips.
- Scheduling: weekly forecast → auto-order; next-2h job queue by departure time.

## Road chain
City road → Guard post (vehicle checkpoint, 20 s/truck) → landside service road → fuel farm / catering / cargo shed / bag hall → airside gate → apron roads → stand. Blocked = alert with cause.

## Bags v2
Outbound: check-in → belt → screening → bag sorting (pile per flight) → dolly train → stand.
Inbound: hold → dolly → bag hall → claim (first bag ~10 min, last ≤25 min target).
Transfer: hold → transfer sort → outbound pile; connection-time check; miss = rush bag / lost bag.
Bags are BATCHES per flight (no per-suitcase agents). See LOGISTICS_VISUALS.md for visuals.
```

## PROGRESSION.md: add "Field Level + Research" and "Airline & cargo ladders"
```
## Field Level + Research
- Field Level 1–10 (CS milestones style) from Field XP (pax + cargo) and Field Rating. Each FL unlocks a parcel, an airline tier, items, a loan size.
- Research = style choices beside FL: branches Passenger comfort / Ops efficiency / Cargo / Safety / Green. Node needs min FL AND points.

## Airline ladder (T1–T5) and Cargo ladder
(paste the tables from DESIGN_PASS §5: unlocks, pax mix, rival airlines, Standing 82+ perks incl. exclusive lounge (T3), premium island (T4), Hub status (T5))
Competition: signing a rival in the same tier = small Standing dip for the other; exclusives pay more.
```

## ECONOMY.md: add "Who earns what (real-world grounded)"
```
## Who earns what
- Airlines keep checked/overweight bag fees (AAAE: >$1B in Q1 2017). Airports earn landing/parking/gate fees, passenger facility charges (US PFC $1–$4.50, collected by airlines, held in trust for the airport), rents/concessions, handling where provided. URLs: DESIGN_PASS §4.
- Hatchfield cash sources: landing, gate, Passenger fee, handling (bags/GSE), concession rent + revenue share, parking, fuel margin.
- Bag performance feeds Standing, not cash. Premium-heavy airlines pay higher handling fees but expect more.
- Fuel: buy price index fluctuates; margin per litre on uplift; bulk-buy option.
- Construction: Rush = +50% cost for half the time.
```

## IDEAS.md: append
```
## From DESIGN_PASS (Oct 2026)
(paste DESIGN_PASS §12, ideas 1–12) + cargo ideas §6 + emergencies/military list §7 + special buildings (pilot training facility, MRO hangar, fire training ground, museum, hotel).
Parked: Spaceport (expansion, §9), materials supply (Hardcore toggle).
```

## BUILD.md: replace the "Next" section with the roadmap
```
## Roadmap (from DESIGN_PASS §11)
P0 Stabilise: Prompt 1 bugs, sim tests, perf budget (1,500 pax agents, 150 vehicles, 10 Hz sim).
P1 Terminal interior MVP: 12 items in TERMINAL_ITEMS.md; passenger types; junction-budget pathing; signage.
P2 Info views (queues/lost/bags) + thoughts panel.
P3 Slice 2: guard post + city trucks + fuel farm/fuel trucks + catering visuals (LOGISTICS_VISUALS.md).
P4 Cargo start path: warehouse, ULD build-up, night bank.
P5 Airline tiers T1–T3 + competition + perks.
P6 Planning tab + build time + contractor vans (instant first hour).
P7 Emergencies pack + landside (car park, taxi, train).
P8 T4–T5, passport/international, transfer.
P9 Manufacturer fork, Landmarks, IPO.
Later: Spaceport DLC, Godot port.
Each slice: one prompt, a "done when" line, a playtest before the next.
```
