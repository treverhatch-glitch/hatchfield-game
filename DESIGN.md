# Hatchfield design notes

HatchTag’s prompts are the source of truth. Grok’s writeup was research and suggestions, not a spec. Do not keep a tiny 16×16 puzzle plot or drag-to-paint runways because a manifesto said so.

## What we are making

A Steam-bound airport tycoon. This repo is the **browser sketch**. The shipping game is meant to be **Godot 4** later.

- **Look and build loop:** Airport Tycoon 3 — 3D field you orbit, **prebuilt pieces you stamp** (a whole runway, not a tile you drag).
- **Management:** Airport CEO — bags, fuel, security, hall layout. The jet on screen and the money in the book are the same flight.
- **After the airport exists:** the game is still on. AT 2000/3 were basically won once planes landed. We do not copy that.

## Locked for later (do not drop)

- Larger / heavier **runway classes** for bigger aircraft.
- **Helicopters**.
- **Airside vs terminal** as two parallel experiences (jets/trucks outside, RCT crowd inside).
- RCT guests: pathfinding to needs. Preference is not persona — a starting tag (budget vs premium) plus desires (food, bag, seat, later golf sim / waterfall / gaming den).
- **Flight clock** — departing people can miss the gate.
- Budget traffic wears cheap facilities and clogs space; premium traffic only comes if the hall and the airline are worth it. Attracting high-grade airlines is mid/late game.
- **Loans** once bankruptcy is real.
- Next real feature after a playable stamp-field: a **guest you can click** with a need and a clock.

## Placement now

Click a catalog piece, click the field, the whole prefab lands. Rotate the piece (horizontal / vertical). Easy grant starts with a live starter airport so a jet can arrive without a construction tutorial.
