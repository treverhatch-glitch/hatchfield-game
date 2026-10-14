# Merge handoff — 2026-10-14

Trunk is `cursor/audit-playtest-562d`. All playtest PRs target that branch, never `main`.
This file is the stop point for the merge agent. Do not start new features.
Do not merge drafts. Do not merge #15. Do not post `@claude`. Do not force-push trunk or main.

## Trunk tip

Feature merge already on this branch, before this handoff file:

- `#225` slower walks: `b3740e79600c5b47e59314b7c17bd1a6bf5d899a`
  ("Merge slower terminal walks (#225)")

The commit that adds this file is the trunk tip. Fill the SHA below once `git rev-parse HEAD` is known, then leave it.

- Trunk SHA: `PENDING`

`main` cannot be checked out in `/workspace` (it is already checked out at `/tmp/main-sync`).
Sync with `git -C /tmp/main-sync merge --no-ff`, not a fast-forward. Main's sync commits are not on trunk.

## Already merged (do not re-merge)

Newest first. Parents are the feature commits; the `Merge …` lines are the trunk merges.

| PR | What | Trunk commit |
| --- | --- | --- |
| #225 | Slower terminal walks (1x / 3x / 5x) | `b3740e7` |
| #223 | Pause sheet, rebindable controls, gamepad | `144dbf5` |
| #224 | FPS: batched room interior, hall canvas stays unmounted until Terminal view | `22d6827` |
| #220 | Playable terminal inside Terminal view | `ea453c0` |
| #217 | Sim-clock day/night and winter snow | `efa2cce` |
| #218 | Lighting, bloom, graphics quality setting | `69493be` |
| #214 | CC0 sound and Settings mix | `6db8af2` |
| #213 | Title screen on a live apron flyover | `5e26478` |
| #209 | Nine-room terminal interior | `6854f03` |

