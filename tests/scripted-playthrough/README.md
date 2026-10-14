# Scripted playthrough (money / ops anomaly auditor)

Plays the real game in headless Chromium like a new player, then audits what happened.
It never edits game code: it drives the dev build through `window.__hatch` (dev-only, see `src/App.tsx`)
and the same `data-testid` selectors as `tests/e2e-bot/bot.mjs`.

## Run

```sh
npm run playthrough:scripted -- --days 30        # starts Vite itself
node tests/scripted-playthrough/playthrough.mjs --url http://127.0.0.1:5173/ --days 150
node tests/scripted-playthrough/playthrough.mjs --resume --days 150
```

The repo already had a `playthrough` script (`scripts/playthrough-wake.mts`), so this one is named
`playthrough:scripted` instead of overwriting it.

| Flag | Meaning |
|---|---|
| `--days N` | game days to run (default 150; 1 game day = 180 sim seconds) |
| `--resume` | continue from `out/log.json` and the saved game in `out/profile` (needs the title screen's Continue) |
| `--url URL` | use a running dev server instead of starting Vite |
| `--render` | keep the render loop running (default: `requestAnimationFrame` is stubbed after setup and the script ticks the sim itself, so there is almost no rendering) |
| `--max-minutes M` | stop cleanly after M wall minutes and report the days reached |
| `--stuck-hours H` | stuck-flight threshold in game hours (default 2) |
| `--no-publish` | do not copy checkpoints / screenshots / report under `docs/devlog` |
| `--report FILE` | report path (default `docs/devlog/SCRIPTED_PLAYTHROUGH_REPORT.md`) |

Exit code is 0 with no findings, 1 otherwise. A findings table is printed at the end.

## Flow

1. Start Vite (or use `--url`), open the game, clear storage.
2. New game from the title screen, Passenger start (sandbox is checked and forced off if needed).
3. Economy tab, starter kit button (falls back to `buildStarterKit()` and records a gap if the button is missing).
4. Sign Bushline and Zoomjet (`acceptNegotiation()`, falling back to `acceptOffer()`).
5. Take a loan, buy a Souvenirs room (the shop), try a research purchase (retried every 5 days until one works).
6. Run to `--days` at speed 5, polling every 30 sim seconds.

## What is logged and checked

The script wraps `earn`, `spend` and `charge` on the game instance, so every money line carries cash before/after,
amount, label, caller method, game time and the scripted action it belongs to. Cash that moves without a line is logged as
`untracked` (summed per game hour). Flights are tracked by phase change; trucks by position.
All checks live in `checks.mjs` as pure functions over that log:

- NaN / Infinity money, negative revenue, negative prices
- `$0` / `$1` fees: the live fee card, every `cost`/`price`/`fee`/`sign` number exported from `src/game/catalog.ts`, and each posted line
- double-spend: same spend/charge label and amount twice in one scripted action or at the same sim instant
- stuck flights: one phase for more than 2 game hours (resting `parked` is ignored; see `CONFIG.restPhases`)
- fleet vs contract: flights from an airline with no signed contract, and a signed contract that schedules no flight within 4 game days
- console errors and page errors
- script gaps: any step that could not run through its intended UI path becomes a finding, never a silent skip
- unledgered cash: cash changes with no earn/spend/charge line (low severity, grouped)

Tunables are in `CONFIG` (`checks.mjs`) and `TUNE` (`playthrough.mjs`).

## Output

- `out/` (gitignored): `run.log`, `log.json` (full log, used by `--resume`), `checkpoint-dayNNN.json` every 5 game days, `dayNNN.png` every 10, `findings.json`, `report.md`, `cash-curve.svg`
- `docs/devlog/scripted150/` small copy of the checkpoints, `docs/devlog/media/scripted150/` screenshots and cash curve, plus the report.
  These are copied after the browser closes: Vite watches the repo and full-reloads the page when a file appears under it.
  If a run is killed, `out/` still holds everything; copy it by hand.

If the page reloads mid-run the script logs a gap, reloads the last saved game and continues.

## Unit tests

`vite.config.ts` only collects `src/**/*.test.ts`, so these have their own config:

```sh
npx vitest run -c tests/scripted-playthrough/vitest.config.mts
```

Fixtures cover a $0 fee, a $1 fee, NaN cash, a duplicate charge, a stuck flight and a contract mismatch, plus a clean log with zero findings.
