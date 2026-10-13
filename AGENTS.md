# AGENTS.md

Read CLAUDE.md for the full project briefing. Short version for agents (Jules, Codex, etc.):

- **Base branch:** `cursor/audit-playtest-562d`. Branch from it and open PRs into it, never `main` (main is far behind).
- **Node:** 22 (Vite 8 / TypeScript 6 need Node >= 22.12).
- **Setup:** `npm ci`
- **Before opening a PR:** `npx tsc -b && npm test && npm run lint` must all pass.
- **Do not touch `src/diplomacy`** (draft owned by another workstream).
- Stay inside the files/folder named in your issue. Tunables go in data/config files.
- Keep tasks small: one feature, push when tests pass.
