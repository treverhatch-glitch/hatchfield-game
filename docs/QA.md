# QA bot (tests/e2e-bot)

A Playwright bot that plays Hatchfield headlessly and turns what it sees into findings.

## Run

```bash
npm ci && npx playwright install chromium
npx vite --host 127.0.0.1 --port 5173 &          # dev server: window.__hatch is dev-only
node tests/e2e-bot/bot.mjs --url http://127.0.0.1:5173/ --label trunk --scenario mixed --days 6
node tests/e2e-bot/bot.mjs --url http://127.0.0.1:5173/ --label trunk --scenario heavy --days 4
```

Flags: `--out <dir>` (default `/workspace/qa/<label>-<scenario>`), `--fps-floor <n>` (default 12),
`--video 0` to skip recording. Output: `result.json`, numbered screenshots, `run.webm`.

## What the bot does

1. Title → **New game** → **Passenger start** → Economy → **Starter kit** (prefab terminal I) through the real UI.
2. Through `window.__hatch`: adds a 20-cell heavy runway and taxi spine, places a **second prefab terminal**
   (`placePremade`, goes through construction), a Stand L, hangar/cargo/police/helipad, buys
   `night_bank, deice, stand_class, heavy_pack, mil_ramp`, signs the Guard agreement, and signs
   4 passenger + 2 cargo carriers through the normal `acceptOffer` path.
3. Sets 5× and advances the sim in 30 in-game-second chunks (`tick(0.25)`), yielding wall time between chunks
   so the renderer, FPS probe and video keep running. One in-game day = 180 s of clock.
4. Each chunk it adds timetable slots, accepts offers and GA parking, and rolls military, air-ambulance and
   helicopter spawns. Once per day it **forces an A380 arrival**.
5. Screenshots: title, setup, each new day, first A380 on the ground, first time there are 6+ live flights, hall, end.

### Fleet mix

`pickAircraftKind` is wrapped so slots follow a movement-weighted mix. Each new jet's airframe is then
re-rolled **within its own kind** (the stand was already sized for that kind).

| Scenario | Kinds (pax/cargo slots) | Inside kind |
|---|---|---|
| mixed (mid-size airport) | narrowbody 60%, regional 24% (incl. ATR 72 turboprop), widebody 10%, freighter 6% | A320neo/737-800/A321 · E175/CRJ700/ATR72 · 787/A350/**A380 15%** · 767F/757F/747-8F/An-124 |
| heavy (stress) | widebody 45%, freighter 30%, narrowbody 20%, regional 5%, 3 slots per chunk | **A380 55%** · 747-8F 40%, An-124 35% |

Military (C-130, C-17, KC-135, F-15, C-5), GA/bizjet (Citation, PC-12), ambulance/firefighting
(CL-415, AT-802) and helicopters (AW139, S-76) come from the game's own spawners.

## Assertions → findings

| Check | Severity | How |
|---|---|---|
| Console / page errors, tick throws | high / critical | `pageerror`, `console.error`, try/catch around `tick` |
| NaN money or stats | critical | `cash, reputation, loanBalance, researchPoints` must be finite |
| Lost passengers in prefabs | high | `lostPaxCount()` must stay 0 |
| Missed flights | low/medium | `missedFlights` (expected only when `hallOverloaded`) |
| Outbound bags short at takeoff | medium | `bagsDeposited < bagUnits` at taxi-out/takeoff on pax flights |
| Stuck flight | high (medium if airborne) | phase timer over a per-phase limit (e.g. servicing 700 s, taxi 240–300 s) |
| Stuck vehicle | high | truck motionless > 240 game-s while not dwelling and not on patrol |
| FPS floor | medium | rAF rate sampled at 5×, compared to `--fps-floor` |
| A380 never arrived | medium | forced once a day |

Each finding carries repro steps and an aircraft class. `result.json.byClass` gives spawned/departed/stuck/
bag-short counts per class (regional, turboprop, narrowbody, widebody, heavy, freighter, military,
bizjet/GA, helicopter, special).

## Caveats

- FPS numbers come from SwiftShader (a CPU renderer) in a headless container. Use them only to compare runs;
  a real GPU is much faster.
- The bag ledger check is a heuristic on `bagsDeposited`, and the sim moves bags in aggregate units.
- Branches that only add isolated modules (audio, branding, features, flow, airlines, cargo) don't change
  the running game, so their bot run is the same as trunk's.
