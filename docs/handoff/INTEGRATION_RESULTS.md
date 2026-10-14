# Integration results — 2026-10-14 (Claude session, issue #228)

Trunk `cursor/audit-playtest-562d` after the merge queue in `CLAUDE_SESSION_PLAN.md` steps 1–4.

| Step | Trunk commit | What |
| --- | --- | --- |
| 1 | `dd3d074` | #227 boarding / ramp crews (supersedes #221) |
| 2 | `1944b73` | #216 physical placement rules (trunk `ci.yml` kept; #216's extra CI steps left out) |
| 3 | `df637af` | #226 apron materials + liveries (supersedes #219, closed) |
| 4 | `304cefc` | #215 terminal materials, pack 1 + pack 4 |
| 5 | — | Main sync / deploy skipped on owner's instruction |

## Step 6 — automated

Run on the GitHub Actions runner (4 cores, 15 GB) at `304cefc`.

- `npx tsc -b`: pass.
- `npm run lint`: pass (pre-existing warnings only).
- `npx vitest run`: 248 files, 1929 passed, 2 skipped.
  - Under full parallel load one long sim test sometimes hits its timeout (`tests/sim/inboundRequests30d.test.ts`, `src/game/contractPacing.test.ts` "eager signer at 1×"). Same class as the known `disruptionBridge` flake: each passes alone (~10 s file), and a full re-run was green.
- `npm run build`: pass. Main chunk `index-*.js` ~2.39 MB (0.72 MB gzip).
- `npm run playthrough:scripted -- --days 5 --no-publish` (Playwright headless shell): reached day 5, 11 flights, 0 lost passengers, 0 lost bags, 0 stuck vehicles, 0 console errors. Findings:
  - medium `stuck-flight`: 12× bushline in `landing` > 2 h (worst 6.0 h, ambient `amb-*`), 1× zoomjet `landing` 2.7 h, 1× zoomjet `board` 3.8 h, 12× bushline `taxi_out` > 2 h.
  - low `unledgered-cash`: 81 cash changes without a ledger line (net −12 665).
  - Earlier committed report (`docs/devlog/SCRIPTED_PLAYTHROUGH_REPORT.md`) already lists `stuck-flight` in `taxi_out` / `servicing` / `board`, so those are not new. `landing` > 2 h for ambient bushline flights was **not** compared against a pre-merge baseline (no second dev server allowed in this job). Worth a look: a candidate cause is #216's placement rules or #227's stand crews holding a runway exit.

## Step 7 — manual / bot checklist

Not run in this session. The checklist needs eyes on a running game (or `tests/e2e-bot/bot.mjs` against a background Vite dev server), and this job is not allowed to keep a background dev server up. Covered indirectly by unit tests where noted.

| Item | Status |
| --- | --- |
| Start menu flyover → starter kit → first flight | scripted playthrough reached first flights; title logo covered by `menu.test.tsx` |
| Boarding by bridge / stairs / bus | unit tests only (#227 `paxFlow`, bridges) |
| Bags on belt loader | unit tests only; scripted run 0 lost bags |
| Catering, cleaning, GPU, pushback + wing walker | unit tests only |
| Esc pause, key rebind, gamepad | unit tests only (`src/input`, `PauseMenu`) |
| Sound sliders / mute | not checked |
| Low / Med / High | not checked visually; terminal textures now size from `graphicsQuality()` |
| Day/night + winter snow | not checked visually |
| Terminal walkers at 1× / 3× / 5× | not checked visually |
| Overlapping placement rejected (#216) | `worldRules.test.ts` passes |
| Liveries on all five airlines | not checked visually |
| Terminal terrazzo / carpet / logos | `pack4.test.ts` passes; not checked visually |

Merge notes worth eyeballing in the first manual pass:

- Vehicles are instanced now (#226). Night headlights read light proxies built from each frame's vehicle instances. The baggage-tug / belt-loader bag bed from the old per-vehicle meshes is gone (cargo shows only on trucks).
- Terminal (#215 on #224): ordinary room labels stay in the shared sign atlas; gate boards (with airline marks) and check-in / security wayfinding boards are separate planes named `gate-sign` / `wayfinding-sign`. Desk instancing draws granite counter tops; counter logo slots go to the airline logo meshes.
- Glass partitions use #215's 0.9 opacity for the textured curtain wall.
