# Hatchfield: briefing for Grok agents (mirrors CLAUDE.md)
Browser 3D airport tycoon (TypeScript + React 19 + Three.js, Vite, Vitest, oxlint), pre game-engine.
- Trunk: `cursor/audit-playtest-562d`. All PRs target trunk. Branch `grok/<topic>`. One folder/module per task; do not touch other folders.
- Before PR: `npx tsc -b`, `npm test`, `npm run lint` must pass.
- Rules: real meter scale (aircraft slight bump only); UI never blocks the view (CS2 side panels); bottlenecks only from player choices, never batch spawns or arbitrary caps; nothing is free (cost + DAILY upkeep + wear); tunables in data/config files, not logic.
- ENGINE-PORT READINESS: new modules are pure TS (no DOM/Three/React imports), deterministic with a seeded RNG passed in, data in JSON/TS data files, unit-tested. They expose plain functions/types so a later C#/engine port can mirror them.
- NOTE: this local tree is an OLD trunk snapshot. Only add NEW files in your own folder; do not edit existing files. TRUNK_catalog.ts.txt / TRUNK_sim.ts.txt hold current trunk constants/sim for reference.
- Design source: /workspace/hatchfield/OVERNIGHT_PLAN.md and /workspace/hatchfield/*.md. Diplomacy is a DRAFT: do not implement diplomacy.
