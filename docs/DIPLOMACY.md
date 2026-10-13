# Airline Diplomacy V2

Pure, deterministic TypeScript in `src/diplomacy/`. No React, Three.js or `sim.ts` imports. It builds on `src/airlines` by imports only (`AirportCapabilities`, `ContractTerms`, `AirlineTier`, `FlightEvent`, `DEFAULT_AIRLINES`, `meetsRequirements`) and does not edit it.

Spec: `AIRLINE_DIPLOMACY_V2` with the "Decisions (Oct 13)" list in section 16, which overrides older text.

## What it does

| Area | Rule |
| --- | --- |
| Standing | Scale -100..+100. `S = P + sum(M) + T`, clamped. |
| P (performance) | EMA of turnaround grades, half-life 30 days, A..F = +40, +20, 0, -20, -40. Excused flights (weather, force majeure) count as C. |
| M (modifiers) | Linear-decay list with source, label and duration. Same-kind stacking is 1, 0.5, 0.25. Shown to the player as at most 6 lines. |
| T (traits) | Trait and agenda bias, capped at +-10. |
| Bands | Hostile < -60, Cold, Neutral (+-20), Warm, Partner > 60. A band is lost only 5 points past its edge (hysteresis). |
| Share class | Major (> 20% of traffic): effects x1.5, one extra demand slot. Minor (< 5%): no demands, no perks. |
| Era reset | On a tier-up, modifiers collapse to 30% for 24 months. |
| Early safety | Tier 1 airlines cannot leave in the first two game-years. |
| Money, not Clout | Every action costs money (`host.spend`). There is no second currency. Favours (max 3, 5-year expiry) and Leverage are earned, not bought. |

### Demands and promises
Pressure per interest is `weight (0.5, 0.3, 0.2) x gap(metric)`. A demand is issued when pressure >= 0.15, at most 3 open at once, one every 60 days globally, one check every 30 days. Conflicting demands (same `conflictTag`) never coexist. The player can accept, decline, counter (lighter or longer), spend a Favour (extend or waive) or use Leverage. Met: +15 (x factor). Timed out: -10. Rival airlines are shown as backing, opposing or ignoring before the player decides.

A bold first-meeting pitch creates a numeric Promise: kept +10, broken -15.

### Staged departure
`cold warning (30 days Cold)` -> `capacity cut to 70% (Hostile)` -> `exit notice (45 days)` -> `exit at season end`.

- One notice at a time. At most 2 exits per game-year (calendar buckets of `yearDays`, so day 360 belongs to year 1).
- Last-chance counter during notice: 35%, 55% with a Favour.
- A recovered band cancels the stage (`exit_rescued`, `capacity_restored`).
- Re-entry after at least 2 years, one band below where they left (floor Cold).
- Player cancellation: fee (`penaltyPerCancellation x min(12, months left)`) plus a credit loss of 8..20 for 24 months and all Favours/Leverage lost. It takes effect at the next season end. The last 30 days of a term is a free notice window. Use `cancellationQuote()` to show the price first.
- Leavers free their slots into a pool. After 30..90 days one or two procedural newcomers appear. Names come from a blocklist-checked generator, always differ from the leaver and arrive with a new-entrant incentive ask. Each unlocked tier keeps at least 2 prospects and never exceeds `TIER_ROSTER_CAP` (6) live airlines of one kind through slot pools.
- Optional 80% slot rule (`setSlotRule80(true)`): a signed airline using under 80% of its season slots returns its peak-series slots. Pro-rated from the signing day (needs at least 30 active days). Excused flights count as used. Off by default.

### Drama
- **Key figures** (tier 3 and up, about half of the airlines): name, 2 traits, agenda, voice, 3-event memory. A figure retires after 4..8 years. The successor keeps 50% of the modifiers and one trait and rolls one new.
- **First meeting**: a scene with four choices (formal, warm, bold, tour). Tone ranges -5..+8 (tour -5..+10).
- **Alliances** (from tier 4): signed allies +5. A Partner ally can mediate (+5, costs a fee, once per 6 months) or vouch (+5, free, once a year).
- **Single Hub**: needs Partner, tier 3+, non-Minor, a Base, 2+ daily departures and maintenance level 2. Cost is 4x the tier cost. Non-allied rivals take -15. `hubBlockers()` lists every reason at once. Hub and Base are revoked when Warm is lost.
- **Public spats**: an angry airline goes public. Reputation drops 2 a month until resolved (concede, hold or court a rival). Consume the delta with `consumeReputationDelta()`.
- **Rival airport**: at season end it may poach one unhappy airline (risk grows as standing falls and while in a spat). `defendAgainstPoach()` buys a shield until the next season end.
- **Hostile actions** (Hostile band): lawsuit (legal fee plus verdict), late slot changes, refused gates, slowed turnarounds. They arrive through `onHostileAction` and `operationalEffects()`.

### 2D portrait cards
`getCard(id)` / `cards()` return plain data: portrait art tokens (seeded, deterministic), frame by rank, logo-only flag for contacts without a key figure, band chip (colour + icon + word, all distinct), the formula line `Performance .. · Modifiers .. · Traits .. = N Band`, top 2 negative causes, interests, rivals, history and trend. The renderer draws it however it likes (SVG or canvas); no 3D.

## Public API

```ts
import { DiplomacyEngine, createDiplomacyState, createDiplomacyAdapter } from '../diplomacy/index.ts';
```

`DiplomacyEngine(host, state?, { seed, config })`:

