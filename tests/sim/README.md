# Headless multi-day sim suite

End-to-end scenarios that drive the real `Game` (`src/game/sim.ts`) for several game days with no
browser and no renderer. Tests only: nothing here changes engine code.

## Run it

```bash
npm ci
npx vitest run tests/sim            # whole pack
npx vitest run tests/sim/nightOps   # one scenario
npm test                            # src/ unit tests + this pack
```

`vite.config.ts` includes `tests/sim/**/*.test.ts` next to `src/**/*.test.ts`, so `npm test` runs both.
Files in this folder are not part of the `tsc -b` project (`tsconfig.app.json` only includes `src`).

## Layout

| File | What it covers |
| --- | --- |
| `harness.ts` | Seeded airport builder, `runDays`, metrics, shared assertions |
| `starter7d` | Starter kit for 7 days; seed reproducibility |
| `mixedFleet14d` | Three carriers on one runway for 14 days |
| `heavyJetStress` | Heavy strip, `heavy_pack`, tier-3 hall, widebody carriers |
| `twoTerminals` | A second premade hall and stand on the same field |
| `fuelOutageRecovery` | Empty tank farm holds departures; a fuel buy releases them |
| `payrollShortfall` | Staff on a near-empty bank |
| `litterAndJanitors` | Janitors versus no janitors |
| `landPlotsTax30d` | Extra parcel, daily holding bill, 30 days |
| `inboundRequests30d` | Accept and refuse inbound cards for 30 days |
| `contractsLeadTime` | A newly signed carrier waits for its lead gate |
| `nightOps` | Traffic through the night third of each day |
| `longRun30dNoStuck` | 30 days, no stuck aircraft, bounded cash |

## What every scenario checks (`expectHealthy`)

- No NaN or Infinity in the game's numeric fields, the bank ledger, or live flight poses.
- No lost passengers (`lostPaxCount()`) and no lost bags (`bagsLost`) unless a scenario passes a bound.
- No aircraft stuck in a taxi/pushback/hold phase for more than twice the alert threshold
  (`ALERT_TUNING.stuckSec` / `holdStuckSec`).
- 30-day scenarios also call `expectBoundedGrowth`: cash on day 30 is at most 3x day 20 (base floored at 25k).

## Determinism and speed

- `useSeed(n)` replaces `Math.random` with a Mulberry32 stream for each test and restores it after.
- One tick is `STEP_SEC` (3 s) by default. 14 and 30 day runs use `LONG_STEP_SEC` (10 s) so each test
  stays under `TEST_TIMEOUT_MS` (20 s). Cost scales with ticks, and coarser steps do complete fewer flights.
- Scenarios do not use `describe.concurrent`. They patch the global `Math.random`, so they must not
  interleave within a file. Vitest already runs files in parallel.

## Adding a scenario

1. `buildAirport({ ...options })` for a starter-kit airport, then change the `Game` through its public methods.
2. `runDays(g, n, { onDayStart, onTick })` and assert on the returned `SimMetrics`.
3. If it exposes an engine bug, mark the case `it.fails(...)` with a comment naming the bug, and list it in the PR.
