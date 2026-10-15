# Landing ledger

Merge-captain pass against `origin/main` at `4bd73e2` (15 Oct 2026). Inventory: 367 remote tips, 242 already reachable from main, 125 tips with commits not in main. Branches were not deleted.

This file is the merge-priority source of truth. `docs/LANDING_LEDGER.md` keeps the building-port note and defers here. The classification below is the earlier tip inventory; the table in this section wins when they disagree.

Re-check 15 Oct, tip `75e985c5`. PR #98 is on main as `7a85bce8`. PR #99 is on main through `76be176f`. PR #92 is still a draft. PR #10 is never merged.

## Priority order

Status codes: QUEUED · BUILDING · GATE · READY · MERGED · BLOCKED · SUPERSEDED · NEVER.

Land one at a time: rebase onto latest main, green `npm run gate`, fast-forward main, push, then close the PR with the landed SHAs.

| P | Item | Branch / PR | Status | Notes |
| --- | --- | --- | --- | --- |
| P0 | Audio unlock on the first canvas or key gesture | #94 `cursor/audio-play-fix-4b1c` | MERGED | `6fba6893`, gate `01441c86` |
| P1 | Grounded slot fees / frozen-ramp honesty | J40 #97 | MERGED | `1dd1eaa1`, `afddf1a7`, gate `17b79615` |
| P1 | Spotters deck | #84 | MERGED | `b67c52b4`, gate `6779e61c` |
| P1 | Airport Council | #85 | MERGED | `0f006656`, gate `c17f68ab` |
| P1 | Carbon / Green Pioneer | #87 | MERGED | `b6de09c9`, gate `4bd73e2f` |
| P1 | Dead buys (fire bell, bridges, flag, apron light) | J46 `cursor/fitting-honesty-c298` | MERGED | `74580a1b`. Quick gate `e218574e` (2980 tests, 30-day soak, Careful bot) on this patch, then rebased onto the phone routes with no fitting-file change. Bell scales the fine, reputation hit, and drill line. Flag is paint. Extra bridges shorten boarding. The mast is drawn only when bought. |
| P1 | Hub stand lease enforce + Heavy class | J47 `cursor/stand-eligibility-d382` | MERGED | `01317ded`. One stand check (fit, lease, closed, reserved) on assign, swap, pin, and the cycle. A code D hardstand is drawn and placed as code D. An A380 pin on it is refused with a reason. Quick gate `01317ded` (3003 tests, 30-day soak end cash $4,610,482, Careful bot) after the seasonal-missions rebase. Fittings were not edited. |
| P1 | Noon hold when the day/night cycle is off | #98 `cursor/j36-daynight-cycle-4799` | MERGED | `7a85bce8`. One settings switch, under Graphics. Off holds noon, lamps out. A photo hour still wins. The original branch tip was not replayed |
| P1 | Schedule board: contract windows, Board and Timeline | `cursor/schedule-board-9241` | MERGED | `ab5953ed`. Windows, buffers, and the offer preview come from `src/contracts`. List is arrivals and departures. Timeline is by stand. Planner and the phone stay off the sheet. Quick gate, this landing |
| P1 | Passenger wiring: hall forecast on check-in/security cards, guest names + hover tooltip, walker mood into fare happiness, full-detail people, dead `placeholderRoute` removed | `cursor/pax-wiring-3267` | MERGED | `grok/crowd` and `grok/people` are superseded: main already runs paxnav, crowd give-way and `PeopleRenderer`. Wired the real gaps (throughput `securityPlan` / `checkinMix` into live cards, `drainMood` into `HallGuest` happiness). `throughput/bhs`, `throughput/gates`, `crowd/capacity.ts` left unwired on purpose (own bag chain; J47 owns stands). Media in `docs/devlog/media/pax-wire/`. See `docs/PAX_NAV.md` Gate `18a202d5` (3025 tests, soak end cash $4,604,700). Preview deploy handled separately |
| P1 | Timeline polish on the schedule board | #113 `cursor/schedule-timeline-39aa` | MERGED | `a701e5a8`, rebased onto `7a5257d7`. Plain dark sheet, carrier rail, turnaround-length blocks by aircraft size, fictional metal names, red overlap and amber tight gaps, drag that springs back outside the hard band, spring open/close and wheel momentum. Board, filters, contract windows, stand-lease refusals, passenger wiring, and the Ops wallet fold stay. Stills in `docs/devlog/media/schedule-timeline/`. Quick gate PASS on `f4170d90` (777s, Node v22.14.0). 3028 tests passed, 0 failed, 9 skipped (466 files). 30-day soak end cash $4,571,079, stuck 0, 20 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/f4170d90f859f42da5bebe757daaec012255753b.md`. |
| P1 | Service-point concept plates (bag drop, claim, passport) | `cursor/service-prop-plates-567c` | MERGED | `f3ea5f90`, replay of gated `3e28aa18` onto `5866cb78`. Full-res plates under `public/art/textures/concepts/` (2752×1536, no downscale). Bag-drop kiosk screen and fascia, claim overhead board, and passport-booth board show the Gemini studies in the hall. Immigration room plate id is `passport_control` (same file). Kiosk, carousel loop, and booth bank stay on rbox prims and the existing tray tracks. Build-menu glyphs for bag drop, claim carousel, and passport booth. Stills in `docs/devlog/media/service-props/`. Quick gate PASS on `3e28aa18` (842.9s, Node v22.14.0). 3031 tests passed, 0 failed, 9 skipped (467 files). 30-day soak end cash $4,599,080, stuck 0, 40 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/3e28aa1851b5f4886f007a6da64e2fd24b41afa2.md`. Jet bridges, view-budget, and hall capacity were not edited. |
| — | Photographed plates and base-carrier concept liveries | `cursor/livery-plates-fb7c` | MERGED | `c3d09481`, fleet note `2f047616`. Bushline, Crown Pacific, and Zoomjet wear their photographed plates. Siam Breeze and Northstar Cargo resolve plates and have no airline. The five base carriers take palette, wing, and tail decals from the Gemini concepts. None of the eight concepts is concept-only. Zoomjet stays signable and on the 180-seat band. Stills in `docs/devlog/media/liveries/`. Quick gate PASS on `b91969d1` (825.2s, Node v22.14.0). 3035 tests passed, 0 failed, 9 skipped (468 files). 30-day soak end cash $4,612,738, stuck 0, 20 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/b91969d1b6e2cb21066c826d1f203b7fd54d0378.md`. Same patch replayed onto `72436e06`. Jet bridges, view-budget, hall props, and the starter carrier cap were not edited. |
| P1 | Bigger hall and carrier headroom | `cursor/bigger-hall-carriers-b971` | MERGED | `a9221d1b`, pace `d6341999`. Carrier slots follow desks, extra lanes, and the prefab rung. A third carrier needs another desk, a lane, or Prefab II. The offer sheet and the phone say why a letter is refused. Prefab II is in the build menu with its carrier headroom, and on the stands panel. Seed 1, default new game, first check-in red line on day 6 (clock 932, queue 2, 380 nav seconds). `STARTER_CHECKIN_PACE` is 3 after the opening; the check-in red line is 360 nav seconds. Fees and `STARTER_CAPACITY` unchanged. Stills in `docs/devlog/media/bigger-hall/`. Onset note: `docs/playtest/STARTER_BOTTLENECK.md`. Quick gate PASS on `d6341999` (844.2s, Node v22.14.0). 3039 tests passed, 0 failed, 9 skipped (469 files). 30-day soak end cash $4,582,939, stuck 0, 32 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/d6341999d445c1eae082acdbaf3c7e8a2f4b9d1a.md`. Jet bridges, view-budget, and hall service-prop textures were not edited. |
| P1 | Terminal-rooted jet bridges | #114 `cursor/jet-bridge-dock-2da6` | MERGED | `a38ff4f4`, replay of gated `a76a1aef` onto `b5d08bdf`. A bought jet bridge pivots from the terminal facade. `extend` 0 parks the cab on that socket. `extend` 1 docks it on the design door. Starter stands stay bridgeless and board on stairs until Jet bridge is bought. The aircraft mesh does not parent a bridge. Quick gate PASS on `a76a1aef` (1032.8s, Node v22.14.0, npm ci skipped after a clean install on the same tree). 3039 tests passed, 0 failed, 9 skipped (469 files). 30-day soak end cash $4,609,173, stuck 0, 19 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/a76a1aef52b0d7114dfaa1e2bd0fccdb37fc5799.md`. Same patch replayed cleanly onto the bigger-hall tip. Hall headroom, check-in pace, and the traffic audit were not edited. |
| P1 | View budget: full exterior detail, hall shadows, roof transition | #110 `cursor/view-budget-transition-f2da` | MERGED | `4528ba06` on `ee7f114d`. Full aircraft and vehicle meshes at every play zoom. No fps step-down; max-zoom fps is a log only. `PEOPLE_LOD_FULL` crowds stay. Roof sections lift on the way in and drop while walls snap on the way out. Stills in `docs/devlog/media/view-budget/`. Quick gate PASS on `4528ba06` (904s, Node v22.14.0). 3049 tests passed, 0 failed, 9 skipped (472 files). 30-day soak end cash $4,580,234, stuck 0, 32 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/4528ba0692db22c72606ed727564d8c46f0994f1.md`. An earlier rebase hit the menu-walk 360s cap under two workers; that spec passed alone in 293s, and the cap is 600s. Jet bridges, hall props, passenger wiring, and the schedule board were not edited beyond the rebase. |
| P1 | Hall desk and lane upgrades, softer go-arounds, late prices, persona hooks | `cursor/p1-rebalance-6e0b` | MERGED | `5b06e376`. Starter desks stay at 2. A desk or security lane placed in the hall adds capacity, and the bots buy them. Go-arounds divert at 6 passes with a 0.15 Standing hit. Tower III $140k, approach centre $160k, cargo hub II $220k. Command hooks stamp late buildings, cast council votes, commission `atc_approach`, fit Tower III, and start Green Pioneer. Quick gate on `5b06e376` after the seasonal-missions rebase (2996 tests, 30-day soak end cash $4,593,232, Careful 15 days). Report `docs/devlog/gate/5b06e3760cccc443786073926a3366f3601c3e00.md`. Replayed cleanly onto stand-lease `01317ded` as `727accc6`. Preview `npx wrangler pages deploy dist --project-name hatchfield --branch progress` did not upload: Wrangler 4.151.0, `CLOUDFLARE_API_TOKEN` unset. `--branch main` was not used. The 150-day persona rerun was skipped. |
| P2 | Fold Ops wallet into Growth | #109 `cursor/fold-ops-wallet-a945` | MERGED | `b030b2f9`. Quick gate `32e07071` (3012 tests, 30-day soak, Careful bot). One Growth wallet. Operations keep a small research trickle. R&D rooms supply the rest. Saved Ops RP migrates on load. Cold store is Night freight |
| P1 | No operations-research sheet in the UI | `cursor/ops-wallet-honesty-d32e` | MERGED | `e69c3d11`, rebased onto `dc1aa0fd`. Main already had no player-facing sheet name (tooltips, news, phone letters, Manage tabs, research cards, tutorial). No dead sheet branch was left to delete. `opsFold.ts`, `opsWallet()`, and the save migration stay. Research costs and late-buy prices stay. Growth tabs cannot include id `wallet` or label `Ops wallet`. Quick gate PASS on `e69c3d11` (782.5s, Node v22.14.0, npm ci skipped after a clean install on the same tree). 3030 tests passed, 0 failed, 9 skipped (467 files). 30-day soak end cash $4,592,829, stuck 0, 18 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/e69c3d1165822ac960b472cd3bc46c05cc9feedf.md`. |
| P2 | Buildings rounds 4–9 + aircraft pass 5 | #92 draft `cursor/buildings-r9-fuel-hangars-ca46` | BUILDING | Earlier port `8c0e21d6` is on main. The PR is still a draft (`ba10b642` is a merge plus the preview-stills commit). Do not land it until it is ready |
| P2 | Interior editor | `5ac6f43e` | MERGED | Sims-style editor inside the terminal shell. Gate record `75e985c5` (2962 tests, soak end cash $4,619,736). J49 docs are done: `docs/design/INTERIOR_EDITOR.md` and `docs/design/TERMINAL_INTERIOR_BUILD.md` are on main |
| P2 | P1 art (runway, terrain, skies, night lights) | #99 `cursor/art-landing-p1-9acb` | MERGED | On main through `bd8ba671`, `737e92b4`, `03137b2b`, `6fedc5f8`, `20a45987`, gate record `76be176f` |
| P2 | This ledger | J51 | MERGED | This file |
| P2 | Second carrier / FL ceiling | J41 | QUEUED | After the playtest freeze call |
| P2 | Combined stability bot run | J43 | BUILDING | Post-merge bot run |
| P2 | Showcase saves | J44 | QUEUED | After the GPT stack and Sonnet land |
| — | Tower III | #83 | MERGED | `6dc29b60`, gate `446809c8`. Unlock text `b9f7e607` |
| — | Cart-wait + starter fleet | #93 / J37 | MERGED | `120c4c4f`, gate `005e4d39`. 8 bag / 2 catering |
| — | Day/night sunrise + switch | #88 | MERGED | `48ef2888`, gate `f686f9e2` |
| — | Terminal shell + airport cull | #95 | MERGED | `02f4d316`, gate `bf506f52` |
| — | Cargo hub II + cold store | #91 | MERGED | `ca85ba90`, gate `9576a227` |
| — | Visual bug batch | #96 | MERGED | `28f53b73`, gate `06fc4e09` |
| — | Airlines hub tab | #86 | MERGED | `8acaaded` |
| — | Vehicle bake-off | #10 `experiment/vehicle-bakeoff` | NEVER | Obsolete experiment. Do not merge |

### Rules

1. Honesty and bug fixes before new features.
2. Merge one PR at a time: rebase on latest main, green `npm run gate`, fast-forward main, push.
3. New features keep building but slot by priority. They do not jump the queue.
4. Never present renders as in the game unless they are on main.
5. Agents hand off to the merge captain and this ledger. Origin cloud tokens often lack merge scope, so the captain fast-forwards main and closes the PR with the landed SHAs.
6. PR #10 is NEVER.

## Landed on main this pass

| Item | Feature SHA | Gate record on main | Notes |
| --- | --- | --- | --- |
| Day/night sunrise, settings switch | `48ef2888` | `f686f9e2` | Switch stays in `GameSettings.tsx`. A loaded save does not write `dayNightCycle` back into the global setting. |
| Tower III | `6dc29b60` | `446809c8` | Bought from the tower info view (`upgrade-tower-iii`). The old OwnerChrome info panel stays gone. |
| Spotters deck | `b67c52b4` | `6779e61c` | Added beside landmarks and cargo hub II. Stamp is on Landside > Landmarks. |
| Airport Council | `0f006656` | `c17f68ab` | Airlines > Council. Civic spend is `civic_programs` (`331c757d`). |
| Carbon book and Green Pioneer | `b6de09c9` | `4bd73e2f` | CO₂ info view is in the info bar, not a second OwnerChrome panel. |
| Vision expansion design note | `3a37ffa5` | `08b868e2` | `docs/design/VISION_EXPANSION.md`. Proposal only. Approved docs still win where they disagree. Quick gate was recorded for `418a8d6b` before the art-pack rebase. |
| Graphics day/night noon hold (PR #98) | `7a85bce8` | contained in `75e985c5` | Existing settings switch, under Graphics. Off holds noon with lamps out. Flood pools stay on at 5×. No second store. The old branch tip was not replayed. |
| Fitting honesty (J46) | `74580a1b` | `e218574e` | Fire bell, flag, extra jet bridges, and apron light match their cards. No new ledger line. 2980 tests, 30-day soak, Careful bot. Phone-route commits landed during the gate and did not change the fitting files. |
| Schedule board | `ab5953ed` | this landing | Contract windows, buffers, and offer preview. Board and Timeline. Stills in `docs/devlog/media/schedule-board/`. |
| Fold Ops wallet into Growth (PR #109) | `b030b2f9` | `32e07071` | One research pot. The Ops sheet is gone. Operations trickle stays on the Growth wallet; R&D rooms supply the rest. Saved Ops balance migrates once. Cold store is Night freight (`spec-cargo-2`). 3012 tests, 30-day soak end cash $4,572,437, stuck 0, Careful bot. Hall-desk and terminal round 5 rows stay. Rebased onto `e23d1efa`. |
| Schedule timeline polish (PR #113) | `a701e5a8` | `f4170d90` | Replay onto passenger wiring `7a5257d7`. 3028 tests, 30-day soak end cash $4,571,079, stuck 0, 20 recoveries, Careful bot. Passenger wiring and the Ops wallet fold stay. |
| No operations-research sheet in the UI | `e69c3d11` | `e69c3d11` | Confirm after PR #109. Player-facing modules do not name that sheet. Growth manage tabs reject id `wallet` and label `Ops wallet`. `opsFold.ts`, the `opsWallet()` shim, and the save-migration tests stay. No research cost or late-buy price change. 3030 tests, 30-day soak end cash $4,592,829, stuck 0, 18 recoveries, Careful bot. Rebased onto `dc1aa0fd`. |
| Service-point concept plates | `f3ea5f90` | `3e28aa18` | Bag-drop, claim, and passport plates are on the hall props. 3031 tests, 30-day soak end cash $4,599,080, stuck 0, 40 recoveries, Careful bot. Same patch as gated `3e28aa18`, replayed onto `5866cb78`. Stills in `docs/devlog/media/service-props/`. |
| Photographed plates and base-carrier concept liveries | `c3d09481` | `b91969d1` | Fleet note `2f047616`. 3035 tests, 30-day soak end cash $4,612,738, stuck 0, 20 recoveries, Careful bot. Same patch as gated `b91969d1`, replayed onto `72436e06`. Stills in `docs/devlog/media/liveries/`. Live list in `docs/art/LIVERIES.md`. |
| Terminal-rooted jet bridges (PR #114) | `a38ff4f4` | `a76a1aef` | Rotunda on the terminal socket. Starter stands stay bridgeless until Jet bridge is bought. No aircraft-parented bridge mesh. 3039 tests, 30-day soak end cash $4,609,173, stuck 0, 19 recoveries, Careful bot. Same patch as gated `a76a1aef`, replayed onto `b5d08bdf`. |
| View budget and roof beat (PR #110) | `4528ba06` | `4528ba06` | Full exterior detail at every play zoom. No quality step-down and no fps guard. `PEOPLE_LOD_FULL` stays. Roof beat is 1.25s and a click or key skips it. 3049 tests, 30-day soak end cash $4,580,234, stuck 0, 32 recoveries, Careful bot. Rebased onto jet-bridge `ee7f114d`. Stills in `docs/devlog/media/view-budget/`. |

Also already on main, landed by other agents while this pass was in flight (not replayed):

| Item | SHA | Notes |
| --- | --- | --- |
| Airlines hub tab (PR #86) | `8acaaded` | Relations tab. A parallel port on `cursor/land-airlines-hub-2f8f` was not pushed. |
| Play audio resume (PR #94) | `6fba689` | First canvas or key gesture. |
| Building rounds 4–9 and aircraft pass 5 | `8c0e21d` | Earlier port is on main. PR #92 is still a draft. |
| Cart-wait and starter bag fleet (PR #93 / J37) | `120c4c4f` | Gate `005e4d39`. |
| Cargo hub II and cold store (PR #91) | `ca85ba90` | Gate `9576a227`. |
| Interior editor | `5ac6f43e` | Gate record `75e985c5`. |
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
| `experiment/vehicle-bakeoff` | PR #10. NEVER. Obsolete experiment. Do not merge. |
| `cursor/j36-daynight-cycle-4799` | PR #98. Noon hold is on main as `7a85bce8`. The old tip `40ceab79` was not replayed. |
| `cursor/art-landing-p1-9acb` | PR #99. Art pack is on main through `76be176f`. |
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
| `claude/finance-screen-18359518024439908719`, `tmp/pr265` | `FinanceScreen` from an older economy panel. Main's wallet and finance card are newer. 404 commits behind. |
| `claude/issue-228-20261014-1515` | Connections, hotels, and stranded passengers as a 3k-line branch. Hub connections on main overlap it. 340 behind. |
| `claude/issue-195-*` | Guest traits and terminal pathing from before the hall-nav rewrite. |
| `cursor/art-wire-c08d` | Art wiring tip. PR #99's landing pack is already on main. |
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
| 23 | 18 | 2026-10-15 | `40ceab79` | `cursor/j36-daynight-cycle-4799` | SUPERSEDED. Noon hold is `7a85bce8`. PR #98. |
| 23 | 3 | 2026-10-15 | `dec4156f` | `cursor/land-airport-council-2f8f` | SUPERSEDED by `c17f68ab`. |
| 41 | 3 | 2026-10-15 | `95f0b760` | `cursor/art-landing-p1-9acb` | SUPERSEDED. Art pack is on main through `76be176f`. PR #99. |
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
| 294 | 1 | 2026-10-14 | `916a9dc4` | `experiment/vehicle-bakeoff` | NEVER. PR #10. |
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
| 334 | 1 | 2026-10-14 | `a3325450` | `design/vision-expansion` | LANDED as `docs/design/VISION_EXPANSION.md`. |
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
- Night: `window_glow` is the emissive mask on terminal glass and building walls (one copy per face, not a repeating tile). `apron_flood_glow` is the pool under the flood masts, faded at the edges. `nav_light_sprites` are additive billboards on the red, green, white, and beacon lamps. All three stay at 2048.
- Terminal glass and the airport-hotel tower use the elevation plates once per face.
- Queue tape on the belt barriers. Carousel belt on the claim carousel.

Interiors: PR #74 is already on main (starter newsagent, second toilet, claim bench). Every terminal prop type is placed in the hall dressing, and that dressing stays visible at every camera distance. Roof cutaway is still distance-only.

Quality: every graphics tier keeps the photo set (skies, foliage, props, colour grade, bloom, contact shadows). Shadow maps still step 1024 / 2048 / 4096 / 8192 so a software GL view can open. People draw-call budget was left as it was.

Gaps still flat: `docs/playtest/ART_GAPS.md`.

## Gate

Quick PASS on `296990215af6` (781s, Node v22.14.0). 2953 tests passed, 0 failed, 9 skipped (453 files). 30-day soak reached day 30, end cash $4,602,889, stuck 0, 22 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/296990215af65c3fa3bfb8db0fe8e3aa1a2bda1e.md`.