| Group | Methods |
| --- | --- |
| Time | `advance(dtDays, ctx)` returns events. Tick-agnostic: daily systems run at each whole-day boundary. |
| Inputs | `recordGrade`, `recordFlight`, `recordIncident`, `notifyFeeChange` |
| Contracts | `previewSign`, `respondToProposal(id, 'accept' \| 'support' \| 'counter' \| 'decline', payWith?)`, `cancelContract`, `cancellationQuote` |
| Demands | `respondToDemand`, `counterDemand`, `spendFavourOnDemand` |
| Actions | `firstMeetScene` / `resolveFirstMeet`, `startEndeavor`, `launchIncentiveDeal`, `apologize`, `mediate`, `vouch` |
| Trouble | `counterExitNotice`, `respondToSpat`, `defendAgainstPoach`, `settleLawsuit` |
| Hub | `hubBlockers`, `requestHub`, `revokeHub` |
| Read | `getCard`, `cards`, `relation`, `signedAirlineIds`, `feeDiscountPct`, `poachRisk`, `operationalEffects`, `consumeReputationDelta`, `drainEvents` |
| Save | `serialize`, `DiplomacyEngine.parse`, `loadState`, `setSlotRule80` |

Every action returns `ActionResult { ok, cost, message, chance?, data? }`. Failures never mutate state.

## Wiring it in (terminal agent)

`createDiplomacyAdapter(host, options?, restore?)` follows the same shape as the logistics adapter: you supply callbacks, it never reaches into `sim.ts`.

```ts
const diplomacy = createDiplomacyAdapter(
  {
    addMoney: (amount, category) => sim.addCash(amount, category),
    getCash: () => sim.cash,
    getContext: () => ({
      fieldLevel: sim.fieldLevel,
      metrics: {
        onTimePct: sim.stats.onTimePct,
        feeIndex: sim.feeIndex,
        cafes: sim.count('cafe'),
        loungeSeats: sim.loungeSeats,
        standCount: sim.stands.length,
        standUtilization: sim.standUtilization,
        solarCoveragePct: sim.solarPct
        // ... other MetricKey values you track; missing ones count as 0
      },
      airport: sim.airportCapabilities // optional, from src/airlines
    }),
    notify: (message, severity) => sim.pushNews(message, severity),
    applyReputation: (delta) => sim.addReputation(delta),
    onHostileAction: (action) => sim.log(action.text),
    onOperationalEffects: (fx) => sim.setDiplomacyPenalties(fx)
  },
  { seed: sim.seed }
);

// each sim step
diplomacy.tick(dtGameMinutes);

// each finished turnaround
diplomacy.onTurnaroundComplete(airlineId, { delayMinutes, bagMinutes, paxMood, standFit });

// weather cancellations are excused
diplomacy.onFlightCancelled(airlineId, true);

// fee sliders
diplomacy.onFeeChange(newIndex);

// UI
diplomacy.cards();
diplomacy.respondToProposal(id, 'accept');
// saves
localStorage.setItem('diplomacy', diplomacy.save());
diplomacy.load(localStorage.getItem('diplomacy')!);
```

Integration steps for the host:

1. Construct the adapter once, with the sim's seed. Restore with `load()` on save games.
2. Call `tick()` every sim step. Any step size works.
3. Grade each turnaround (`gradeTurnaround` is exported if you want to call it directly).
4. Apply `onOperationalEffects`: multiply turnaround times by `turnaroundSlowFactor`, close `refusedGates` gates, add `extraDelayMinutes` to departures of the affected airline (`perAirline`).
5. Apply `feeDiscountPct(airlineId)` when charging that airline.
6. Respect `capacityFactor` on `relation(id)` when scheduling that airline's flights (0.7 during a capacity cut).
7. Show `cards()` and the proposals in `engine.state.proposals`; surface letters from `notify`.
8. `toAirlinesFlightEvent(contractId, grade, delay)` feeds the same grade into `src/airlines` satisfaction so the two systems stay in step.

## Assumptions

- **Names are placeholders** (decision 22). The newcomer generator checks against a blocklist of real carriers.
- **Seasons are 90 days, game-years 360 days** (`DiplomacyConfig`). "Game-year" for the exit cap is the calendar bucket `floor(day / yearDays)`, not a rolling window.
- **Field Level 1/3/5/7/9 unlocks tiers 1..5** (`TIER_UNLOCK_FIELD_LEVEL`). The host passes `fieldLevel`.
- **Contract terms** per tier are in `TIER_CONTRACT_TERMS` (typed as `ContractTerms` from `src/airlines`).
- **Money scale** is `TIER_COST` (1.5k..45k); actions are multiples of it. These numbers are untuned and meant for a balance pass.
- **Interest gaps** (`INTEREST_GAP`) map each interest to one metric. Hosts that cannot supply a metric get a gap of 100% on interests that need it, so supply as many as you can.
- **Rivalry** between airlines is derived from shared interests and passenger type, not hard-coded.
- **Share** defaults to a flights EMA. Pass `ctx.shares` to override with real traffic share.
- **Serialisation** is plain JSON (with `Infinity` encoded); the RNG state lives inside the state so saves resume deterministically.

## Tests

`npx vitest run src/diplomacy` covers standing math, proposals and signing, demands and promises, departure/churn/cancellation/re-entry, drama (spats, poaching, hostility), key figures, first meeting, alliances, hub, cards, actions, determinism and tick-splitting, the adapter, and headless one- and two-year sims with invariants (standing range, one hub, one notice at a time, exit cap per game-year, exits only at season ends).
