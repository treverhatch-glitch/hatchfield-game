# Hatchfield

Browser sketch of a **3D airport tycoon** aimed at Steam later (Godot). The field is an Airport Tycoon 3–style view you orbit from above. The books follow Airport CEO: bags, fuel, catering, and hall rooms only pay when the truck or the passenger actually gets there.

This is the playable loop, not the finished Steam game.

## Play

```bash
npm install
npm run dev
```

Open the printed local URL (port **45217**).

- **Easy grant** — cash + live starter airport (a jet should inbound)
- **Standard field** — leaner empty plot
- Buildings stamp in one click (Airport Tycoon style). Rotate the runway with the Rotate button or `R`
- Left drag pans, right drag orbits, scroll zooms
- Sign a fuel carrier, buy loads, park the farm on pavement or the pump never posts

See `DESIGN.md` and `ADDITIONS.md` for the backlog and what already shipped.

New game overwrites the browser save (`apron-save-v19`).

## Loop

1. Buy land → **Starter kit** (or stamp your own field).
2. Answer the phone — majors + procedural regionals. Each carrier has a **persona**, **heat**, and can unlock **rewards** or **abandon**.
3. Jet lands → assigned gate → trucks/pax move → money posts. Tower raises inbound capacity.
4. Use the **Flight planner** (day strip, pull/bump ETA, stand preference) — auto bank or manual.
5. Host a **layover** → clear it at high heat for a **Hub plaque** (denser slots + brand lounge).
6. Earn **research points** from turnarounds → unlock night bank, de-ice, stand classes, heavy metal (A380 / An-124 / C-5).
7. Answer **emergency asks** (weather divert / firefighter tanker) and **GA parking** requests.
8. Grow landside — **hotel**, short/long **car parks**, city rail — for passive income and denser pax.
9. Furnish the hall (food, lounge, golf, waterfall, gaming…) then IPO/HATCH when ready.

## Later

Rebuild this same loop in Godot 4 for a Windows/Steam build. Do not wrap this sketch and ship it as the store product. Still open before a serious port: secure zones, staffed desks, multi-terminal pathfinding, baggage-belt realism, and a longer playtest pass.
