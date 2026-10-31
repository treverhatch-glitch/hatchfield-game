# Hatchfield — briefing for Claude

## What this is
Hatchfield is a browser-based 3D airport tycoon (Airport Tycoon 3-style loop), pre game-engine.
Stack: TypeScript + React 19 + Three.js, built with Vite, Tailwind v4, tested with Vitest, linted with oxlint.

## Branches & PRs
- Trunk (integration) branch: `main`. **All PRs target `main`.** `cursor/audit-playtest-562d` is retired (stale since Oct 14); never base work on it.
- Name your branch `claude/<topic>` (e.g. `claude/fees-panel`).
- One folder/module per task. Do not touch folders owned by other workstreams unless the task says so.

## Before opening a PR
Run `npm run gate` and paste `docs/devlog/gate/<sha>.md` into the PR body.

The gate checks Node >= 22 (Vitest 5 does not run on Node 20), then `npm ci` (skip with `--no-install`), unpack-art, `tsc -b`, oxlint, `vitest run`, `vite build`, a 30-day headless soak, the perf/people draw-call budget tests, and `npm run playtest:bots -- --quick` (Careful persona, 15 days only). Summarize what changed in the PR body along with that gate summary.

## Merging to main
The merge captain runs `npm run gate -- --full` and pastes that summary before merging a PR into `main`. `--full` runs the 150-day soak and the full bot playtest (every persona, then the browser smoke). Do not merge into `main` on a failing gate. If `main` is moving too fast to finish `--full`, a green `npm run gate` is enough to land tooling; re-run `--full` after quieter hours.

## Design rules (non-negotiable)
- Realistic meter scale: everything is in real meters; only aircraft get a slight visual size bump.
- UI never blocks the view: Cities: Skylines 2 style side panels/overlays, no blocking modals.
- Bottlenecks come only from player choices (capacity, staffing, layout), never from fake/batch spawns or arbitrary caps.
- Nothing is free: every building/service has a cost and daily upkeep; equipment has wear.
- Keep tunable numbers in config/data files, not hard-coded in logic.

## Docs
- Master Plan: [private doc]
- Overnight Action Plan: [private doc]
- In-repo design docs: `docs/` folder.

## Usage limits
Claude usage is limited (5-hour window). Keep each task bounded. If a task is running long,
stop, push what is working, and post a summary of what's done and what remains.
