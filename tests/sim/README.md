# Headless Multi-Day Simulation Test Suite

This directory contains the end-to-end headless simulation test suite for Hatchfield Airport (`apron`).
The suite exercises multi-day game loops without UI overhead, verifying long-term operational health, stability, and economy mechanics.

## Running the Suite

Run the full headless simulation suite using Vitest:

```bash
npm test -- tests/sim
```

To run an individual scenario test:

```bash
npx vitest run tests/sim/starter7d.test.ts
```

## Suite Architecture

### Harness (`tests/sim/harness.ts`)

The shared simulation harness provides setup helpers and metric assertions:

- `createTestAirport(options)`: Initializes a seeded `Game` instance with customizable configuration (difficulty, site, starter kit, signed airlines, staff, fuel, and catering).
- `runSimDays(game, days, options)`: Drives the simulation tick by tick for $N$ game days (where 1 game day = 180 sim seconds).
- `checkNaN(game)`: Inspects all numeric fields in state, ledger, and bank records to guarantee no `NaN` or `Infinite` values occur.
- `checkStuckVehicles(game)`: Verifies that no ground trucks or aircraft become stuck or deadlocked.
- `assertBoundedCashGrowth(cashPerDay, startDay, endDay, maxFactor)`: Asserts that cash growth over a specified day range does not exceed the allowed multiplier (e.g. $\le 3\times$ over days 20–30).
- `assertSimHealth(metrics, options)`: Standard assertion bundle checking for zero NaN errors, zero stuck vehicles, and bounded lost passengers and bags.

### Scenarios

1. `starter7d.test.ts`: 7-day starter kit simulation with a single regional carrier (Northline).
2. `mixedFleet14d.test.ts`: 14-day simulation with mixed passenger and cargo operations (Northline, Harbor, UPPS).
3. `heavyJetStress.test.ts`: Heavy runway and widebody/heavy jet turnaround stress test.
4. `twoTerminals.test.ts`: Multi-terminal campus operations and passenger/gate routing.
5. `fuelOutageRecovery.test.ts`: Fuel depletion and supply recovery simulation.
6. `payrollShortfall.test.ts`: Low-cash state handling and daily payroll deduction resilience.
7. `litterAndJanitors.test.ts`: Passenger litter accumulation and janitor cleaning loops.
8. `landPlotsTax30d.test.ts`: 30-day expansion with plot purchases and daily holding taxes.
9. `inboundRequests30d.test.ts`: 30-day inbound requests, Guard calls, and walk-in offers.
10. `contractsLeadTime.test.ts`: Airline contract lead times, offers, and schedule slotting.
11. `nightOps.test.ts`: Night operations, night bank research, and freighter schedules.
12. `longRun30dNoStuck.test.ts`: 30-day long-term stability test asserting 0 NaN, 0 stuck vehicles, and bounded cash growth ($\le 3\times$ over days 20–30).
