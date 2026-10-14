# AGENTS.md

Read CLAUDE.md for the full project briefing. Short version for agents (Jules, Codex, etc.):

- **Base branch:** `cursor/audit-playtest-562d` for feature work that is still landing on the playtest trunk. The merge captain fast-forwards `main` only after `npm run gate -- --full` passes.
- **Node:** 22 (Vite 8 / TypeScript 6 need Node >= 22.12). `npm run gate` refuses anything older than Node 22.
- **Setup:** `npm ci`
- **Before opening a PR:** run `npm run gate` and paste `docs/devlog/gate/<sha>.md` into the PR body. The gate checks Node >= 22, runs `npm ci` (skip with `--no-install`), unpacks art, typechecks, lints, runs Vitest, builds, soaks 30 headless days, runs the perf/people draw-call budget tests, and runs `npm run playtest:bots -- --quick` (Careful persona, 15 days).
- **Merge captain:** run `npm run gate -- --full` and paste that summary before fast-forwarding `main`. `--full` is the 150-day soak and the full bot playtest.
- **Do not touch `src/diplomacy`** (draft owned by another workstream).
- Stay inside the files/folder named in your issue. Tunables go in data/config files.
- Keep tasks small: one feature, push when tests pass.
