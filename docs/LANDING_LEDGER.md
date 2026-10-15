# Landing ledger

Merge priority lives in `docs/playtest/LANDING_LEDGER.md`. This file is the building-port record only.

Order below is the old producer note. A row there is not a license to jump the playtest ledger.

| Priority | Change | Commit | Gate | Preview |
| --- | --- | --- | --- | --- |
| P0 | Resume play audio on the first canvas or key gesture | `6fba6893` | quick, recorded on main before this port | production, not this preview |
| P1 | Building rounds 4–9 (fuel farm, real-size hangars, truck-fit bays, rounded non-terminal buildings) plus aircraft pass 5 logic, with jumbo spawn gated by airline size and relationship growth | `8c0e21d699afefa9c636f4de6fa2751eb63e2584` | quick PASS, 2943 tests, 30-day soak, Careful bot. `docs/devlog/gate/8c0e21d699afefa9c636f4de6fa2751eb63e2584.md` | https://progress.hatchfield.pages.dev (deployment https://f86833a1.hatchfield.pages.dev) |
| P1 | Full-resolution art landing: runway and apron plates, seasonal terrain and foliage, six skies plus the noon light hint, terminal and hotel facades, interior props. Gap list in `docs/playtest/ART_GAPS.md` | `cursor/art-landing-p1-9acb` | quick PASS, 2953 tests, 30-day soak, Careful bot, on `296990215af6`, then rebased. `docs/devlog/gate/296990215af65c3fa3bfb8db0fe8e3aa1a2bda1e.md` | wrangler `--branch progress` did not upload: `CLOUDFLARE_API_TOKEN` unset. Stills in `docs/devlog/media/landing/` |
| P1 | Graphics day/night cycle holds noon, and apron flood pools stay on at 5× | `7a85bce864bfc7de5bc4719f46673a8955e0d01a` | quick, this landing | `progress` after deploy |
| P1 | Fuel-farm depot matches the Gemini render (earth berms, canopy tankers, tire-track decal, painted lanes) and the HUD no longer stacks the climate card, phone, and hints | `9d01bf49768e72ba0e2d57f3077cfc6c82ef635d` | quick PASS on `14ae7aaf` (2977 tests, 30-day soak, Careful bot), then rebased onto `d1051d84`. `docs/devlog/gate/14ae7aaf4d32cb79a60d2204cec12fe1a0569bbc.md` | wrangler `--branch progress` did not upload: `CLOUDFLARE_API_TOKEN` unset. Stills in `docs/devlog/media/fuel-farm/` |
| P1 | Schedule board reads contract windows, buffers, and the offer preview. Board and Timeline dock, clear of Planner and the phone | `ab5953ed` | quick, this landing | `progress` after deploy |
| P1 | Seasonal goals leave the HUD. The status bar keeps `Temperate · Spring`. Current-season missions live on the Airport Council board, and a new season arrives on the phone | `d988e2da155b287d085cd77ccb153b3bc177a29f` | quick PASS, 2986 tests, 30-day soak, Careful bot, then rebased onto `28c5b5d3`. `docs/devlog/gate/d988e2da155b287d085cd77ccb153b3bc177a29f.md` | wrangler `--branch progress` did not upload: `CLOUDFLARE_API_TOKEN` unset |

## P1 notes

- Fresh port onto main. Main’s `skinMaterial` path and Gemini exterior plates stay. The passenger terminal was not edited by this port.
- Aircraft pass 5 (787 nose gear, flaps and slats, engines with spinners) was already on main as `e367f14`. Size class, stand fit, the 45 liveries, turnaround service points, sound hooks, and airline fleet lists are unchanged.
- Spawn rule: a catalog tier of 2 or below never draws wide or jumbo metal. A jumbo such as the A380 stays off the ramp until the relationship reaches Bigger aircraft (tier 4), while a smaller type in that fleet still flies. Tests: `fleet growth gates jumbo spawn` and `schedules a commuter for Bushline and holds Crown’s A380 until the relationship grows`.
- Full-quality meshes and plates. No new LOD downgrade and no new triangle cap was added to force a cheaper model.
- Stills from the preview build: `docs/devlog/media/preview/` (fuel farm, small / wide / jumbo hangars, Bushline commuter beside Crown’s A380). Earlier local stills stay in `docs/devlog/media/buildings-r9/` and `docs/devlog/media/fleet-growth/small-vs-large-fleet.png`.
- The preview serves the gated bundle `assets/index-Bf_ey18M.js`. `wrangler pages deploy` cannot authenticate here without `CLOUDFLARE_API_TOKEN`. The deployment used the direct-upload path in `docs/handoff/MERGE_STATE.md`, on branch `progress`.
