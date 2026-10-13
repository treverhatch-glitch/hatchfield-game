# Hatchfield — Problems

Honest gaps. Fix or accept with eyes open.

## Traffic & pathfinding — status

| Layer | What works | What’s weak |
| --- | --- | --- |
| **Plane-side** | A* on apron tiles; pushback/taxi; multi-strip; hold queue; congestion slows nearby movers | No dedicated service lanes; no collision avoidance (slowdown only); long A* on busy fields can hitch; no runway crossing rules |
| **Pax apron** | Jetway / bus / walk modes; walkers spawn and share congestion | Walkers are thin capsules; bus is one depot; no bus capacity / schedule; remote stands don’t cut fees hard enough when walking |
| **Hall** | Landside→security→airside graph; capped BFS; needs + wallets; visible capsules | Graph is fixed (furnish toggles nodes, not walls); no real queues at security; max 80 guests; capsules aren’t “people” fantasy yet |

**Verdict:** Players *can* strategize layouts (taxi necks, jetway vs remote, security choke, missing WC), but the feedback is still soft. Congestion is a speed tax, not a gridlock story. Hall layout skill is “which rooms exist,” not “how you shaped the corridor.”

## Product gaps (why it can feel “done after first landing”)

1. **Belt / zone skill missing** — CEO’s hour-ten depth. Without belts or intl cuts, midgame is more contracts + more stands, not harder puzzles.
2. **Growth silhouette thin** — second hall exists, but the airport doesn’t *look* like it leveled up.
3. **Scenario vacuum** — sandbox + letters + IPO; no timed “win this city” arc.
4. **Franchise / brand retail shallow** — heat perks exist; signable shop brands don’t.
5. **Readability** — congestion and walk vs jetway aren’t always obvious without reading news.

## Technical / UX problems

- Dual WebGL canvases (apron + hall) tax weak GPUs; 5x drops shadows to help.
- Letter Sign clicks can race HUD re-renders (timer ticks); force-click works in tests.
- Starter kit / Loan live inside Economy panel — easy to miss for new players.
- Freeflow build parked; grid will feel dated next to CS2 expectations.
- Save key `apron-save-v24` — migrations are ad hoc.

## Balance smells (retest often)

- Easy start can feel rich after kit; Standard is meant to force the loan.
- Payroll field-load multiplier must keep midgame from snowballing.
- Holding forever / reserved stands — watchdog exists; watch for regressions.
- Hall miss headlines need rate limits or the ticker screams.

## Open design questions (decided)

| Question | Call |
| --- | --- |
| Premade vs random airlines | Hybrid — premade identity + thin proc regionals |
| Layover bans | Yes — short ban + fine + news |
| Military | Host agreement, not player air force |
| Browser vs Godot | Browser lab until Waves A–B sacred |
| Freeflow | P2.5 after grid loops solid |

## Definition of “stuck”

If a player can stamp a starter, ignore Hall forever, never think about taxi layout, and still print money at 5x — we’re failing layout strategy. Use that as the regression test for new features.
