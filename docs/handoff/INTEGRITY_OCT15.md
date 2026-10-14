# Repo integrity — 15 Oct 2026 (issue #228)

Checked 2026-10-15 ICT against `main` `50ce0c1dc1ae46d76276b1b20d32b84156a6e989` ("Hand bags, cargo, passengers and fuel from socket to socket.").

## What #228 was

The only in-repo record is `docs/handoff/INTEGRATION_RESULTS.md`, titled "Integration results — 2026-10-14 (Claude session, issue #228)". That session followed `docs/handoff/CLAUDE_SESSION_PLAN.md`: merge the playtest queue onto trunk `cursor/audit-playtest-562d`, run the automated pass, and wire pack 6 skies. `git log --grep=228` has no commit that names the issue. The session wrote its own results file and stopped after step 9.

`origin/claude/issue-228-20261014-1515` is a different tip. Its only commit that is not on `main` is `9e5034db4cd2f41748036cbebacb30a9a32650de` ("feat(connections): transfers, layovers, stranded pax and airport hotels"). That branch is not the integration session and it is not on `main`.

## What was checked

Each delivery commit from the results note is an ancestor of `50ce0c1`:

| Commit | Subject | On main |
| --- | --- | --- |
| `dd3d074d4f34ad5585d02aefc61c19988f6803ed` | Merge boarding and ramp crews (#227) | yes |
| `1944b73825ffafb4acc2f8792c907592f809f388` | Merge physical placement rules (#216) | yes |
| `df637af285890c97da71a2cfb9c25719e033dd65` | Merge apron materials and airline liveries (#226, supersedes #219) | yes |
| `304cefc61f6871b5f5de2819428f6bb9c78c224b` | Merge terminal materials, pack 1 and pack 4 (#215) | yes |
| `642305fff093554728bf42d4f02ab657db000e96` | Bring pack 6 skies (dawn, noon, dusk, night) | yes |
| `f05693b01e079dab2f8577993e87f80e5f18ed10` | Wire pack 6 sky panoramas into the day/night dome | yes |
| `9a65d9690cb3eba2ec6d505e1e5d5e5aaf67c14d` | Note skies and the session stop point | yes |

Signatures still in the tree at `50ce0c1`:

- Boarding: `src/ramp/paxFlow.ts` exports `PaxMode` `bridge` / `stairs` / `bus`. `src/render/aircraft/bridges.ts` is present.
- Placement: `src/game/worldRules.ts` exports `placementReason`. `src/game/worldRules.test.ts` still calls it.
- Skies: `public/textures/sky/sky_dawn.jpg` (58,323 bytes), `sky_noon.jpg` (92,718), `sky_dusk.jpg` (107,312), `sky_night.jpg` (227,396). `src/render/world/dayNight.ts` still exports `SKY_PHOTOS` and `SKY_PHOTO_FADES`. `src/render/world/dayNight.test.ts` walks those fades.
- The results note itself is still at `docs/handoff/INTEGRATION_RESULTS.md`.

Trunk reached `main` after that note. The first sync commit above `9a65d96` is `88b8fd3` ("Sync playtest trunk to main"). `main` has moved on through `50ce0c1` (phone, bot playtesters, turnaround sockets, bag/cargo/fuel handoff). Nothing in that range reverts the files above.

`.github/workflows/ci.yml` is still the workflow from `39df452` (checkout, Node 22, `npm ci`, `tsc -b`, lint, test, build). It is not a substitute for a local gate: GitHub is suspended, so that workflow does not run.

## Recheck after main moved

`main` advanced to `816456ecd004fa335dd6b7eb491f4b3cf1231ee6` before this note landed. Those four commits (`e7a8ce4` staffed service points, `b0a2e30` Wave 3 relations, `c9e16fd` bot lab furnishing, `816456e` terminal/vehicle/airline art) sit on top of `50ce0c1`. `50ce0c1` and `f05693b` are still ancestors. `src/ramp/paxFlow.ts` and `public/textures/sky/sky_noon.jpg` are still in the tree. The verdict below does not change.

## Verdict

The changes #228 recorded are on `main`. The merge commits, the sky photos, the day/night wiring, boarding modes, and placement rules are still in the tree at `50ce0c1`. This was a presence check (`git merge-base --is-ancestor` plus the files above). It is not a replay of the 14 Oct visual checklist.

## Gaps

Left open by the session itself ("stopped after step 9"), and still open:

- Step 7, the manual/bot checklist, was not run. Sound sliders, Low/Med/High, day/night and snow, terminal walkers at 1×/3×/5×, and liveries were not looked at. No later handoff closes that list.
- Step 10, passenger and crew palettes from `ref_passengers.jpg` / `ref_crew_uniforms.jpg`, was not done. Those filenames are not referenced under `src/`. Later people work (`80f87a2`, #241) is a shared body, not that palette pass.
- Step 11, #215 loose ends (exterior gate sign board, cropped desk logos), was not done in the session.
- Step 12, pack 3 ground/vehicle textures, was not done. The plan said to do it only if the assets were provided.
- The automated numbers in the results note (248 files, 1929 passed, 2 skipped, at `304cefc`) were not re-run after the sync to `main`. `main` has many commits since then, so that count is not a current result.
- `9e5034d` on `origin/claude/issue-228-20261014-1515` (connections and hotels) is not on `main`. It is not part of the integration session.
