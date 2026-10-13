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
6. After the first takeoff, watch for **airline field asks** (police, hangar, hotel…) — bonus if you beat the clock
7. **Independent parking** asks (not airlines) — host for a fee; they request leave later; auto tower or manual Release before the ~20h window burns

**Standard field** is the leaner empty-plot challenge. **Continue field** resumes the browser save.

Night pax hold until you research **Night bank**. Storms hurt less after **De-ice ops**. Bags trucks run shed→plane→claim; fuel bowsers load at the farm; line MX walks from the hangar.

**Money:** Standard leaves ~$7k after city + starter kit — take the loan for air, then **pay it down**; interest scales if you carry it. Ops payroll climbs with field load (airlines / stands / turns), so mid and late game still pinch when you expand.

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
- Flight planner (day strip + night column, ETA drag, stand pin), N-strip inbound banks
- Stand S / M / L stamps · de-ice pad + glycol trucks in storm/fog
- Multi-terminal jetways (`T1·G2·M`), landside hotels / car parks
- Research: night bank → de-ice → stand classes → heavy pack (A380 / An-124) → military ramp (C-5M)
- Emergencies: weather divert, firefighting plane refuel / refuel+MX
- Guard host on a hangar-side mil ramp (not pax gates)

**Landside:** stamp **inn / business / resort** hotels (outside buildings), **four car parks** (small lot, large lot, multi-level garage, underground) each with **Short/Long** term toggle, **bus curb**, and **rail station** (after City rail). Inside the hall, **airside day rooms** keep layover pax spending. Guests pick arrival modes by airline persona — missing curb/lots/hotel angers them and cuts demand. **Money is passenger-driven:** buildings charge fixed expenses every ~30s; empty stamps bleed. Fees only when pax actually use hotels/lots/bus/rail/amenities.

**Hall:** 3D orbit view (drag / zoom). Flow is **doors → info/check-in → security choke → airside**. Premade halls ship with security; player shells without it invite smuggling threats. Apron keeps simulating while you’re inside (and vice versa). Guests are RCT-style wallets + prefs.

**Build UI:** Cities: Skylines-style chrome — bottom bar (Apron/Hall, Pause/1x/3x, ticker, cash + Economy/Budget/Research/Airlines/Planner/Services). Menus peek collapsed and **slide up on hover or click**. Build categories (Pavement / Stands / Terminal / Ops / Landside / Bulldoze) sit above the bar. Contracts and asks arrive as **stacked letters on the right** — hover/click to read, Sign/Decline inside; unread letters expire.

Browser save key: `apron-save-v24`. New game overwrites it.

## Verify

```bash
npx tsx scripts/playthrough-wake.mts   # title → kit → sign → 3x → continue
npx tsx scripts/soak-full.mts
```

See `ADDITIONS.md` for the backlog and what shipped overnight.