`main` moved twice while that gate ran: first to `4bd73e2f` (carbon tracking), then to `79712692` (captain ledger, shell floors, Tower III copy). The art renderer and `public/art` rebased cleanly both times. The captain's classification above is unchanged.

## Preview

`npx wrangler pages deploy dist --project-name hatchfield --branch progress` did not upload. Wrangler 4.151.0 stopped because `CLOUDFLARE_API_TOKEN` is unset in this environment. `--branch main` was not used.

Stills are from the local dev server of this tree, graphics preset high:

- `docs/devlog/media/landing/runway-close.png`
- `docs/devlog/media/landing/terrain-wide.png`
- `docs/devlog/media/landing/sky-dawn.png`
- `docs/devlog/media/landing/sky-night.png`
- `docs/devlog/media/landing/terminal-exterior.png`
- `docs/devlog/media/landing/interior-props.png`

## Main

Rebased onto `79712692`. The fast-forward push is the commit that records this ledger. If that push is rejected, the branch still holds the green gate and these stills.

---

# P1 fuel farm depot

## Depot and HUD

Branch `cursor/fuel-farm-depot-9acb`. Trever's fuel-farm notes, after the Gemini farm from PR #92 was already on main.

- Tanks sit inside grass earth berms. Two tankers park under a steel loading canopy with black hoses. A ground decal carries tire tracks and stains.
- The flat yellow fuel-tile ring is gone. The pad uses painted lane markings (edge lines, a dashed center, stop bars) on a dark asphalt rectangle.
- Trucks drive one way. `farm_entry` and `farm_exit` are opposite ends of the loading lane. The delivery path enters on one road cell and leaves on another, and the docked tanker faces entry toward exit. Test: `drives the tanker in one gate and out the other`.
- The seasonal goals card is off the main HUD. The status bar keeps a small climate line, `Temperate · Spring`. Current-season missions sit on the Airport Council board as Seasonal missions, with one next-season preview line. A new season arrives as a phone message. The phone stays bottom-left. Hints are a top-left collapsible badge. First Hour stays expanded only while the starter kit is offered, then collapses to a chip.

