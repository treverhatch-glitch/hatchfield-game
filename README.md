# Hatchfield

Browser sketch of a **3D airport tycoon** aimed at Steam later (Godot). The field is an Airport Tycoon 3–style view you orbit from above. The books follow Airport CEO: bags, fuel, catering, and hall rooms only pay when the truck or the passenger actually gets there.

This is the playable loop, not the finished Steam game.

## Play

```bash
npm install
npm run dev
```

Open the printed local URL (port **45217**).

- **Easy grant** — $120,000 and a live starter airport (a jet should inbound)
- **Standard field** — $64,000 empty plot
- Buildings stamp in one click (Airport Tycoon style). Rotate the runway with the Rotate button or `R`
- Left drag pans, right drag orbits, scroll zooms
- Sign a fuel carrier, buy loads, park the farm on pavement or the pump never posts

See `DESIGN.md` for the longer backlog (heavier runways, helicopters, RCT guests, loans).

New game overwrites the browser save (`apron-save-v1`).

## Loop

1. Lay runway, taxiway, stand (and a hall / snack / bag sort / fuel farm as you can afford).
2. Northline inbound. Harbor Air unlocks after a meal is sold and you have two stands.
3. Jet lands → taxis → parks → people and trucks move → money posts for landing, bags, fuel, catering, retail.
4. Skip a shop and you skip that sale. The landing fee stays.

## Later

Rebuild this same loop in Godot 4 for a Windows/Steam build. Do not wrap this sketch and ship it as the store product.
