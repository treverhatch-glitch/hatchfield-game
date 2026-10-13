# Hatchfield — Economy

Money = picture. If cash moves and nothing on screen did, the loop is wrong.

**See also:** [VISION.md](./VISION.md) · [PROGRESSION.md](./PROGRESSION.md) · [IDEAS.md](./IDEAS.md).

## Cash sources (when they post)

| Source | When it posts | Notes |
| --- | --- | --- |
| Landing / handling | Turnaround services complete | Fuel, bags, catering, cleaning, MX · **pax + cargo** |
| Hall spend | Guest buys food/shop/play/lounge/etc. | Wallet + prefs gate purchases (pax path) |
| Cargo uplift fees | Freighter load complete | Target: screen/rail chain quality mods fee |
| Landside fees | Guest uses hotel / park / bus / rail | Usage only — idle stamps don’t earn |
| Cargo truck / rail intake | Parcels enter gate or spur | Target landside — usage fees + upkeep |
| Pad / parking / emergency host | Helo, GA, divert/tanker accepted | Letter-driven; steals capacity |
| Military host fees | Guard mission / overnight | Side track — [VISION](./VISION.md) |
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
| Loan interest | Ticking | **Multi-product bank** — Micro → Sovereign; fee rises with principal; one loan at a time; see [PROGRESSION.md](./PROGRESSION.md) |
| Scramble / fines / bans / abandon | Events | Security + Standing failures |
| Research / hire (mechanics, janitors, researchers, desk) | Instant | Bodies must work for RP / scrub / MX |

## Difficulty leash

- **Easy** — roomy cash; learn the picture.
- **Standard** — after city land + starter kit, cash is tight (~loan almost required). Thrifty + loan forever is a trap; grow and repay is the healthy path.
- City levy / field-load payroll clip late snowballs.

## Layout ↔ money bridges (strategy)

These are the bridges that stop “strip + plane = win”:

1. **Jetway vs remote** — pay more up front → faster turns → more hall dwell → more retail. Remote + walk → congestion + less spend. Remote + bus → mid path.
2. **Security choke** — no security → threats / smuggling / Standing dips. Soft security → wear + incidents.
3. **Taxi geometry** — congestion slows GSE and jets → late boards → Standing dips → fewer slots.
4. **Landside match** — persona wants rail/hotel/bus; missing mode angers + skips fees.
5. **Wear / cleaning budget** — budget crowds scuff WC/security; scrub costs cash or reputation dies.
6. **Cargo chain** *(target)* — truck/rail → screen → makeup → loader; break any link → late uplift → **On-time** dip + fee cut ([IDEAS](./IDEAS.md#cargo-landside-infrastructure)).
7. **Emergency / mil capacity tax** — hosting pays fees but steals stands/strip/fuel; refusing saves capacity but costs fines/rep.

## Capital loop (mid/late)

Loans → parcels → rail → IPO → street missions → public security crises. Being public adds pressure AT3 never had. Protect security or HATCH dies.

## Balance knobs (code touchpoints)

- `START_CASH`, land costs, `STARTER_KIT_COST`
- `STAND_JETWAY_MULT`, termbus cost
- Payroll / `fieldOpsMult`, `landsideUpkeep`, guest wallet rolls
- `LOAN_*`, IPO mins, heat thresholds, abandon/ban fines
- Hall guest cap (80), spend rates by PaxTag / jetway bonus needs

## Playtest questions

1. After first Northline (or UPPS) turnaround, is the next dollar decision interesting?
2. Does ignoring Hall still print money at 3x for 10 minutes on a pax focus? (Should hurt.)
3. Does a clogged taxi visibly delay a departure and cool Standing?
4. Does jetway investment pay back via hall spend within a few turns?
5. Does Standard force a loan without feeling unfair?
6. Can a cargo-focus start earn without a hall? (Should yes, once starter kit exists.)
7. Does hosting a divert feel rewarding *and* disruptive to the timetable?