## Gate

Quick PASS on `14ae7aaf4d32cb79a60d2204cec12fe1a0569bbc` (720.8s, Node v22.14.0). 2977 tests passed, 0 failed, 9 skipped (461 files). 30-day soak reached day 30, end cash $4,601,749, stuck 0, 19 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/14ae7aaf4d32cb79a60d2204cec12fe1a0569bbc.md`.

`main` moved to `d1051d84` (fitting honesty) while that gate ran. The four depot commits rebased cleanly onto it. Tip after the rebase is `9d01bf49`. The captain classification above is unchanged.

## Stills

Local dev server, graphics preset high:

- `docs/devlog/media/fuel-farm/before-hud.png`
- `docs/devlog/media/fuel-farm/before-fuel.png`
- `docs/devlog/media/fuel-farm/after-hud.png`
- `docs/devlog/media/fuel-farm/after-hud-clear.png`
- `docs/devlog/media/fuel-farm/after-fuel.png`

## Preview

`npx wrangler pages deploy dist --project-name hatchfield --branch progress` did not upload. Wrangler 4.151.0 stopped because `CLOUDFLARE_API_TOKEN` is unset in this environment. `--branch main` was not used. The previous progress deployment stays up.

---

# Seasonal missions

Branch `cursor/seasonal-missions-9acb`. Amends the fuel-farm HUD note above.

The seasonal goals card is off the main HUD. The status bar keeps `Temperate · Spring` (region and the live season from `calendar.ts`). The Airport Council board lists Seasonal missions for the current season only, plus one `Next:` preview line. Goals for other seasons stay hidden. When a later season begins, the missions arrive as a phone message from Airport Council. Dismiss clears it. There is no season popup.

Quick PASS on `d988e2da155b287d085cd77ccb153b3bc177a29f` (713.3s, Node v22.14.0). 2986 tests passed, 0 failed, 9 skipped (462 files). 30-day soak reached day 30, end cash $4,559,895, stuck 0, 29 recoveries. Draw-call budgets passed. Careful bots, 15 days, passed. Report: `docs/devlog/gate/d988e2da155b287d085cd77ccb153b3bc177a29f.md`.

`main` moved to `28c5b5d3` (schedule board) after that gate. The missions commit rebased onto it. The schedule-board row above stays.

`npx wrangler pages deploy dist --project-name hatchfield --branch progress` did not upload. Wrangler 4.151.0 stopped because `CLOUDFLARE_API_TOKEN` is unset. `--branch main` was not used.
