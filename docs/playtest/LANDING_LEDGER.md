# Landing ledger

Merge-captain pass against `origin/main` at `4bd73e2` (15 Oct 2026). Inventory: 367 remote tips, 242 already reachable from main, 125 tips with commits not in main. Branches were not deleted.

`docs/LANDING_LEDGER.md` is a separate producer queue (play audio, then the building-port P1). This file is the captain's classification of everything still off main.

## Landed on main this pass

| Item | Feature SHA | Gate record on main | Notes |
| --- | --- | --- | --- |
| Day/night sunrise, settings switch | `48ef2888` | `f686f9e2` | Switch stays in `GameSettings.tsx`. A loaded save does not write `dayNightCycle` back into the global setting. |
| Tower III | `6dc29b60` | `446809c8` | Bought from the tower info view (`upgrade-tower-iii`). The old OwnerChrome info panel stays gone. |
| Spotters deck | `b67c52b4` | `6779e61c` | Added beside landmarks and cargo hub II. Stamp is on Landside > Landmarks. |
| Airport Council | `0f006656` | `c17f68ab` | Airlines > Council. Civic spend is `civic_programs` (`331c757d`). |
| Carbon book and Green Pioneer | `b6de09c9` | `4bd73e2f` | CO₂ info view is in the info bar, not a second OwnerChrome panel. |

Also already on main, landed by other agents while this pass was in flight (not replayed):

