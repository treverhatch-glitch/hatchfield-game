# Hatchfield — briefing for Claude

## What this is
Hatchfield is a browser-based 3D airport tycoon (Airport Tycoon 3-style loop), pre game-engine.
Stack: TypeScript + React 19 + Three.js, built with Vite, Tailwind v4, tested with Vitest, linted with oxlint.

## Branches & PRs
- Trunk (integration) branch: `cursor/audit-playtest-562d`. **All PRs target `cursor/audit-playtest-562d`**, not `main`.
- Name your branch `claude/<topic>` (e.g. `claude/fees-panel`).
- One folder/module per task. Do not touch folders owned by other workstreams unless the task says so.

## Before opening a PR
- `npm ci`
- `npx tsc -b` (type-check; `npm run build` also runs it)
- `npm test` (vitest run)
- `npm run lint` (oxlint)
All must pass. Summarize what changed and how it was tested in the PR body.

## Design rules (non-negotiable)
- Realistic meter scale: everything is in real meters; only aircraft get a slight visual size bump.
- UI never blocks the view: Cities: Skylines 2 style side panels/overlays, no blocking modals.
- Bottlenecks come only from player choices (capacity, staffing, layout), never from fake/batch spawns or arbitrary caps.
- Nothing is free: every building/service has a cost and daily upkeep; equipment has wear.
- Keep tunable numbers in config/data files, not hard-coded in logic.

## Docs
- Master Plan: https://docs.google.com/document/d/1i3H7T908zgfJWdP2Dom9oJ_qT5ZgcSoyI5e6izCqiYk
- Overnight Action Plan: https://docs.google.com/document/d/1hpYfgNamRK18VRqHE0K9NxOROIeI8YVMx71fzXSrZCM
- In-repo design docs: `docs/` folder.

## Usage limits
Claude usage is limited (5-hour window). Keep each task bounded. If a task is running long,
stop, push what is working, and post a summary of what's done and what remains.
