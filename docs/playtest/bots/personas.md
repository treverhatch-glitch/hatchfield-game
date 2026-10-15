# Bot personas

Headless playtesters live in `src/playtest/personas.ts`. They only call the player command API.

## Research rooms

The day-1 operations trickle banks research points before anyone is hired. A persona does not furnish a lab until that trickle has produced at least one whole point (`wave3Points >= 1`), a terminal hall exists, and cash covers the catalog price.

Then, in order:

1. Research desk (`rdesk`)
2. Chalkboard (`rboard`)
3. Lab bench (`rmachine`)

Careful buys the next missing room even if a stand was already stamped that day, and waits on the rest of the expansion until the lab step is done. Greedy adds the same room to the current act, beside loans and letters. Chaotic takes it on about half of its looks at the board, and can also hit those rooms from its random room list.

Costs stay in the building catalog. The persona list is `PLAYTEST_TUNING.labRooms`.

## Research tree

The Growth tree is the only research wallet. The operations trickle, finished flights, and the lab rooms all pay into it. When a node is affordable (field level open, previous step owned, points cover the cost), a persona buys the cheapest one. Careful buys at most one node a day. Greedy buys one on every look. Chaotic takes the offer on a little under half of its looks. Tier-1 category nodes cost 0 points. Unspent points stop at twice the next node's cost.

## Desk agents

Check-in and security start empty. A persona hires a desk agent while either post is unstaffed, the hall has those rooms, and the roster is under three. Careful keeps an $8,000 cash buffer above the hire price. Greedy and Chaotic hire when cash covers the price. One hire is one agent; the sim assigns bodies across check-in, security, and the gate.

## Curb

Careful only. When curb pressure is above 1, cash is above $12,000, and the lab step is not waiting, the day's stamp is a bus bay if the field has none, otherwise one road cell beside the narrowest part of the approach. That is the lane. Greedy and Chaotic do not answer the curb.
