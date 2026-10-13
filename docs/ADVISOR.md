# Advisor cards (`src/advisor/`)

Short, actionable cards that diagnose problems from game state. Pure logic, no three.js.
The advisor **only explains** — it never changes sim state, so bottlenecks from player choices are never suppressed. No tutorial gating: cards are optional and dismissible.

## Files
- `types.ts` — `AdvisorSnapshot` (input), `AdvisorCard` (output), `CameraTarget`.
- `rules.ts` — one pure function per problem: security queue growing, bags left behind, fuel low / outage grounding flights, shop out of stock, stand too small, cash burn with days-left forecast, airline standing dropping, catering late, runway hour over capacity.
- `engine.ts` — `Advisor` class: dedupe by `key`, sort by severity, cap (default 3), clear-cooldown (120 s sim, stops flicker), dismiss-cooldown (900 s sim).
- `AdvisorCards.tsx` — small card stack: title, one-line diagnosis, fix, **Show me**, **Details** (numbers live behind the click, per the UI rule), ×.
- `advisor.test.ts` — `npx tsx --test src/advisor/advisor.test.ts` (node:test, no new deps).

## Wiring (terminal agent)
1. Build a snapshot adapter in the sim layer, e.g. `src/sim/advisorSnapshot.ts`, mapping `World` → `AdvisorSnapshot` (all fields optional; fill what exists). Keep a rolling `queueHistory` (one sample per sim minute, last ~6).
2. Hold one `new Advisor()` in the HUD store; call `advisor.update(snapshot)` ~1×/sim-minute, not per frame.
3. Render `<AdvisorCards>` **inside the existing Design Advisor in the left gutter (PR #4)** — as its "Live" section, or below it. It must stay in the gutter and never cover the apron; collapse it when a build menu opens (same as the timetable).
4. `onShowMe(target)` → camera controller fly-to: `stand`/`room`/`runway`/`shop`/`vehicle` use `pos` (or look up by `id`); `panel` opens the named submenu (`finance`, `diplomacy`).
5. `onDismiss(key)` → `advisor.dismiss(key, world.time)`.
6. Optional: let the test bot log active cards as extra signal.
