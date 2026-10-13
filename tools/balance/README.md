# Terminal economy balance simulator

Headless TypeScript sim of the Hall economy: a prefab terminal hits its check-in, security,
bag and boarding limits as traffic grows, and three upgrade strategies (greedy, cheapest,
balanced) compete. Doesn't touch `src/game/sim.ts` or the UI.

```bash
npx tsx tools/balance/run.ts            # 240 days -> tools/balance/out/
npx tsx tools/balance/run.ts 365 /tmp/x  # custom days / output dir
npx vitest run tools/balance            # core math tests
```

Outputs: `out/REPORT.md` (strategy comparison, per-item ROI, payback days, dominant/useless
items, suggested tweaks, pax-fee sensitivity), `out/items.csv`, `out/daily.csv`.

- `config.ts`: item data mirrored from docs/TERMINAL_ITEMS.md (Hall items are not in
  `src/game/catalog.ts` yet), plus proposed unlock levels and wear rates; airframe seats and bags from
  `src/game/airframes.ts`; `FIELD_LEVEL_XP` from catalog.ts. Once Slice B adds the real catalog,
  replace `ITEMS` with an adapter over it.
- `model.ts`: pure math (capacity, wear, bag share, happiness, growth, payback).
- `strategies.ts`: day loop + strategies. `analysis.ts`: per-item ROI and ban-value runs.
- The $14/departing-pax fee is an assumption; see the sensitivity table.
