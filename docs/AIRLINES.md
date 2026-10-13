# Airlines Module

This module provides pure data and logic for managing airlines, contracts, and requirements in Hatchfield.
It is located in `src/airlines/`.

## Core Concepts

- **Airline Tiers**: `regional`, `low-cost`, `full-service`, `flag-carrier`, `cargo`.
- **Airport Capabilities**: The current state of the airport (runway length, stands, services, rating, on-time %).
- **Airline Requirements**: What an airline needs before it will consider offering a contract.
- **Contracts**: Airlines offer contracts (slots/week, fees, penalties). Contracts can be accepted or rejected.
- **Satisfaction**: Active contracts have a satisfaction rating that changes based on flight events (success, delay, cancellation). If satisfaction drops to 0, the contract is terminated.

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
  currentDay: 1
};
```

### 2. Daily / Periodic Updates

On each game day or tick, the game loop should update the state:

```typescript
import { checkUnlocks, generateContractOffers, expireOffers } from '../airlines';

// 1. Expire old offers
state = expireOffers(state);

// 2. Check for new unlocks based on total flights handled
state = checkUnlocks(state, currentAirportCapabilities);

// 3. Generate new contract offers (random chance for unlocked airlines that meet requirements)
state = generateContractOffers(state, currentAirportCapabilities);
```

### 3. Handling Contract Offers

When a new offer is generated, it will appear in `state.contractOffers`. You can display these as non-blocking notifications in the UI.

To accept or reject:

```typescript
import { acceptContractOffer, rejectContractOffer } from '../airlines';

// On accept button click
state = acceptContractOffer(state, offerId);

// On reject button click
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

If a contract's satisfaction drops to 0, `processFlightEvents` will automatically remove it from `activeContracts`.

## Balance Assumptions

- Offers have a 20% chance to generate per day/tick if requirements are met and no offer/contract currently exists for that airline.
- Offers expire after 7 days.
- Satisfaction starts at the airline's `baseSatisfaction` (varies by tier, e.g., 70 for regional, 90 for flag carrier).
- Flight success: +0.5 satisfaction.
- Flight delay: -2.0 satisfaction.
- Flight cancellation: -10.0 satisfaction.
- If satisfaction reaches 0, the contract is immediately terminated.
