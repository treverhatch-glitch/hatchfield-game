# Hatchfield

Browser sketch of a **3D airport tycoon** (Airport Tycoon 3 field + Airport CEO books). Orbit the apron, stamp pavement, sign carriers, and make money only when trucks and passengers actually finish their jobs. Steam / Godot comes later — this is the playable loop.

## Run

```bash
npm install
npm run dev
```

Open **[http://127.0.0.1:45217](http://127.0.0.1:45217)** (or the URL Vite prints).

### Morning path (about 2 minutes)

1. **Easy grant** → **Riverside City plot**
2. Follow the **First hour** checklist (bottom-left) — or just hit yellow **Starter kit**
3. **Sign** Northline when they call
4. Hit **3x** and watch the first jet land → gate → trucks → takeoff
5. Optional: **Hall** to walk the terminal; stamp a **Hangar** + hardstand later for Guard / military

**Standard field** is the leaner empty-plot challenge. **Continue field** resumes the browser save.

### Controls

| Input | Action |
| --- | --- |
| Left drag | Pan |
| Right drag | Orbit |
| Scroll | Zoom |
| `R` | Rotate runway / piece |
| `H` / Esc | Hall ↔ Apron |
| Click terminal tile | Enter that hall |

## What’s in

- Personas, heat, rewards / abandon, layovers → Hub plaques
- Flight planner (pull / bump / runway prefs), N-strip inbound banks
- Multi-terminal jetways (`T1·G2`), landside hotel / car parks
- Research: night bank → de-ice → stand classes → heavy pack (A380 / An-124) → military ramp (C-5M)
- Emergencies: weather divert, firefighting plane refuel / refuel+MX
- Guard host on a hangar-side mil ramp (not pax gates)

Browser save key: `apron-save-v21`. New game overwrites it.

## Verify

```bash
npx tsx scripts/playthrough-wake.mts   # title → kit → sign → 3x → continue
npx tsx scripts/soak-full.mts
```

See `ADDITIONS.md` for the backlog and what shipped overnight.
