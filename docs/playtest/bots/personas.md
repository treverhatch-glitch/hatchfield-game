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
