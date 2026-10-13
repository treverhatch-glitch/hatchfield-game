# Hatchfield — Problems

Honest gaps vs [VISION](./VISION.md) + [BUILD](./BUILD.md).

## Traffic & pathfinding — status

| Layer | What works | What’s weak |
| --- | --- | --- |
| **Plane-side** | A* apron; pushback; multi-strip; hold; congestion slowdown | No service lanes; slowdown≠gridlock; long A* can hitch |
| **Pax apron** | Jetway / bus / walk; shared jam | Bus capacity thin; walk fee cut weak |
| **Hall** | Security choke; wallets; PaxTags; capped BFS | Rooms not walls; soft queues only; 80 guest cap |
| **Bags** | Belt lite; unload truck; claim needs | Bag units / premade ceilings / through-transfer shipping in Slice 1 |
| **Cargo landside** | Shed + freighter contracts | No guard/city trucks/warehouse/volume letters yet (Slices 2–3) |

## Product gaps

1. ~~Belt skill missing~~ — E1 shipped; deepen with claim ceilings.  
2. **Cargo path incomplete** — still shed-first; BUILD slices 2–3.  
3. ~~Emergency Planner silence~~ — E2 stolen-slot tint shipped.  
4. **Military side thin** — host only; mission letters later (E5).  
5. **Growth silhouette thin** — mega-hub look is E6.  
6. **Scenario vacuum** — E6.  
7. **Franchise / brand retail shallow** — E6.  
8. **Premade halls too strong forever** — Slice 1 ceilings.  
9. **Fuel infinite magic** — bowser/farm capacity is BUILD slice 4.  
10. **Starter / Loan discoverability** — coach polish.

## Fifth-loop smell

Military, cargo, emergencies stay **letter-sized** until a verb needs a stage. Spaceport = expansion, not 1.0 pillar.

## Technical / UX

- Dual WebGL tax; 5x drops shadows.  
- Letter Sign click races — force-click in tests.  
- Save key `apron-save-v24` — ad hoc migrations.  
- Freeflow parked (P2.5).

## Balance smells

- Easy can feel rich after kit; Standard should force loan.  
- Payroll field-load must clip snowballs.  
- Bag handling must not become overweight cash printer (airline keeps ticket fees).  

## Decided

| Question | Call |
| --- | --- |
| Premade terminals | Starter shells with **ceilings**; upgrade or custom |
| Bag ticket fees | Airline off-screen; airport = handling + Standing |
| Layover bags | Through-transfer by default |
| Cargo | Equal path; city trucks + volume letters |
| Construction BOM | Opt-in/late; never block first hour |
| Spaceport | Expansion after mega-hub |
| Unlock spine | **Field Level** primary; research specialty |

## Stuck test

Starter + ignore hall/belts/claim + 5x prints money for 10 min → layout strategy failed.
