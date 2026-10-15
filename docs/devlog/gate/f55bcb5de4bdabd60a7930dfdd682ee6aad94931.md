# Gate pass `f55bcb5de4bd`

- Mode: quick
- Commit: `f55bcb5de4bdabd60a7930dfdd682ee6aad94931`
- Tree: dirty — 50 uncommitted path(s): docs/screens/checkin/desk-harbor.png, docs/screens/checkin/desk-northline.png, docs/screens/g1/cart-docked.png, docs/screens/g1/out-of-stock.png, docs/screens/info-views/bays.png, docs/screens/info-views/fuel.png, docs/screens/info-views/power.png, docs/screens/info-views/queues.png, …
- Node: v22.14.0
- Started: 2026-10-15T16:03:50.182Z
- Finished: 2026-10-15T16:21:26.537Z
- Wall: 1056.4s

| Step | Result | Seconds | Detail |
| --- | --- | ---: | --- |
| node | pass | 0 | v22.14.0 (>= 22.12) |
| npm-ci | pass | 2.3 |  |
| unpack-art | pass | 0 |  |
| tsc | pass | 16 |  |
| oxlint | pass | 0.7 |  |
| vitest | pass | 963.2 | 3060 passed, 0 failed, 9 skipped (477 files) |
| vite-build | pass | 3.7 |  |
| soak | pass | 43 | 30 days, end cash $4,601,678, stuck 0, recoveries 22 |
| draw-budgets | pass | 0.8 | 26 passed, 0 failed, 0 skipped (6 files) |
| playtest-bots | pass | 26.6 | 1 passed, 0 failed, 0 skipped (1 files) |

## Tests

477 files (471 passed, 0 failed). 3060 tests passed, 0 failed, 9 skipped (3069 total).

## Soak

- Days requested: 30
- Day reached: 30
- End cash: $4,601,678
- Still stuck: 0
- Recoveries: 22
- Heap growth after warmup: 0.1074

## Result

PASS