Earlier on the same trunk: walking passengers (#206 plus the cherry-picked arrivals from #207), living interior, paxnav, takeoff climb, HUD/Hall. Leave those alone.

`#223` is **merged**. It was still listed as open in the wind-down note. Do not open or merge it again.

`#225` is **merged on this tip**. GitHub may still show the PR open until this push lands. Do not merge the branch a second time.

## Still open — merge order

Skip anything that is still a draft. Suggested order once each PR is marked ready and CI is green. One PR at a time. Rebase onto current trunk, keep both sides of every conflict.

1. **#227 boarding** — ready, not draft, CI had succeeded, `mergeStateStatus` DIRTY. Branch `cursor/boarding-ramp-crews-1829` at `ddaa779`. This is the next PR. It is a superset of #221 (same crew files, plus `src/ramp/paxFlow.ts`, `src/render/aircraft/bridges.ts`, boarding media). Merge #227. Do not also merge #221.
2. **#216 physical rules** — DRAFT, DIRTY. Branch `cursor/world-collision-0750` at `51eeab9`. Wait until it is marked ready.
3. **#221 ground crew** — DRAFT, DIRTY. Branch `cursor/crew-refuel-steps-1829` at `40804ce`. Skip if #227 lands; #227 already contains this crew work.
4. **#219 visual materials** — DRAFT, DIRTY. Branch `cursor/visual-round1-materials-81f6` at `745e5c0`.
5. **#226 livery art** — DRAFT, DIRTY. Branch `cursor/livery-art-81f6` at `84abf9c`. Not in the original list. It repeats #219's render files and adds airline livery jpgs. Merge #219 first, or take #226 instead of #219. Do not merge both blindly.
6. **#215 terminal materials** — DRAFT. Branch `cursor/terminal-materials-8919` at `1229f28`. Do this after the world.ts visual PRs. It also touches `TitleScreen.tsx`.
7. **Item pictures** — no open PR with that title at the time of this handoff. Pack 4 logos and `TitleScreen.tsx` live on draft #215. If a menu-agent PR appears, merge it after #215 when both touch the title screen, and keep the live flyover from #213 (`MenuFlyover` stays off during play).

Leave these alone: #15 (catering, not draft, CI was failing, previously skipped), and the old drafts #4 #5 #6 #9 #10 #14 #16 #17 #21 #36 #37 #39 #43 #46 #93.

## Conflicts and gotchas

Hot files: `src/render/world.ts`, `src/game/sim.ts`, `src/ui/Field.tsx`, `src/render/world/render.ts`, `src/render/hallRooms.ts`, `src/render/world/dayNight.ts`.

- **#227 / #221:** both edit `src/render/world.ts`, `src/game/sim.ts`, `src/game/cateringBridge.ts`. Keep #224's room batching and `markGraphicsPreset`, #223's input map, and #225's walk scales. #227 wins over #221.
- **#216:** `src/game/sim.ts` and `src/ui/Field.tsx`. Keep `HALL_NAV_TUNING` (`navSecPerClockSec: 10`, `departLeadScale: 360`, `unknownLeadClockSec: 40`) and `MAX_SPAWNS_PER_SEC = 4` from #225. Keep `inputMap.onPress` for `system.graphics` in `Field.tsx`. Keep the audio imports (`releaseApronAudio`, `syncApronAudio`).
- **#219 / #226:** `src/render/world.ts` and `src/render/world/render.ts`. Keep `graphicsQuality()` / `chooseGraphicsQuality()` / `applyGraphicsQuality`. Do not restore a second `pickQuality` / `GFX_KEY`. Keep day/night: `applyDayNight` is pure, `World.setDayNight` stores the control, airfield keeps both the bloom halo and the glow split.
- **#215:** `hallRooms.ts`, `hallWorld.ts`, `world/terminal.ts`, `hallCamera.ts`, `TitleScreen.tsx`, `world.ts`. #224 merged full-height room walls into one mesh and unmounts the hall canvas until Terminal view, then keeps it warm. Do not put the per-wall instancing back as the steady state. Hanging signs share one atlas. Low preset drops `backdrop-filter` via `html[data-gfx='low']`.
- **#223 (already in):** one action map in `src/input/`. Pause sheet is Resume, Save, Load, Settings, Quit. Esc closes it; the first Esc cancels an active build tool; photo mode and follow still take the first Esc. Clock stops; the chosen speed is left as it was. Quit returns to the title without deleting the save. Sound sliders and Low/Medium/High graphics live in `GameSettings` inside `src/ui/PauseMenu.tsx`. F8 is action `system.graphics`, handled in `Field.tsx`, not a raw key listener.
- **#225 (already in):** overlay queue/walk speeds in `guestMotion.ts` scale with `navSecPerClockSec / 30`, so the apron picture and the terminal walk stay in step. Game speed is already inside the sim step. Tests that locked the old 30 / 120 scales were updated (`hallNav.test.ts`, `showup.edge.test.ts`, `guestMotion.test.ts`).
- **Sound + graphics:** both must stay. Mute, master, and the buses live with the graphics radios and the hints toggle.
- **History scrub:** before every push, `git fetch origin` and rebase onto the new tip. Never push a commit whose ancestry includes `myhatchtag@gmail.com`. The check `git log --format='%ae %ce' origin/cursor/audit-playtest-562d..HEAD | grep -i gmail` must print nothing. Do not merge or push `claude/issue-207-20261014-0542` (pre-scrub, no common history). The arrivals port is already on trunk as `f62c94e` by `claude[bot]`.
- **CI flake:** `src/game/disruptionBridge.test.ts` "stays quiet on a starter field" often times out at 5000ms under parallel GitHub load. The same SHA frequently has one SUCCESS run and one FAILURE run. Locally the file passes in about 2s. Do not treat that single timeout as a logic failure when a sibling run on the same SHA succeeded and a local re-run passes.
- **Heavy bot:** `tests/e2e-bot/bot.mjs`, Vite dev server (`window.__hatch` is dev-only), Chrome `/usr/bin/google-chrome` with SwiftShader. Floor for a normal wake: min FPS 15, 0 lost passengers, 0 lost bags. This VM often cannot hit 15 even on trunk (typical min about 13) when dozens of other Vite servers are resident. `#223` on a quieter moment of this same VM was min 18, 0 lost, 0 bags. `#224` once measured min 3 and was merged anyway under an explicit wrap-up order. `#225` on this wind-down measured fps samples `[1, 6, 8]`, lost passengers 0, lost bags 0, missed 0. The host was at about 14Gi of 15Gi used. Re-run the bot on a quieter machine before calling that a real FPS regression. Do not revert #225 for that sample. Known non-blocking findings: "Jumbo pillar was not ready", "A380 never arrived".
- **GitHub:** `gh` is read-only here. Merge with `git merge` and `git push`, not `gh pr merge`. `gh issue close` returns "Resource not accessible by integration". Do not retry. Closing keywords on a trunk merge do not close issues; they only fire if they land on the default branch. Main sync message is exactly `Sync playtest trunk to main`.
- **Do not restyle** the info-view chip row, OwnerChrome, or the first-hour coach (#180 / #182).
- **Do not touch** `src/diplomacy` unless the task says so.
- Pre-existing oxlint warnings (Finance, AirportBrandingScreen, LandScreen, App, audio/engine, and a few scripts) stay. Do not fix them in a merge.

## Local verification already done for #225

On `b3740e7` plus this handoff:

- `npx tsc -b` passed.
- `npx vitest run` on `hallNav`, `dayOneCrowd`, `terminal`, `showup.edge`, `guestMotion`: 30 passed.
- `npm run lint` passed with the pre-existing warnings only.
- Full `npm test` was not re-run. A previous full run on this VM was OOM-killed (15.6 GB) with two e2e failures that were crashes, not assertion failures.

GitHub Actions on the pushed trunk is still the gate. The disruptionBridge flake above applies.

## Deploy steps

Production is https://hatchfield.pages.dev. Project `hatchfield`, Cloudflare account `55d968a547d6754395831adc593275c6`. Direct upload. Wrangler `pages deploy` fails here without `CLOUDFLARE_API_TOKEN`. Do not deploy through GitHub Actions.

1. `npm run build` in `/workspace` (runs `tsc -b` and Vite). Dist is `/workspace/dist`.
2. Fetch a Pages upload token: `GET /accounts/55d968a547d6754395831adc593275c6/pages/projects/hatchfield/upload-token`. Write the JWT to `/tmp/pages.jwt`. Do not paste the JWT into chat, commits, or this file.
3. `node /tmp/pages-upload.mjs`. It blake3-hashes base64 contents plus the extension, uploads missing assets, and writes `/tmp/pages-manifest.json`. Keys are `/${relativePath}`.
4. `rm -f /tmp/pages.jwt`.
5. Multipart POST `/accounts/55d968a547d6754395831adc593275c6/pages/projects/hatchfield/deployments` with form fields `manifest` (the JSON string), `branch=main`, `commit_hash` = the full **main** sync SHA, `commit_message` = `Sync playtest trunk to main`, `commit_dirty=false`.
6. Poll the deployment until the latest stage `deploy` is `success`.
7. `curl https://hatchfield.pages.dev/` and `cmp` the live `/assets/index-*.js` against `/workspace/dist`. Record the bundle file name.

## Main sync

```bash
git fetch origin cursor/audit-playtest-562d
git -C /tmp/main-sync fetch origin main
git -C /tmp/main-sync merge --no-ff origin/cursor/audit-playtest-562d -m "Sync playtest trunk to main"
git -C /tmp/main-sync diff origin/cursor/audit-playtest-562d -- .github/workflows/claude.yml   # must be empty
test -f /tmp/main-sync/.github/workflows/claude.yml
git -C /tmp/main-sync log --format='%ae %ce' origin/main..HEAD | grep -i gmail   # must print nothing
git -C /tmp/main-sync push origin main
```

No force-push. `claude.yml` must stay on both branches.

Last production deploy before this wind-down served `assets/index-BGxtKhlP.js` from main `40910f81d6279073873285211a71c13c907a7414` (trunk `144dbf5`, pause menu, no #225 yet).