| Item | SHA | Notes |
| --- | --- | --- |
| Airlines hub tab (PR #86) | `8acaaded` | Relations tab. A parallel port on `cursor/land-airlines-hub-2f8f` was not pushed. |
| Play audio resume (PR #94) | `6fba689` | First canvas or key gesture. |
| Building rounds 4–9 and aircraft pass 5 | `8c0e21d` | Port by the building agent. See `docs/LANDING_LEDGER.md`. |
| Terminal shell culling | `02f4d31` | One shell, interior culled in airport view. |
| Grounded slot-fee refunds | `1dd1eaa` / `afddf1a` | Gate `17b7961`. |
| Weather and night readability | `28f53b7` | Gate `06fc4e0`. |

Quick gates above were green before each fast-forward. The `--full` gate is the last commit after this ledger.

## SUPERSEDED

Main already has the behaviour, or a later port replaced the branch. Tips stay on the remote.

| Branch | Why it stays off the next fast-forward |
| --- | --- |
| `cursor/carbon-tracking-d8b6`, `cursor/tower-iii-d8b6`, `cursor/spotters-deck-d8b6`, `cursor/airport-council-d8b6` | Source PRs. Content is on main via the SHAs above. PR #87 may still show open. |
| `cursor/land-airport-council-2f8f` | Pre-rebase council tip. Main has the rebased gate `c17f68ab`. |
| `cursor/hub-airlines-db11`, `cursor/hub-playtest-db11` | Airlines hub and the dedicate/assign screen are on main (`8acaaded`, AssignPanel). Cherry-picking the dedicate commit would drop the assign screen. PR #89 / #77. |
| `cursor/schedule-ui-design-49d9` | Schedule design is already under `docs/design/schedule-ui`. PR #69 closed. |
| `cursor/stand-upgrades-design-1f19` | `docs/design/STAND_UPGRADES.md` is on main. Patch-equivalent. |
| `cursor/day-night-playtest-4799`, `claude/day-night-cycle-pack6-1883488918373841656`, `pr236`, `tmp/pr236` | Sunrise switch and the sky dome are on main. |
| `cursor/in-game-phone-7d48`, `cursor/service-points-7c46`, `cursor/fast-start-tips-7233`, `cursor/stuck-watchdog-bc99`, `cursor/phase1-feedback-7df2`, `claude/issue-249-achievements-13677513883996795250`, `claude/issue-250-perf-overlay-lod-17011630364752362590`, `claude/alert-actions-6482532934734159270`, `claude/audit-hints-2574178790039750137` | Phone, service points, tips, soak watchdog, feedback, achievements, perf overlay, and alert pan are on main. |
| `cursor/honest-ledger-1810`, `cursor/local-gate-5147` | Wallet ledger and `scripts/gate.mjs` on main are newer. |
| `cursor/ground-traffic-control`, `pr256`, `try236` | `src/atc/groundControl.ts` is on main. |
| `experiment/vehicle-bakeoff` | PR #10, marked do not merge. |
| `building-visuals`, `bv`, `building-visuals-r9`, `hangar-tiers`, `pr258`, `tmp/pr258`, `tmp/pr258merge`, `rescue/building-visuals-abc65b4`, `aircraft-visuals-5`, `rescue/vehicle-visuals-f-33ff1bc` | Ported onto main as `8c0e21d`. Old tips left in place. |
| `terminal-visuals-r4`, `terminal-visuals-r5`, `t4` | Shared terminal shell is on main (`02f4d31`). Older hall rounds were not replayed. |
| `claude/issue-229-*`, `claude/issue-231-*`, `claude/issue-232-*`, `p241`, `p6`, `art/pack6-refs`, `mergetest`, `tmp/pr240`, `fix239`, `m239`, `pr239` | People, airline roster, and quality tiers were redone on main. |
| `claude/finance-pack` era, `carbon-ledger`, bags/economy/flightpath/hall-route edge packs, `issue-153` through `issue-181` tips | Those branch tips are reachable from main (not in the unmerged set). |
| `tmp/pr261merge`, `tmp/pr265merge`, `tmp/pr267merge`, `a5`, `a5b`, `r4`, `tp`, `preview-dist`, `trunk-snapshot`, `grok/*` stacks 700+ behind | Scratch merges and early prototypes. The live sim replaced them. |
| Landside curb traffic (`cursor/landside-traffic-ab4c`) | Already merged. PR #75's open title was the fuel pipeline, which is also on main. |

## NEEDS-WORK

Valuable ideas that are too far behind, or that would fight a landed system. Not fast-forwarded.

| Branch | Why |
| --- | --- |
| `cursor/j36-daynight-cycle-4799` (PR #98) | Still open. It keeps editing `GameSettings.tsx` and `graphicsPrefs.ts` (a noon hold in graphics settings) after the sunrise switch landed. A second store would fight the settings switch. Left for that PR. |
| `claude/finance-screen-18359518024439908719`, `tmp/pr265` | `FinanceScreen` from an older economy panel. Main's wallet and finance card are newer. 404 commits behind. |
| `claude/issue-228-20261014-1515` | Connections, hotels, and stranded passengers as a 3k-line branch. Hub connections on main overlap it. 340 behind. |
| `design/vision-expansion` | Design doc only, 334 behind. |
| `claude/issue-195-*` | Guest traits and terminal pathing from before the hall-nav rewrite. |
| `cursor/art-wire-c08d`, `cursor/art-landing-p1-9acb` | Art-agent work (night glow, art wiring). Not rebased by this captain. |
| `grok/lategame`, `cursor/connectivity-hub-0588`, `cursor/simcore-*`, `cursor/hud-starter-kit-562d`, `head-sim-suite-562d-*`, `cursor/audit-playtest-562d-scripted150-*` | Old trunks and prototypes. The playtest trunk's useful tests are already on main. |

## NEEDS-PORT

None left for this captain. Building rounds 4–9 and aircraft pass 5 were the two skips (agent `bc-eaa413d3`). That port is on main as `8c0e21d`. The old branch tips stay under SUPERSEDED.

## NOT-BUILT

Requested, and still not playable. Research lists exist; the live tree does not import `research_tier4.ts` or `research_tier5.ts` except in content tests.

| Feature | Where it stops |
| --- | --- |
| MARS stands | `mars_stands` in `src/content/research_tier5.ts`. `StandClass` is still S, M, and L. |
| AI stand planner / auto stand allocation | `ai_stand_planner` in that same list. `airside.autoStandAllocation` is not read by the sim. |
| Digital tower | `digital_tower` in `research_tier5.ts` only. |
| Third-runway studies | `third_runway_studies` in `research_tier5.ts` only. |
| ATC approach centre as a placed building | Data row only. Tower III is the live approach upgrade. |
| Research tier 4 and 5 as a buyable desk | Lists are not in the live research tree. |

`docs/MIDLATE_CHECKLIST.md` still says Tower III, Spotters deck, and Airport Council are missing. Those three, plus Green Pioneer, are on main as of the SHAs above. The checklist was not rewritten in this pass.

## Unmerged tips

125 tips. `behind` is commits on main the tip does not contain. Class is the section above.

| Behind | Ahead | Date | Tip | Branch | Subject |
| --- | --- | --- | --- | --- | --- |
| 23 | 18 | 2026-10-15 | `40ceab79` | `cursor/j36-daynight-cycle-4799` | NEEDS-WORK. Graphics noon hold. PR #98. |
| 23 | 3 | 2026-10-15 | `dec4156f` | `cursor/land-airport-council-2f8f` | SUPERSEDED by `c17f68ab`. |
| 41 | 3 | 2026-10-15 | `95f0b760` | `cursor/art-landing-p1-9acb` | LEAVE. Art agent. |
| 83 | 11 | 2026-10-15 | `1cdd7111` | `cursor/day-night-playtest-4799` | SUPERSEDED. |
| 92 | 3 | 2026-10-15 | `393d4b37` | `cursor/hub-playtest-db11` | SUPERSEDED. |
| 105 | 2 | 2026-10-15 | `41cf04dc` | `cursor/hub-airlines-db11` | SUPERSEDED. |
| 159 | 1 | 2026-10-15 | `b5183fc4` | `cursor/schedule-ui-design-49d9` | SUPERSEDED. PR #69. |
| 175 | 1 | 2026-10-15 | `d87141a8` | `cursor/stand-upgrades-design-1f19` | SUPERSEDED. |
| 267 | 4 | 2026-10-14 | `3b846122` | `cursor/local-gate-5147` | SUPERSEDED. |
| 285 | 1 | 2026-10-14 | `0baded30` | `cursor/art-wire-c08d` | LEAVE. Art agent. |
| 290 | 1 | 2026-10-14 | `369b7307` | `cursor/honest-ledger-1810` | SUPERSEDED. |
| 290 | 1 | 2026-10-14 | `84125a0f` | `cursor/in-game-phone-7d48` | SUPERSEDED. |
| 290 | 1 | 2026-10-14 | `c7595766` | `cursor/service-points-7c46` | SUPERSEDED. |
| 294 | 1 | 2026-10-14 | `504407cb` | `cursor/phase1-feedback-7df2` | SUPERSEDED. |
| 294 | 1 | 2026-10-14 | `916a9dc4` | `experiment/vehicle-bakeoff` | SUPERSEDED. PR #10. |
| 294 | 1 | 2026-10-14 | `f263c807` | `cursor/stuck-watchdog-bc99` | SUPERSEDED. |
| 294 | 1 | 2026-10-14 | `fad2f355` | `cursor/fast-start-tips-7233` | SUPERSEDED. |
| 322 | 1 | 2026-10-15 | `315325ca` | `cursor/carbon-tracking-d8b6` | SUPERSEDED by `b6de09c9`. PR #87. |
| 322 | 1 | 2026-10-15 | `8c9cd78e` | `cursor/tower-iii-d8b6` | SUPERSEDED by `6dc29b60`. |
| 322 | 1 | 2026-10-15 | `c1bf7c0c` | `cursor/spotters-deck-d8b6` | SUPERSEDED by `b67c52b4`. PR #84. |
| 322 | 1 | 2026-10-15 | `f58ba3a6` | `cursor/airport-council-d8b6` | SUPERSEDED by `0f006656`. PR #85. |
| 324–340 | 1–3 | 2026-10-14 | various | `tp`, `tmp/pr261merge`, `tmp/pr267merge`, `a5`, `a5b`, `r4` | SUPERSEDED scratch merges. |
| 338–372 | 28–32 | 2026-10-14 | various | `building-visuals-r9`, `hangar-tiers`, `pr258`, `tmp/pr258*` | SUPERSEDED by the building port. |
| 339–340 | 1–38 | 2026-10-14 | various | `fix239`, `m239`, `pr239`, `terminal-visuals-r4`, `terminal-visuals-r5`, `t4` | SUPERSEDED or older terminal rounds. |
| 340 | 1–3 | 2026-10-14 | various | `cursor/ground-traffic-control`, `pr256`, `try236`, `aircraft-visuals-5` | SUPERSEDED. |
| 340 | 1 | 2026-10-14 | `9e5034db` | `claude/issue-228-20261014-1515` | NEEDS-WORK. |
| 396–418 | 1–47 | 2026-10-14 | various | `building-visuals`, `bv`, `tmp/pr252`, issue 229/231/232 stacks, `p6`, `art/pack6-refs` | SUPERSEDED copies. |
| 404 | 2 | 2026-10-14 | `e3f619ea` | `claude/finance-screen-*`, `tmp/pr265` | NEEDS-WORK. |
| 334 | 1 | 2026-10-14 | `a3325450` | `design/vision-expansion` | NEEDS-WORK. Docs only. |
| 689–880 | 1–439 | 2026-10-13/14 | various | `grok/*`, `cursor/simcore-*`, `cursor/hud-starter-kit-562d`, `preview-dist`, `trunk-snapshot`, media clips | NEEDS-PORT was declined. Prototypes, not a replay. |

---

# P1 art landing record

## P1 art landing

Branch `cursor/art-landing-p1-9acb`. Lands after the P0 sound fix (#94) and beside the building port (#92). Those branches' files were not edited.

Pack is stored at full resolution under `public/art/textures/landing/` (textures, terrain, sky). Nothing in the loader resamples those JPEGs.

Wired:

- Runway paint, wet asphalt, and the threshold plate on the runway and apron. Dirt shoulders along the runway edges.
- Seasonal ground: spring and summer use spring grass, autumn uses autumn grass, winter or deep snow uses snow grass. Apron and paved surfaces swap to snow or wet asphalt. Farmland and the river use their own plates.
- Tree and bush sprite sheets as crossed cards. Chainlink on the perimeter fence, with the black holes discarded.
- Dawn, noon, dusk, night, overcast, and storm skies on the dome. The mirror fold is feathered so a non-wrapping panorama does not show a hard seam. Rain and fog use the overcast plate while the sun is up. A storm uses the storm plate. Overnight rain and fog stay on the night plate.
- The noon HDRI hint (`lighting/hdri_hint_noon.jpeg`) is a sun and hemisphere colour reference only. It is not a skybox.
- Terminal glass and the airport-hotel tower use the elevation plates once per face.
- Queue tape on the belt barriers. Carousel belt on the claim carousel.

Interiors: PR #74 is already on main (starter newsagent, second toilet, claim bench). Every terminal prop type is placed in the hall dressing, and that dressing stays visible at every camera distance. Roof cutaway is still distance-only.

Quality: every graphics tier keeps the photo set (skies, foliage, props, colour grade, bloom, contact shadows). Shadow maps still step 1024 / 2048 / 4096 / 8192 so a software GL view can open. People draw-call budget was left as it was.

Gaps still flat: `docs/playtest/ART_GAPS.md`.

Gate, preview, and fast-forward of `main` are recorded below when they finish.

## Gate

Pending.

## Preview

Pending. Deploy target is Cloudflare Pages branch `progress` only.

## Main

Pending.
