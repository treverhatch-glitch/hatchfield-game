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

See `DESIGN.md` and `ADDITIONS.md` for the backlog and what already shipped.

New game overwrites the browser save (`apron-save-v11`).

## Loop

1. Buy land → **Starter kit** (or stamp your own field).
2. Answer the phone — majors + light procedural regionals. Each carrier has a **persona** and a **heat** meter.
3. Jet lands → assigned gate → trucks/pax move → money posts. Tower raises inbound capacity.
4. Host a **layover bank** for transfer spend — keep the hall happy or take a short ban + fine.
5. Hall (RCT needs), budgets/weather/crashes, then IPO/HATCH when ready.

## Later

Rebuild this same loop in Godot 4 for a Windows/Steam build. Do not wrap this sketch and ship it as the store product.
