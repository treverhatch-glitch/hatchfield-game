# Hatchfield — Economy

Money = picture. If cash moves and nothing on screen did, the loop is wrong.

## Cash sources (when they post)

| Source | When it posts | Notes |
| --- | --- | --- |
| Landing / handling | Turnaround services complete | Fuel, bags, catering, cleaning, MX |
| Hall spend | Guest buys food/shop/play/lounge/etc. | Wallet + prefs gate purchases |
| Landside fees | Guest uses hotel / park / bus / rail | Usage only — idle stamps don’t earn |
| Pad / parking / emergency host | Helo, GA parking, divert/tanker accepted | Letter-driven |
| Layover / Hub fees | Accept letter | Up-front + transfer dwell spend |
| IPO raise / share trades | List + buy/sell HATCH | Public crises tank the ticker |
| Field-task bonuses | Complete airline ask | Fail = fine |

## Cash sinks

| Sink | Cadence | Pressure |
| --- | --- | --- |
| Stamps (runway, stands, halls, ops, landside) | On place | Jetway stands ×1.85 |
| Contracts (fuel, catering brands) | Sign fee | Unlocks carriers |
| Payroll (ops budgets) | ~30s | Field-load multiplier from carriers / stands / turns |
| Landside + amenity upkeep | ~30s | Idle buildings bleed |
| Loan interest | Ticking | Scales with balance; capitalizes when unpaid (capped) |
| Scramble / fines / bans / abandon | Events | Security + heat failures |
| Research / hire (mechanics, janitors, researchers, desk) | Instant | Bodies must work for RP / scrub / MX |

## Difficulty leash

- **Easy** — roomy cash; learn the picture.
- **Standard** — after city land + starter kit, cash is tight (~loan almost required). Thrifty + loan forever is a trap; grow and repay is the healthy path.
- City levy / field-load payroll clip late snowballs.

## Layout ↔ money bridges (strategy)

These are the bridges that stop “strip + plane = win”:

1. **Jetway vs remote** — pay more up front → faster turns → more hall dwell → more retail. Remote + walk → congestion + less spend. Remote + bus → mid path.
2. **Security choke** — no security → threats / smuggling / heat. Soft security → wear + incidents.
3. **Taxi geometry** — congestion slows GSE and jets → late boards → heat dips → fewer slots.
4. **Landside match** — persona wants rail/hotel/bus; missing mode angers + skips fees.
5. **Wear / cleaning budget** — budget crowds scuff WC/security; scrub costs cash or reputation dies.

## Capital loop (mid/late)

Loans → parcels → rail → IPO → street missions → public security crises. Being public adds pressure AT3 never had. Protect security or HATCH dies.

## Balance knobs (code touchpoints)

- `START_CASH`, land costs, `STARTER_KIT_COST`
- `STAND_JETWAY_MULT`, termbus cost
- Payroll / `fieldOpsMult`, `landsideUpkeep`, guest wallet rolls
- `LOAN_*`, IPO mins, heat thresholds, abandon/ban fines
- Hall guest cap (80), spend rates by PaxTag / jetway bonus needs

## Playtest questions

1. After first Northline turnaround, is the next dollar decision interesting?
2. Does ignoring Hall still print money at 3x for 10 minutes? (Should hurt.)
3. Does a clogged taxi visibly delay a departure and cool heat?
4. Does jetway investment pay back via hall spend within a few turns?
5. Does Standard force a loan without feeling unfair?
