# Airlines Module

This module provides pure data and logic for managing airlines, contracts, and requirements in Hatchfield.
It is located in `src/airlines/`.

## Live roster (45 carriers)

The playable carriers are the roster in `src/airlines/roster.ts`, turned into game airlines by `src/game/rosterAirlines.ts`. Each carrier keeps a catalog template for fees, fines, and the negotiation seat band. The metal is its own.

- Fleet ids are `AIRFRAMES` keys (`src/game/airframes.ts`) and `MODEL_SPECS` ids. A missing id is not swapped for a generic jet.
- Seats on the Airlines card, the contract letter, and the spawned flight come from the chosen airframe's `paxMin`/`paxMax`. The template band stays only on the negotiation profile so fees do not move.
- Stand class follows the airframe's ICAO code (A/B small, C medium, D/E/F large). Helicopters need a helipad. Runway cells are the airframe's `minRunway`. The card and the letter use the same line (`fleetCardLine`).
- The planner stamps that airframe on the slot. Spawn keeps it. If no listed type can use the strip, stand, pad, field level, or research, the carrier does not send a letter. The Airlines panel names the gap. The cargo starter's freighter stand is Large so the 757 feeder (code D) can park on day one; a medium stand cannot take it.
- The letter (HUD and phone) adds a capacity warning: `Your N stands host ~X turns/day; signed carriers already want Y; this adds Z`. Pads are counted for helicopter fleets. The line does not block Accept. X is stands (or pads) times `TURNS_PER_STAND_PER_DAY` (`180 / 20`). Y and Z use the existing 4-turn / 3-turn tier split.
- No airframe id was renamed, so v4 saves load on the existing migration chain.

## Core Concepts

- **Airline Tiers**: `regional`, `low-cost`, `full-service`, `flag-carrier`, `cargo`.
- **Fleet Mixes**: Each airline tier has a specific fleet mix referencing airframe IDs from `src/game/airframes.ts`.
- **Airport Capabilities**: The current state of the airport (runway length in meters, stands, services, rating, on-time %, and heavy vehicles from logistics).
- **Airline Requirements**: Grounded in real-world references (e.g., runway lengths per aircraft class).
- **Contracts**: Airlines offer contracts (slots/week, fees, penalties). Contracts can be accepted or rejected.
- **Tick-Agnostic Timing**: The logic uses elapsed game-hours. Rates are expressed per day internally but probabilities scale correctly for any tick duration.
- **Cooldowns & Penalties**: Rejecting or terminating a contract triggers a 30-day cooldown and increases the "penalty tier", resulting in worse terms (lower fees, higher penalties) for future offers from that airline.
- **Satisfaction & Rating**: Active contracts have a satisfaction rating that changes based on flight events. The average satisfaction is the per-airline truth that feeds the airline rating hook compatible with PR #7.
- **Event Emitter**: The state maintains an `events` array that emits `contract_offer`, `contract_signed`, `contract_terminated`, `rating_up`, and `rating_down` events with sim-minute timestamps.

## Real-World References & Balance

- **Runway Lengths**:
  - Regional: ~1500m (5000 ft) - Typical for CRJ-700, E175 (FAA AC 150/5325-4B).
  - Low-Cost: ~2000m (6500 ft) - Typical for fully loaded narrowbodies like A320neo, B738.
  - Full-Service: ~2500m (8200 ft) - Needed for widebodies on medium-haul routes.
  - Flag-Carrier / Cargo: ~3000m (10000 ft) - Typical for long-haul widebodies and heavy freighters at MTOW.
- **Fees & Penalties**:
  - Passenger fees range from ~$5 (Regional) to ~$18 (Flag-Carrier), reflecting typical airport tariff schedules where LCCs negotiate lower rates and premium carriers pay more for better facilities.
  - Landing fees scale with aircraft weight, ranging from $150 (Regional) to $3500 (Cargo).
- **Offer Generation**: 20% chance to generate per day if requirements are met and no offer/contract currently exists.
- **Offer Expiration**: Contract offers expire after 7 days (168 hours).
- **Satisfaction**: 
  - Starts at the airline's `baseSatisfaction`.
  - Flight success: +0.5 satisfaction.
  - Flight delay: -2.0 satisfaction.
  - Flight cancellation: -10.0 satisfaction.
  - If satisfaction reaches 0, the contract is terminated (triggers 30-day cooldown and penalty tier increase).

## How to Wire In (Adapter Guide)

The terminal agent or game loop should maintain the `AirlineState` and periodically call the logic functions.

### 1. State Initialization

```typescript
import { DEFAULT_AIRLINES, AirlineState } from '../airlines';

const initialAirlineState: AirlineState = {
  availableAirlines: DEFAULT_AIRLINES,
  unlockedAirlines: [],
  contractOffers: [],
  activeContracts: [],
  cooldowns: {},
  penaltyTiers: {},
  elapsedHours: 0
};
```

### 2. Periodic Updates

On each game tick (e.g., every hour), the game loop should update the state:

```typescript
import { checkUnlocks, generateContractOffers, expireOffers } from '../airlines';

// Update elapsed hours
state.elapsedHours += 1; // Or however many hours passed this tick

// 1. Expire old offers
state = expireOffers(state);

// 2. Check for new unlocks based on total flights handled
state = checkUnlocks(state, currentAirportCapabilities);

// 3. Generate new contract offers (tick-agnostic, pass the hours elapsed since last check)
state = generateContractOffers(state, currentAirportCapabilities, 1);
```

### 3. Handling Contract Offers

When a new offer is generated, it will appear in `state.contractOffers`. You can display these as non-blocking notifications in the UI.

To accept or reject:

```typescript
import { acceptContractOffer, rejectContractOffer } from '../airlines';

// On accept button click
state = acceptContractOffer(state, offerId);

// On reject button click (triggers 30-day cooldown and worse terms next time)
state = rejectContractOffer(state, offerId);
```

### 4. Processing Flight Events

When a flight completes, is delayed, or is cancelled, record the event and process it to update airline satisfaction:

```typescript
import { processFlightEvents, FlightEvent } from '../airlines';

const events: FlightEvent[] = [
  { contractId: 'contract_offer_123', type: 'success' },
  { contractId: 'contract_offer_456', type: 'delay' }
];

state = processFlightEvents(state, events);
```

### 5. Airline Rating Hook

To get the overall airline rating (0-100) compatible with PR #7:

```typescript
import { getAirlineRating } from '../airlines';

const currentRating = getAirlineRating(state);
```

### 6. Bank Integration (PR #11)

To post money from airline operations, the adapter should listen to flight events and post to the bank:

```typescript
import { bank } from '../core/bank'; // Adjust path as needed

// On successful flight
bank.post({
  type: 'money',
  time: state.elapsedMinutes,
  amount: contract.terms.feePerLanding + (paxCount * contract.terms.feePerPassenger),
  category: 'airline_fees'
});

// On delay/cancellation
bank.post({
  type: 'money',
  time: state.elapsedMinutes,
  amount: -penaltyAmount,
  category: 'airline_penalties'
});
```
