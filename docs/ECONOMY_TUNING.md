# Economy tuning

`docs/playtest/bots/economy_findings.md` is not in this tree. The numbers below are from `scripts/soak-personas.mts` (a 30-game-day headless run, speed 5, one-second ticks, seeded). One game day is 180 sim-seconds. Setup cash is what is left after standard city land and the starter kit ($7,000). Clearly profitable means day-30 cash is at least $10,000 above that setup and above zero. Bankrupt means day-30 cash is at or below zero.

Payroll shares were not moved. Early days still bill 75% of operating income, and later days 57.5%, with the staffing floor as the minimum. Those rates stay in `src/core/bank.ts`.

## What the first passes showed

A careful player who refused every emergency and ignored every threat posted on the order of $200,000 of penalties over the month and finished near $0, with the cash minimum on the -$25,000 debt floor. Hosting only what the field can actually take, scrambling a threat when the cash is there, and drawing the $25,000 micro loan once still left that player at **$2,731** on day 30 (one payroll miss short of a clean month). A greedy player who took the biggest loan, signed everyone, and built the hotel, both parks, and rail finished on the debt floor.

## Before

Same personas, no small-field relief (`SMALL_FIELD_UPKEEP_FACTOR` 1, `SMALL_FIELD_FEE_FACTOR` 1).

| Persona | Day-30 cash | Versus setup | Minimum | Loan still owed | Carriers | Flights | Payroll misses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful | $2,731 | -$4,269 | -$25,000 | $0 | 2 | 62 | 17 |
| Greedy | -$25,000 | -$32,000 | -$25,000 | $42,127 | 7 | 51 | 26 |
| Chaotic | -$24,123 | -$31,123 | -$24,123 | $15,655 | 12 | 64 | 23 |

Careful was solvent and not profitable. Greedy and chaotic were bankrupt.

## After

Knobs in `src/game/economyTuning.ts`:

- A field with 1 or 2 carriers and no hotel, car park, or rail pays **35%** of building upkeep.
- That same field bills **1.22×** turn fees (landing, passengers, bags, fuel, catering, retail, contracts).
- A third carrier, or a hotel, park, or rail link, drops both. Payroll shares are unchanged.

| Persona | Day-30 cash | Versus setup | Minimum | Loan still owed | Carriers | Flights | Payroll misses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful | $19,127 | +$12,127 | -$4,117 | $0 | 2 | 66 | 1 |
| Greedy | -$13,656 | -$20,656 | -$21,005 | $39,613 | 6 | 57 | 27 |
| Chaotic | -$10,482 | -$17,482 | -$25,000 | $35,606 | 8 | 42 | 23 |

Careful is in the black by more than $10,000 over the post-kit cash, with a single payroll miss. Greedy still finishes in debt, with the loan open and payroll missed most days.

## Personas

Defined in `src/game/soakPersonas.test.ts`. The default `npm test` skips the soak. Run it with `npx tsx scripts/soak-personas.mts`.

- **Careful.** Budgets at 80. At most two carriers. One micro loan ($25,000). Host an emergency only when the field can. Scramble a threat when cash covers it. Build a field ask only when the bonus covers the cost and the cash can spare it. No hotel, parking, or rail.
- **Greedy.** Budgets at 100. Biggest loan on offer, every carrier, every emergency, every scramble. Hotel, both parks, and rail, and hires on a timer.
- **Chaotic.** Seeded coin flips on contracts, loans, budgets, builds, and hires.
