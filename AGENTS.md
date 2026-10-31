# AGENTS.md

Read CLAUDE.md for the full project briefing. Short version for agents (Jules, Codex, etc.):

- **Base branch:** `main` for all work. `cursor/audit-playtest-562d` is retired (stale since Oct 14). The merge captain merges into `main` only after `npm run gate -- --full` passes.
- **Node:** 22 (Vite 8 / TypeScript 6 need Node >= 22.12). `npm run gate` refuses anything older than Node 22.
- **Setup:** `npm ci`
- **Before opening a PR:** run `npm run gate` and paste `test-output/gate/<sha>.md` into the PR body (or `docs/devlog/gate/<sha>.md` when you set `UPDATE_SCREENS=1` / `GATE_LOG=1`). The gate checks Node >= 22, runs `npm ci` (skip with `--no-install`), unpacks art, typechecks, lints, runs Vitest, builds, soaks 30 headless days, runs the perf/people draw-call budget tests, and runs `npm run playtest:bots -- --quick` (Careful persona, 15 days). By default Vitest screenshots and gate reports land under gitignored `test-output/`; set `UPDATE_SCREENS=1` to refresh tracked `docs/screens` goldens, or `GATE_LOG=1` / `UPDATE_SCREENS=1` to write gate reports under `docs/devlog/gate/`.
- **Test screenshots:** Vitest e2e screenshots (ui-audit, taxonomy, info-views, check-in, g1) are written to gitignored `test-output/screens/`, so running tests leaves `docs/screens/` untouched. Do not commit regenerated `docs/screens/**` PNGs; set `UPDATE_SCREENS=1` only when a task explicitly asks you to refresh those committed docs screenshots.
- **Merge captain:** run `npm run gate -- --full` and paste that summary before merging into `main`. `--full` is the 150-day soak and the full bot playtest. If `main` is moving too fast to finish `--full`, a green `npm run gate` can land tooling; re-run `--full` after quieter hours.
- **Do not touch `src/diplomacy`** (draft owned by another workstream).
- Stay inside the files/folder named in your issue. Tunables go in data/config files.
- Keep tasks small: one feature, push when tests pass.
