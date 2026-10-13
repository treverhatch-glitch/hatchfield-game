# src/features — isolated gameplay modules

Pure TypeScript, no React/Three/sim imports. Each folder exposes an adapter
interface so `sim.ts` and `src/ui` can plug in later without these modules
knowing about them. Everything is deterministic and covered by Vitest
(`npm test`).

| Folder | What it does | Plug-in point |
| --- | --- | --- |
| `notifications/` | Shared non-blocking notification queue (pop-in cards, priorities, choices, default-on-expiry, history). Never pauses the sim. | `NotificationQueue` — UI renders `visible()`, sim calls `tick(now)` and listens with `onResolve` |
| `undo/` | Command-stack undo/redo with grouping, limits and cost refunds | `UndoCommand<S>` + `UndoEconomyAdapter` |
| `reports/` | Weekly / monthly airport reports (on-time %, mood, top complaints, cash in/out, best/worst airline, bottleneck, trends) | `ReportSource` (or feed a `ReportCollector`) + `ReportScheduler.onDayEnd` + `reportNotification` |
| `events/` | Disruption events (storm runway closure, fuel truck breakdown, VIP turnaround, bird strike, staff strike, fog LVP, de-icing) with seeded scheduler, weather hooks, choices and effects | `EventWorld` in, `EventEffect` out; `eventNotification` / `resolveEvent` |
| `ratings/` | Airline satisfaction from punctuality, turnaround, fees, passenger mood; threat-to-leave and more-slots requests | `AirlinePeriodStats` in, `RatingSignal` out; `ratingNotification` |
| `save/` | Versioned save/load with checksum + migrations; compact shareable layout code (layout + branding LogoSpec) | `SaveAdapter<T>`, `KeyValueStore`, `encodeLayout` / `decodeLayout` |
| `settings/` | Accessibility & performance settings (FPS cap, UI scale, colour-blind overlay palettes, reduced motion, high contrast, quality presets, overlay toggles incl. pathfinding — off by default) persisted to localStorage | `SettingsStore` (subscribe), `overlayPalette`, `frameIntervalMs`, `motionScale` |
| `camera/` | Replay/follow camera math: frame-rate-independent damping, chase cam presets (plane / passenger / vehicle), orbit, Catmull-Rom cinematic paths, flyby builder, shake | Plain `{x,y,z}` — pass `THREE.Vector3`s directly |

## Integration steps

1. **One queue.** Create a single `NotificationQueue` in the game root. Call
   `queue.tick(simTimeMs)` from the sim tick. The UI shows `queue.visible()` as
   a small stack in a screen corner (max 3, never centre-screen), with
   `unreadCount()` on a bell. Clicking a card calls `open(id)`; buttons call
   `choose(id, choiceId)`; the × calls `dismiss(id)`. Nothing pauses play.
   Airline contract offers can reuse it with `kind: 'contract'`.
2. **Undo.** Wrap every build/demolish in an `UndoCommand` whose `apply`/`revert`
   call sim mutations; pass `{ charge, refund }` hooked to the sim's cash. Use
   `beginGroup/endGroup` around drag-painting. Bind Ctrl+Z / Ctrl+Shift+Z.
3. **Reports.** Forward sim facts into a `ReportCollector` (flight departed,
   passenger mood sample, complaint, cash ledger line, bottleneck sample). At
   day end call `scheduler.onDayEnd(day)` and push each result with
   `reportNotification(report, dayMs)`. Call `collector.prune(day - 60)` monthly.
4. **Events.** `new EventScheduler(saveSeed)`; call `rollDay(day, world)` once a
   day and `onWeatherChange(day, world)` from the weather system. Push with
   `eventNotification`. In `queue.onResolve`, for `kind === 'event'` apply
   `resolveEvent(payload.defId, choiceId)` to the sim.
5. **Ratings.** Weekly, build `AirlinePeriodStats[]` per airline and call
   `ratings.update(stats)`; push each signal with `ratingNotification`. On
   resolve, apply `RESPONSE_EFFECT[choiceId]` via `ratings.adjust` and the
   matching sim change (fee discount, extra slots, airline leaves after
   repeated ignores).
6. **Save.** Implement `SaveAdapter` in the sim (`version`, `snapshot`,
   `restore`), register migrations as the state shape changes, and use
   `new SaveSlots(localStorage, adapter, migrations)`. For sharing, map terminal
   pieces to `{ t, x, y, r }` and pass the branding `LogoSpec` as `logo`; codes
   look like `HF1.<meta>.<pieces>.<checksum>`.
7. **Settings.** `new SettingsStore()` (uses `localStorage` in the browser).
   Renderer reads `graphics` + `frameIntervalMs`; overlays read
   `overlays.pathfinding` and `overlayPalette(s)`; UI applies `uiScale` and
   `motionScale` (reduced motion). Settings menu calls `store.update(...)`.
8. **Camera.** For replay mode keep a `CameraState`, call
   `followStep(state, target, FOLLOW_PRESETS.plane, dt)` each frame, then
   `camera.position.set(...)` and `camera.lookAt(aim.x, aim.y, aim.z)`. Use
   `samplePath(flybyPath(...), t)` for devlog cinematics; hide UI while
   recording.

## Not yet done
- No UI components or sim wiring (owned by other agents).
- Balance numbers (event odds, rating thresholds, refund rate) are first
  guesses; tune with the balance simulator.
