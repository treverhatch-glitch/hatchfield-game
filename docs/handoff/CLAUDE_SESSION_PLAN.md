# Claude session plan — one 5-hour session

Read first: `docs/handoff/MERGE_STATE.md` (whole file, especially the addendum and "Conflicts and gotchas"), `docs/handoff/cursor/visual-round1-materials-81f6.md`, and on branch `cursor/terminal-materials-8919`: `docs/handoff/cursor/terminal-materials-8919.md`.

Rules: one commit per step, push after each so the session can stop anytime. Trunk is `cursor/audit-playtest-562d` (never target `main` for features). No force-push. Keep `.github/workflows/claude.yml`. Do not touch `src/diplomacy`. Before each push: `npx tsc -b && npm run lint && npx vitest run <touched areas>`. The `disruptionBridge` timeout is a known flake.

## (a) Merge queue — ~2h

| # | Step | Est. | Notes |
| --- | --- | --- | --- |
| 1 | Merge #227 into trunk | 25m | Conflict only in `src/render/world.ts`; keep #224 batching, #223 input map, #225 walk scales. Close #221 as superseded. |
| 2 | Merge #216 | 15m | `src/ui/Field.tsx`: keep `inputMap.onPress('system.graphics')`, audio imports, #225 constants. |
| 3 | Merge #226 (contains #219) | 35m | `world.ts`, `world/render.ts`: keep trunk quality + day/night API; add kerbs, road tex, liveries, vehicles. Close #219. |
| 4 | Merge #215 | 45m | Six conflicts. Keep #224 single wall mesh + hall canvas unmount, #213 live title flyover with pack4 logo `<img>`, `html[data-gfx='low']` rule. |
| 5 | Main sync (`Sync playtest trunk to main`, `--no-ff`) | 5m | Deploy is done by the user/bot (needs Cloudflare token, not in Actions). |

## (b) Integration test pass — ~1h

6. `npm test` full, `npm run build`, `npm run playthrough:scripted`. Fix only real breakages, one commit each.
7. Manual/bot checklist, write results to `docs/handoff/INTEGRATION_RESULTS.md`: start menu flyover → starter kit → first flight; boarding by bridge/stairs/bus; bags on belt loader; catering, cleaning, GPU, pushback + wing walker; Esc pause (Resume/Save/Load/Settings/Quit) and key rebind + gamepad; sound sliders/mute; Low/Med/High; day/night + winter snow; Terminal view walkers at 1x/3x/5x (no lost passengers/bags); overlapping placement rejected (#216); liveries on all five airlines; terminal terrazzo/carpet/logos.

## (c) Art wiring — remaining time (~1.5h)

8. Bring pack6 skies only: copy `public/art/refs/pack6/skies/*.jpg` from `art/pack6-refs` into `public/textures/sky/` (do NOT merge the `_pack6_b64` folder or the renders). 
9. Sky: equirect texture on `SkyDome`, crossfade dawn/noon/dusk/night from sim hour in `world/dayNight.ts`; procedural fallback on Low.
10. Passenger + crew palettes from `ref_passengers.jpg` / `ref_crew_uniforms.jpg` (hex constants, keep no-orange day-one crowd from #225).
11. #215 loose ends 1–2 (exterior gate sign board, cropped desk logos) if time.
12. Pack 3 ground/vehicle textures (in `/workspace/hatchfield/assets/pack3/picks/` on the bot box, or Drive) — only if provided in the issue.

Stop point at any step: push, and append "stopped after step N" to `docs/handoff/INTEGRATION_RESULTS.md`.
